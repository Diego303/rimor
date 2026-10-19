/**
 * Repositorio de elementos sobre un Almacen: guarda y lee `.md` con @rimor/formato, mantiene el índice
 * id/ref → ruta, renombra al cambiar el título (el id nunca cambia), papelera y adjuntos sin duplicados.
 */
import {
  type Elemento,
  escribirElemento,
  type FrontmatterComun,
  fallo,
  isoConZona,
  leerElemento,
  ok,
  type Resultado,
  rutaAdjunto,
  rutaElemento,
  rutaHistorial,
  sha256Hex,
} from '@rimor/formato';
import type { EntradaFrontmatter } from './cache/cache';
import { type Almacen, escribirTexto, leerTexto, listarTodo, validarRuta } from './contrato';
import { conDiario, Turnos, terminarDiario } from './turnos';

export const CARPETA_PAPELERA = 'papelera';
/** Versiones anteriores y resultados de los elementos (plan §13.2). */
export const CARPETA_HISTORIAL = 'historial';
/** Diario de la operación de varios pasos en curso (renombrar, papelera, restaurar): si se corta, se termina al cargar. */
export const RUTA_DIARIO = '.rimor/operacion.json';

/** Lo que se copió de la papelera (ver `copiaDePapelera`). */
export interface CopiaPapelera {
  /** Los elementos que entraron en la copia. */
  ids: string[];
  /** Los adjuntos que entraron (los que solo usaban ellos). */
  adjuntos: string[];
  archivos: { ruta: string; datos: Uint8Array }[];
}

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

/** Por qué se guardó una copia en el historial. */
export type MotivoHistorial = 'version' | 'edicion' | 'restaurar' | 'importacion';
const MOTIVOS_HISTORIAL: readonly MotivoHistorial[] = ['version', 'edicion', 'restaurar', 'importacion'];
const esMotivo = (x: unknown): x is MotivoHistorial => MOTIVOS_HISTORIAL.includes(x as MotivoHistorial);

/** El nombre de una copia del historial: su fecha (y `-2`… si hubo dos en el mismo segundo). */
const COPIA_HISTORIAL = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}(?:-\d+)?\.md$/;

/** Una copia del historial de un elemento. */
export interface VersionGuardada {
  ruta: string;
  /** La versión que era (sin `version`, la 1). */
  version: number;
  /** Cuándo dejó de ser la actual. */
  reemplazado: string;
  motivo: MotivoHistorial | null;
  /** El elemento tal como era (sin la anotación del historial). */
  elemento: Elemento;
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
export function recuperarOperacion(almacen: Almacen): Promise<void> {
  return terminarDiario(almacen, RUTA_DIARIO);
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
  private conDiario(de: string, a: string, paso: () => Promise<void>): Promise<void> {
    return conDiario(this.almacen, RUTA_DIARIO, de, a, paso);
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

  /** Frontmatter de los elementos que están en la papelera. */
  enPapelera(): FrontmatterComun[] {
    return [...this.fms].filter(([id]) => this.porId.get(id)?.enPapelera).map(([, fm]) => fm);
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
  private readonly turnos = new Turnos();

  private enTurno<T>(id: string, fn: () => Promise<T>): Promise<T> {
    return this.turnos.en(id, fn);
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

  /**
   * Copia de lo que hay ahora en la papelera, para el ZIP previo a vaciarla: los archivos de sus elementos y los
   * adjuntos que solo usan ellos, con sus rutas en el espacio. Dice qué elementos y adjuntos entraron, que son
   * lo único que `vaciarPapelera` borrará después.
   */
  async copiaDePapelera(): Promise<CopiaPapelera> {
    const copia: CopiaPapelera = { ids: [], adjuntos: [], archivos: [] };
    for (const e of this.dePapelera()) {
      const datos = await this.almacen.leer(e.ruta);
      // Si ya no está (se restauró mientras tanto), no entra en la copia ni se borrará.
      if (!datos) continue;
      copia.ids.push(e.id);
      copia.archivos.push({ ruta: e.ruta, datos });
    }
    for (const ruta of this.adjuntosSoloDe(copia.ids)) {
      const datos = await this.almacen.leer(ruta);
      if (!datos) continue;
      copia.adjuntos.push(ruta);
      copia.archivos.push({ ruta, datos });
    }
    return copia;
  }

  /**
   * Borra para siempre lo que hay en la papelera: todo o, con `copiado`, solo los elementos y adjuntos que
   * entraron en el ZIP previo (lo hace quien llama). Cada elemento se borra en su turno y solo si sigue en la
   * papelera (restaurar a la vez gana); un adjunto, solo si ya no lo usa nadie. Si falla a medias, lo borrado ya
   * no está en el índice y el resto sigue en la papelera. Devuelve cuántos elementos se borraron.
   */
  async vaciarPapelera(copiado?: Pick<CopiaPapelera, 'ids' | 'adjuntos'>): Promise<number> {
    this.comprobarEscritura();
    const ids = copiado ? copiado.ids : this.dePapelera().map((e) => e.id);
    const adjuntos = copiado ? copiado.adjuntos : this.adjuntosSoloDe(ids);
    let borrados = 0;
    try {
      for (const id of ids) {
        const borrado = await this.enTurno(id, async () => {
          const e = this.porId.get(id);
          if (!e?.enPapelera) return false;
          await this.almacen.borrar(e.ruta);
          this.porId.delete(id);
          this.fms.delete(id);
          this.olvidarRefs(id);
          await this.cache?.borrarElementos([id]);
          return true;
        });
        if (borrado) borrados++;
      }
      for (const ruta of adjuntos) if (!this.usaAdjunto(ruta)) await this.almacen.borrar(ruta);
      // Sin copia, también lo que haya en la carpeta sin estar en el índice (un archivo que no se pudo leer).
      if (!copiado) {
        const conocidas = new Set([...this.porId.values()].map((e) => e.ruta));
        for (const e of await listarTodo(this.almacen, `${CARPETA_PAPELERA}/`))
          if (!conocidas.has(e.ruta)) await this.almacen.borrar(e.ruta);
      }
    } finally {
      if (borrados) this.cambio();
    }
    return borrados;
  }

  /** Las entradas de la papelera. */
  private dePapelera(): EntradaIndice[] {
    return [...this.porId.values()].filter((e) => e.enPapelera);
  }

  /** Los adjuntos que usan los elementos `ids` y ningún otro. */
  private adjuntosSoloDe(ids: readonly string[]): string[] {
    const elegidos = new Set(ids);
    const suyos = new Set(ids.flatMap((id) => this.fms.get(id)?.adjunto?.ruta ?? []));
    for (const [id, fm] of this.fms) if (!elegidos.has(id) && fm.adjunto) suyos.delete(fm.adjunto.ruta);
    return [...suyos];
  }

  private async refrescarTrasMover(id: string, ruta: string): Promise<void> {
    if (!this.cache) return;
    const r = leerElemento((await leerTexto(this.almacen, ruta)) ?? '');
    if (r.ok && r.valor.frontmatter.id === id) await this.refrescarCache(r.valor, ruta);
  }

  /**
   * Cambia un elemento dejando antes una copia entera del actual en `historial/REF/fecha.md` (DAT-08), en el turno
   * del elemento. Si cambia el original, el nuevo sube `version`; si solo cambian las notas o el título (una
   * edición), la copia queda con la misma versión. Si `cambio` devuelve `null` o no cambia nada, no se escribe ni
   * se copia. Devuelve la ruta de la copia (o `null`) y la versión que queda.
   */
  async guardarConHistorial(
    refOId: string,
    cambio: (el: Elemento) => Elemento | null,
    motivo: MotivoHistorial,
    ahora: () => Date = () => new Date(),
  ): Promise<Resultado<{ copia: string | null; version: number }>> {
    this.comprobarEscritura();
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    return this.enTurno(e.id, async () => {
      const leido = await this.leerElemento(e.id);
      if (!leido.ok) return leido;
      const actual = leido.valor;
      const version = actual.frontmatter.version ?? 1;
      const nuevo = cambio(actual);
      if (!nuevo || escribirElemento(nuevo) === escribirElemento(actual)) return ok({ copia: null, version });
      const cuando = isoConZona(ahora());
      const copia: Elemento = {
        ...actual,
        frontmatter: { ...actual.frontmatter, historial: { motivo, reemplazado: cuando } } as FrontmatterComun,
      };
      const base = rutaHistorial(actual.frontmatter.ref, cuando).replace(/\.md$/, '');
      const ruta = await this.guardarEnHistorial(base, escribirElemento(copia));
      const otroOriginal = nuevo.original !== actual.original || nuevo.frontmatter.hash !== actual.frontmatter.hash;
      const siguiente = otroOriginal ? version + 1 : version;
      const { version: _, ...sinVersion } = nuevo.frontmatter;
      await this.guardarAhora({
        ...nuevo,
        frontmatter: (siguiente > 1 ? { ...sinVersion, version: siguiente } : sinVersion) as FrontmatterComun,
      });
      return ok({ copia: ruta, version: siguiente });
    });
  }

  /**
   * Las copias del historial de un elemento (también las de sus refs anteriores), de la más reciente a la más
   * antigua: solo las de versiones y ediciones (no los resultados de un prompt, que viven en la misma carpeta).
   */
  async versiones(refOId: string): Promise<VersionGuardada[]> {
    const e = this.buscar(refOId);
    const fm = e ? this.fms.get(e.id) : undefined;
    if (!e || !fm) return [];
    const lista: VersionGuardada[] = [];
    for (const ref of new Set([fm.ref, ...(fm.alias ?? [])])) {
      for (const { ruta } of await listarTodo(this.almacen, `${CARPETA_HISTORIAL}/${ref}/`)) {
        if (!COPIA_HISTORIAL.test(ruta.slice(ruta.lastIndexOf('/') + 1))) continue;
        const r = leerElemento((await leerTexto(this.almacen, ruta)) ?? '');
        if (!r.ok || r.valor.frontmatter.id !== e.id) continue;
        const { historial, ...frontmatter } = r.valor.frontmatter as FrontmatterComun & { historial?: unknown };
        const h = (historial ?? {}) as { motivo?: unknown; reemplazado?: unknown };
        lista.push({
          ruta,
          version: frontmatter.version ?? 1,
          reemplazado: typeof h.reemplazado === 'string' ? h.reemplazado : frontmatter.modificado,
          motivo: esMotivo(h.motivo) ? h.motivo : null,
          elemento: { ...r.valor, frontmatter: frontmatter as FrontmatterComun },
        });
      }
    }
    // En el mismo segundo, la que lleva `-2`, `-3`… es posterior.
    const orden = (ruta: string) => Number(/T\d{2}-\d{2}-\d{2}-(\d+)\.md$/.exec(ruta)?.[1] ?? 1);
    return lista.sort((a, b) => Date.parse(b.reemplazado) - Date.parse(a.reemplazado) || orden(b.ruta) - orden(a.ruta));
  }

  /**
   * Deshace un `guardarConHistorial` recién hecho: la copia vuelve a ser el elemento y se borra del historial.
   * Solo si el elemento sigue como quedó (`hash` y `version`); si alguien lo cambió después, no toca nada.
   */
  async deshacerHistorial(refOId: string, copia: string, como: { hash: string; version: number }): Promise<boolean> {
    this.comprobarEscritura();
    const e = this.buscar(refOId);
    if (!e) return false;
    return this.enTurno(e.id, async () => {
      const actual = this.fms.get(e.id);
      if (!actual || actual.hash !== como.hash || (actual.version ?? 1) !== como.version) return false;
      const r = leerElemento((await leerTexto(this.almacen, copia)) ?? '');
      if (!r.ok || r.valor.frontmatter.id !== e.id) return false;
      const { historial: _, ...frontmatter } = r.valor.frontmatter as FrontmatterComun & { historial?: unknown };
      // Si cambió de tipo después (otra ref), la copia ya no es lo que había justo antes.
      if (frontmatter.ref !== actual.ref) return false;
      await this.guardarAhora({ ...r.valor, frontmatter: frontmatter as FrontmatterComun });
      await this.almacen.borrar(validarRuta(copia));
      return true;
    });
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
