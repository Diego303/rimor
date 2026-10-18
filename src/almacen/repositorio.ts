/**
 * Repositorio de elementos sobre un Almacen: guarda y lee `.md` con @rimor/formato, mantiene el índice
 * id/ref → ruta, renombra al cambiar el título (el id nunca cambia), papelera y adjuntos sin duplicados.
 */
import {
  type Elemento,
  escribirElemento,
  fallo,
  leerElemento,
  ok,
  type Resultado,
  rutaAdjunto,
  rutaElemento,
  sha256Hex,
} from '@rimor/formato';
import { type Almacen, leerTexto, listarTodo } from './contrato';

export const CARPETA_PAPELERA = 'papelera';

export interface EntradaIndice {
  id: string;
  ref: string;
  ruta: string;
  /** En la papelera (su ruta empieza por `papelera/`). */
  enPapelera: boolean;
}

const codificador = new TextEncoder();

export class Repositorio {
  private readonly porId = new Map<string, EntradaIndice>();
  private readonly idPorRef = new Map<string, string>();

  constructor(private readonly almacen: Almacen) {}

  /** Arma el índice leyendo `elementos/` y `papelera/elementos/`. Devuelve los archivos que no se pudieron leer. */
  async cargar(): Promise<{ ruta: string; codigo: string }[]> {
    this.porId.clear();
    this.idPorRef.clear();
    const fallidos: { ruta: string; codigo: string }[] = [];
    for (const prefijo of ['elementos/', `${CARPETA_PAPELERA}/elementos/`]) {
      for (const e of await listarTodo(this.almacen, prefijo)) {
        if (!e.ruta.endsWith('.md')) continue;
        const r = leerElemento((await leerTexto(this.almacen, e.ruta)) ?? '');
        if (!r.ok) {
          fallidos.push({ ruta: e.ruta, codigo: r.error.codigo });
          continue;
        }
        this.indexar(r.valor, e.ruta);
      }
    }
    return fallidos;
  }

  private indexar(el: Elemento, ruta: string): void {
    const { id, ref } = el.frontmatter;
    const previa = this.porId.get(id);
    if (previa && previa.ref !== ref) this.idPorRef.delete(previa.ref);
    this.porId.set(id, { id, ref, ruta, enPapelera: ruta.startsWith(`${CARPETA_PAPELERA}/`) });
    this.idPorRef.set(ref, id);
  }

  /** Entrada del índice por ref o por id. */
  buscar(refOId: string): EntradaIndice | undefined {
    return this.porId.get(this.idPorRef.get(refOId) ?? refOId);
  }

  entradas(): IterableIterator<EntradaIndice> {
    return this.porId.values();
  }

  /** Refs en uso (también las de la papelera), para asignar la siguiente. */
  refs(): IterableIterator<string> {
    return this.idPorRef.keys();
  }

  /**
   * Guarda un elemento. Si ya existía, conserva el YAML anterior (orden y comentarios) y, si cambió el
   * título o la ref, renombra el archivo. Devuelve la ruta final.
   */
  async guardarElemento(el: Elemento): Promise<string> {
    const previa = this.porId.get(el.frontmatter.id);
    const destino = previa?.enPapelera
      ? `${CARPETA_PAPELERA}/${rutaElemento(el.frontmatter.ref, el.frontmatter.titulo, el.frontmatter.creado)}`
      : rutaElemento(el.frontmatter.ref, el.frontmatter.titulo, el.frontmatter.creado);
    const textoPrevio = previa ? ((await leerTexto(this.almacen, previa.ruta)) ?? undefined) : undefined;
    await this.almacen.escribir(destino, codificador.encode(escribirElemento(el, textoPrevio)));
    if (previa && previa.ruta !== destino) await this.almacen.borrar(previa.ruta);
    this.indexar(el, destino);
    return destino;
  }

  async leerElemento(refOId: string): Promise<Resultado<Elemento>> {
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    const texto = await leerTexto(this.almacen, e.ruta);
    if (texto === null) return fallo('almacen.noEncontrado', { ref: refOId });
    return leerElemento(texto);
  }

  async moverAPapelera(refOId: string): Promise<Resultado<string>> {
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    if (e.enPapelera) return ok(e.ruta);
    const destino = `${CARPETA_PAPELERA}/${e.ruta}`;
    await this.almacen.mover(e.ruta, destino);
    this.porId.set(e.id, { ...e, ruta: destino, enPapelera: true });
    return ok(destino);
  }

  async restaurar(refOId: string): Promise<Resultado<string>> {
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    if (!e.enPapelera) return ok(e.ruta);
    const destino = e.ruta.slice(CARPETA_PAPELERA.length + 1);
    if (await this.almacen.existe(destino)) return fallo('almacen.destinoOcupado', { ruta: destino });
    await this.almacen.mover(e.ruta, destino);
    this.porId.set(e.id, { ...e, ruta: destino, enPapelera: false });
    return ok(destino);
  }

  /** Borra definitivamente lo que hay en la papelera. El ZIP previo lo hace quien llama (IN-035). */
  async vaciarPapelera(): Promise<number> {
    const entradas = await listarTodo(this.almacen, `${CARPETA_PAPELERA}/`);
    for (const e of entradas) await this.almacen.borrar(e.ruta);
    for (const [id, e] of [...this.porId]) {
      if (!e.enPapelera) continue;
      this.porId.delete(id);
      if (this.idPorRef.get(e.ref) === id) this.idPorRef.delete(e.ref);
    }
    return entradas.length;
  }

  /** Guarda un adjunto por su hash; si ya existe, no lo reescribe. */
  async guardarAdjunto(bytes: Uint8Array, extension: string): Promise<{ hash: string; ruta: string; nuevo: boolean }> {
    const hash = sha256Hex(bytes);
    const ruta = rutaAdjunto(hash, extension);
    if (await this.almacen.existe(ruta)) return { hash, ruta, nuevo: false };
    await this.almacen.escribir(ruta, bytes);
    return { hash, ruta, nuevo: true };
  }
}
