/**
 * Repositorio de elementos sobre un Almacen: guarda y lee `.md` con @rimor/formato, mantiene el índice
 * id/ref → ruta, renombra al cambiar el título (el id nunca cambia), papelera y adjuntos sin duplicados.
 */
import {
  type Elemento,
  escribirElemento,
  type FrontmatterComun,
  fallo,
  leerElemento,
  ok,
  type Resultado,
  rutaAdjunto,
  rutaElemento,
  sha256Hex,
} from '@rimor/formato';
import type { EntradaFrontmatter } from './cache/cache';
import { type Almacen, escribirTexto, leerTexto, listarTodo, validarRuta } from './contrato';

export const CARPETA_PAPELERA = 'papelera';
/** Versiones anteriores y resultados de los elementos (plan §13.2). */
export const CARPETA_HISTORIAL = 'historial';
/** Diario de la operación de varios pasos en curso (renombrar, papelera, restaurar): si se corta, se termina al cargar. */
export const RUTA_DIARIO = '.rimor/operacion.json';

export interface EntradaIndice {
  id: string;
  ref: string;
  ruta: string;
  /** En la papelera (su ruta empieza por `papelera/`). */
  enPapelera: boolean;
}

const codificador = new TextEncoder();

export interface OpcionesRepositorio {
  /** Se llama tras cada cambio en los archivos de elementos (guardar, papelera, restaurar, vaciar). */
  alCambiar?: () => void;
  /** Si devuelve `false` (otra pestaña escribe), cualquier escritura falla con `almacen.soloLectura`. */
  puedeEscribir?: () => boolean;
}

/** Error de escribir desde una pestaña que solo puede leer. */
export class ErrorSoloLectura extends Error {
  readonly codigo = 'almacen.soloLectura';
  constructor() {
    super('almacen.soloLectura');
  }
}

/** Lo que el repositorio necesita de la caché del espacio. */
export interface CacheRepositorio {
  guardarFrontmatters(entradas: EntradaFrontmatter[]): Promise<void>;
  borrarElementos(ids: readonly string[]): Promise<void>;
}

/**
 * Termina la operación de varios pasos que quedó a medias según el diario: si el destino ya existe, sobra el
 * origen. Lo llaman `Repositorio.cargar` y `reconciliar` antes de leer nada.
 */
export async function recuperarOperacion(almacen: Almacen): Promise<void> {
  const texto = await leerTexto(almacen, RUTA_DIARIO);
  if (texto === null) return;
  try {
    const { de, a } = JSON.parse(texto) as { de?: unknown; a?: unknown };
    if (typeof de === 'string' && typeof a === 'string' && de !== a && (await almacen.existe(a)))
      await almacen.borrar(de);
  } catch {
    // Diario ilegible: la operación no llegó a empezar.
  }
  await almacen.borrar(RUTA_DIARIO);
}

export class Repositorio {
  private readonly porId = new Map<string, EntradaIndice>();
  private readonly idPorRef = new Map<string, string>();
  /** Frontmatter de cada elemento conocido: lo que hace falta para listas y recuentos sin abrir archivos. */
  private readonly fms = new Map<string, FrontmatterComun>();

  constructor(
    private readonly almacen: Almacen,
    /** Si se da, se actualiza al guardar, mover y vaciar (IN-006), sin esperar a la próxima reconciliación. */
    private readonly cache?: CacheRepositorio,
    private readonly opciones: OpcionesRepositorio = {},
  ) {}

  /** ¿Puede escribir esta pestaña ahora? (Solo una escribe, IN-005.) */
  escribible(): boolean {
    return !this.opciones.puedeEscribir || this.opciones.puedeEscribir();
  }

  /** Las pestañas que no escriben no tocan los archivos aunque alguien lo intente. */
  private comprobarEscritura(): void {
    if (!this.escribible()) throw new ErrorSoloLectura();
  }

  /** Avisa de un cambio (cuenta para el recordatorio de copia, IN-007). */
  private cambio(): void {
    this.opciones.alCambiar?.();
  }

  /**
   * Mueve `de` → `a` (o deja `a` escrito y borra `de`) anotándolo antes en el diario: un corte en medio
   * dejaría dos copias, y `cargar` termina la operación.
   */
  private async conDiario(de: string, a: string, paso: () => Promise<void>): Promise<void> {
    await this.almacen.escribir(RUTA_DIARIO, codificador.encode(JSON.stringify({ de, a })));
    await paso();
    await this.almacen.borrar(RUTA_DIARIO);
  }

  /** Termina la operación que quedó a medias (ver `recuperarOperacion`). */
  private recuperar(): Promise<void> {
    return recuperarOperacion(this.almacen);
  }

  /** Pone al día la caché (si la hay) con el archivo recién escrito o movido, con su tamaño y fecha reales. */
  private async refrescarCache(el: Elemento, ruta: string): Promise<void> {
    if (!this.cache) return;
    for await (const e of this.almacen.listar(ruta)) {
      if (e.ruta !== ruta) continue;
      const { id, ref } = el.frontmatter;
      await this.cache.guardarFrontmatters([
        { id, ref, ruta, tam: e.tam, modificado: e.modificado, frontmatter: el.frontmatter },
      ]);
    }
  }

  /** Arma el índice leyendo `elementos/` y `papelera/elementos/`. Devuelve los archivos que no se pudieron leer. */
  async cargar(): Promise<{ ruta: string; codigo: string }[]> {
    await this.recuperar();
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
        const previa = this.porId.get(r.valor.frontmatter.id);
        if (previa) {
          // Dos archivos con el mismo id (copiados a mano, por ejemplo): se queda el que está en su sitio.
          const enSuSitio =
            e.ruta === rutaElemento(r.valor.frontmatter.ref, r.valor.frontmatter.titulo, r.valor.frontmatter.creado);
          fallidos.push({ ruta: enSuSitio ? previa.ruta : e.ruta, codigo: 'almacen.duplicado' });
          if (!enSuSitio) continue;
        }
        this.indexar(r.valor, e.ruta);
      }
    }
    return fallidos;
  }

  /** Arma el índice desde la caché (IN-006), sin abrir archivos. */
  cargarDesde(entradas: Iterable<{ id: string; ref: string; ruta: string; frontmatter?: FrontmatterComun }>): void {
    this.porId.clear();
    this.idPorRef.clear();
    this.fms.clear();
    for (const { id, ref, ruta, frontmatter } of entradas) {
      this.porId.set(id, { id, ref, ruta, enPapelera: ruta.startsWith(`${CARPETA_PAPELERA}/`) });
      this.idPorRef.set(ref, id);
      if (frontmatter) this.fms.set(id, frontmatter);
    }
    // Los alias, después de todas las refs vigentes: una ref vigente siempre gana a un alias.
    for (const { id, frontmatter } of entradas) this.indexarAlias(id, frontmatter?.alias);
  }

  /** Frontmatter de los elementos que no están en la papelera. */
  elementos(): FrontmatterComun[] {
    return [...this.fms].filter(([id]) => !this.porId.get(id)?.enPapelera).map(([, fm]) => fm);
  }

  /** Elemento (fuera de la papelera) con ese hash del original: el duplicado exacto (ORG-05). */
  porHash(hash: string): FrontmatterComun | undefined {
    for (const [id, fm] of this.fms) if (fm.hash === hash && !this.porId.get(id)?.enPapelera) return fm;
    return undefined;
  }

  /** Frontmatter de un elemento por ref o id, sin abrir su archivo. */
  frontmatter(refOId: string): FrontmatterComun | undefined {
    const e = this.buscar(refOId);
    return e ? this.fms.get(e.id) : undefined;
  }

  private indexar(el: Elemento, ruta: string): void {
    const { id, ref, alias } = el.frontmatter;
    const previa = this.porId.get(id);
    // Una ref que deja de ser la suya y no queda como alias se libera.
    if (previa && previa.ref !== ref && !alias?.includes(previa.ref as never) && this.idPorRef.get(previa.ref) === id)
      this.idPorRef.delete(previa.ref);
    this.porId.set(id, { id, ref, ruta, enPapelera: ruta.startsWith(`${CARPETA_PAPELERA}/`) });
    this.idPorRef.set(ref, id);
    this.indexarAlias(id, alias);
    this.fms.set(id, el.frontmatter);
  }

  /**
   * Los alias (refs anteriores, al cambiar el tipo o al importar) siguen llevando a su elemento y no se vuelven a
   * asignar: `refs()` los incluye. Nunca pisan una ref vigente de otro elemento.
   */
  private indexarAlias(id: string, alias: readonly string[] | undefined): void {
    for (const a of alias ?? []) if (!this.idPorRef.has(a)) this.idPorRef.set(a, id);
  }

  /** Quita del índice todas las refs (la vigente y sus alias) que llevan a un elemento. */
  private olvidarRefs(id: string): void {
    for (const [r, i] of [...this.idPorRef]) if (i === id) this.idPorRef.delete(r);
  }

  /** Entrada del índice por ref o por id. */
  buscar(refOId: string): EntradaIndice | undefined {
    return this.porId.get(this.idPorRef.get(refOId) ?? refOId);
  }

  entradas(): IterableIterator<EntradaIndice> {
    return this.porId.values();
  }

  /** Refs en uso (también las de la papelera y los alias), para asignar la siguiente sin reutilizar ninguna. */
  refs(): IterableIterator<string> {
    return this.idPorRef.keys();
  }

  /** Las escrituras de un mismo elemento van de una en una, en el orden en que se piden. */
  private readonly turnos = new Map<string, Promise<unknown>>();

  private enTurno<T>(id: string, fn: () => Promise<T>): Promise<T> {
    const previo = this.turnos.get(id) ?? Promise.resolve();
    const actual = previo.catch(() => undefined).then(fn);
    const fin = actual.catch(() => undefined);
    this.turnos.set(id, fin);
    void fin.then(() => {
      if (this.turnos.get(id) === fin) this.turnos.delete(id);
    });
    return actual;
  }

  /**
   * Guarda un elemento. Si ya existía, conserva el YAML anterior (orden y comentarios) y, si cambió el
   * título o la ref, renombra el archivo. Devuelve la ruta final.
   */
  async guardarElemento(el: Elemento): Promise<string> {
    this.comprobarEscritura();
    return this.enTurno(el.frontmatter.id, () => this.guardarAhora(el));
  }

  /**
   * Lee el elemento y guarda lo que devuelva `cambio`, sin que otra escritura del mismo elemento se cuele entre
   * medias (lo usan los cambios automáticos, como el resumen de un lector, para no pisar una edición). Si
   * `cambio` devuelve `null`, no se escribe nada.
   */
  async actualizarElemento(refOId: string, cambio: (el: Elemento) => Elemento | null): Promise<Resultado<boolean>> {
    this.comprobarEscritura();
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    return this.enTurno(e.id, async () => {
      const actual = await this.leerElemento(e.id);
      if (!actual.ok) return actual;
      const nuevo = cambio(actual.valor);
      if (!nuevo) return ok(false);
      await this.guardarAhora(nuevo);
      return ok(true);
    });
  }

  private async guardarAhora(el: Elemento): Promise<string> {
    this.comprobarEscritura();
    const previa = this.porId.get(el.frontmatter.id);
    const destino = previa?.enPapelera
      ? `${CARPETA_PAPELERA}/${rutaElemento(el.frontmatter.ref, el.frontmatter.titulo, el.frontmatter.creado)}`
      : rutaElemento(el.frontmatter.ref, el.frontmatter.titulo, el.frontmatter.creado);
    const textoPrevio = previa ? ((await leerTexto(this.almacen, previa.ruta)) ?? undefined) : undefined;
    const datos = codificador.encode(escribirElemento(el, textoPrevio));
    if (previa && previa.ruta !== destino) {
      const origen = previa.ruta;
      await this.conDiario(origen, destino, async () => {
        await this.almacen.escribir(destino, datos);
        await this.almacen.borrar(origen);
      });
    } else await this.almacen.escribir(destino, datos);
    this.indexar(el, destino);
    await this.refrescarCache(el, destino);
    this.cambio();
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
    this.comprobarEscritura();
    const id = this.buscar(refOId)?.id;
    if (!id) return fallo('almacen.noEncontrado', { ref: refOId });
    return this.enTurno(id, () => this.moverAPapeleraAhora(refOId));
  }

  private async moverAPapeleraAhora(refOId: string): Promise<Resultado<string>> {
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    if (e.enPapelera) return ok(e.ruta);
    const destino = `${CARPETA_PAPELERA}/${e.ruta}`;
    await this.conDiario(e.ruta, destino, () => this.almacen.mover(e.ruta, destino));
    this.porId.set(e.id, { ...e, ruta: destino, enPapelera: true });
    await this.refrescarTrasMover(e.id, destino);
    this.cambio();
    return ok(destino);
  }

  async restaurar(refOId: string): Promise<Resultado<string>> {
    this.comprobarEscritura();
    const id = this.buscar(refOId)?.id;
    if (!id) return fallo('almacen.noEncontrado', { ref: refOId });
    return this.enTurno(id, () => this.restaurarAhora(refOId));
  }

  private async restaurarAhora(refOId: string): Promise<Resultado<string>> {
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    if (!e.enPapelera) return ok(e.ruta);
    const destino = e.ruta.slice(CARPETA_PAPELERA.length + 1);
    if (await this.almacen.existe(destino)) {
      // Si el que ocupa el sitio es el mismo elemento (copia que dejó un corte), sobra la de la papelera.
      const ocupante = leerElemento((await leerTexto(this.almacen, destino)) ?? '');
      if (!ocupante.ok || ocupante.valor.frontmatter.id !== e.id)
        return fallo('almacen.destinoOcupado', { ruta: destino });
      await this.almacen.borrar(e.ruta);
    } else await this.conDiario(e.ruta, destino, () => this.almacen.mover(e.ruta, destino));
    this.porId.set(e.id, { ...e, ruta: destino, enPapelera: false });
    await this.refrescarTrasMover(e.id, destino);
    this.cambio();
    return ok(destino);
  }

  /**
   * Borra un elemento para siempre, sin pasar por la papelera (deshacer una captura recién hecha, IN-014).
   * Devuelve `false` si ya no existía.
   */
  async borrarElemento(refOId: string): Promise<boolean> {
    this.comprobarEscritura();
    const id = this.buscar(refOId)?.id;
    if (!id) return false;
    return this.enTurno(id, async () => {
      const e = this.porId.get(id);
      if (!e) return false;
      await this.almacen.borrar(e.ruta);
      this.porId.delete(id);
      this.fms.delete(id);
      this.olvidarRefs(id);
      await this.cache?.borrarElementos([id]);
      this.cambio();
      return true;
    });
  }

  /** Los bytes de un adjunto, o `null` si no está. Leer no necesita el cerrojo. */
  leerAdjunto(ruta: string): Promise<Uint8Array | null> {
    return this.almacen.leer(ruta);
  }

  /** ¿Usa algún elemento conocido (también en la papelera) el adjunto de `ruta`? */
  usaAdjunto(ruta: string): boolean {
    for (const fm of this.fms.values()) if (fm.adjunto?.ruta === ruta) return true;
    return false;
  }

  /** Borra un adjunto si ningún elemento lo usa. Devuelve si lo borró. */
  async borrarAdjunto(ruta: string): Promise<boolean> {
    this.comprobarEscritura();
    if (this.usaAdjunto(ruta)) return false;
    await this.almacen.borrar(ruta);
    return true;
  }

  /** Borra definitivamente lo que hay en la papelera. El ZIP previo lo hace quien llama (IN-035). */
  async vaciarPapelera(): Promise<number> {
    this.comprobarEscritura();
    const entradas = await listarTodo(this.almacen, `${CARPETA_PAPELERA}/`);
    for (const e of entradas) await this.almacen.borrar(e.ruta);
    const borrados: string[] = [];
    for (const [id, e] of [...this.porId]) {
      if (!e.enPapelera) continue;
      this.porId.delete(id);
      this.fms.delete(id);
      borrados.push(id);
      this.olvidarRefs(id);
    }
    await this.cache?.borrarElementos(borrados);
    if (entradas.length) this.cambio();
    return entradas.length;
  }

  private async refrescarTrasMover(id: string, ruta: string): Promise<void> {
    if (!this.cache) return;
    const r = leerElemento((await leerTexto(this.almacen, ruta)) ?? '');
    if (r.ok && r.valor.frontmatter.id === id) await this.refrescarCache(r.valor, ruta);
  }

  /**
   * Guarda un archivo nuevo en `historial/` sin pisar ninguno: `base` es la ruta sin extensión
   * (`historial/PRM-0012/resultado-2026-10-17`); si ya existe, prueba `-2`, `-3`… Devuelve la ruta escrita.
   */
  async guardarEnHistorial(base: string, texto: string): Promise<string> {
    this.comprobarEscritura();
    if (!base.startsWith(`${CARPETA_HISTORIAL}/`)) throw new Error(`Ruta fuera del historial: «${base}»`);
    validarRuta(`${base}.md`);
    // En turno por `base`: dos resultados del mismo día guardados a la vez no eligen la misma ruta.
    return this.enTurno(`historial:${base}`, async () => {
      for (let n = 1; ; n++) {
        const ruta = n === 1 ? `${base}.md` : `${base}-${n}.md`;
        if (await this.almacen.existe(ruta)) continue;
        await escribirTexto(this.almacen, ruta, texto);
        return ruta;
      }
    });
  }

  /** Borra un archivo de `historial/` (el de un resultado que no se llegó a apuntar en su elemento). */
  async borrarDeHistorial(ruta: string): Promise<void> {
    this.comprobarEscritura();
    if (!ruta.startsWith(`${CARPETA_HISTORIAL}/`)) throw new Error(`Ruta fuera del historial: «${ruta}»`);
    await this.almacen.borrar(validarRuta(ruta));
  }

  /** Un archivo de `historial/`, o `null` si no está. Leer no necesita el cerrojo. */
  async leerHistorial(ruta: string): Promise<string | null> {
    if (!ruta.startsWith(`${CARPETA_HISTORIAL}/`)) return null;
    return leerTexto(this.almacen, validarRuta(ruta));
  }

  /** Guarda un adjunto por su hash; si ya existe, no lo reescribe. */
  async guardarAdjunto(bytes: Uint8Array, extension: string): Promise<{ hash: string; ruta: string; nuevo: boolean }> {
    this.comprobarEscritura();
    const hash = sha256Hex(bytes);
    const ruta = rutaAdjunto(hash, extension);
    if (await this.almacen.existe(ruta)) return { hash, ruta, nuevo: false };
    await this.almacen.escribir(ruta, bytes);
    return { hash, ruta, nuevo: true };
  }
}
