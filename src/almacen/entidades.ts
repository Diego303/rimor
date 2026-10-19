/**
 * Repositorio de entidades (comparaciones; después hilos, investigaciones y documentos, plan §13.2): cada una en su
 * carpeta (`comparaciones/CMP-0005--titulo.md`), con el índice id/ref → ruta y el frontmatter en memoria. Son pocas
 * y pequeñas: se leen enteras al cargar, sin caché. Como el de elementos: las escrituras de una entidad van en
 * turno, renombrar el archivo al cambiar el título pasa por el diario, y solo escribe la pestaña que puede.
 */
import {
  asignarRef,
  CARPETAS,
  type Entidad,
  escribirEntidad,
  type FrontmatterEntidad,
  type FrontmatterEntidades,
  fallo,
  leerEntidad,
  ok,
  type Resultado,
  rutaEntidad,
  type TipoEntidad,
} from '@rimor/formato';
import { type Almacen, leerTexto, listarTodo } from './contrato';
import { ErrorSoloLectura } from './repositorio';
import { conDiario, Turnos, terminarDiario } from './turnos';

/** Diario propio: una operación de entidades no pisa la de elementos que pudiera estar a medias. */
export const RUTA_DIARIO_ENTIDADES = '.rimor/operacion-entidades.json';

interface Entrada {
  id: string;
  ref: string;
  ruta: string;
  fm: FrontmatterEntidad;
}

export interface OpcionesEntidades {
  /** Se llama tras cada cambio en los archivos de entidades. */
  alCambiar?: () => void;
  /** Si devuelve `false` (otra pestaña escribe), cualquier escritura falla con `almacen.soloLectura`. */
  puedeEscribir?: () => boolean;
}

const codificador = new TextEncoder();

export class RepositorioEntidades {
  private readonly porId = new Map<string, Entrada>();
  private readonly idPorRef = new Map<string, string>();
  private readonly turnos = new Turnos();

  constructor(
    private readonly almacen: Almacen,
    /** Los tipos de entidad que se leen (sus carpetas). */
    private readonly tipos: readonly TipoEntidad[],
    private readonly opciones: OpcionesEntidades = {},
  ) {}

  escribible(): boolean {
    return !this.opciones.puedeEscribir || this.opciones.puedeEscribir();
  }

  /**
   * Lee las carpetas de sus tipos y rehace el índice. Devuelve los archivos que no se pudieron leer (o que están
   * en la carpeta de otro tipo, o repiten un id). Con `recuperar` (la pestaña escribe o va a escribir; al heredar
   * la escritura aún no puede), antes termina la operación que quedó a medias según el diario.
   */
  async cargar({
    recuperar = this.escribible(),
  }: {
    recuperar?: boolean;
  } = {}): Promise<{ ruta: string; codigo: string }[]> {
    if (recuperar) await terminarDiario(this.almacen, RUTA_DIARIO_ENTIDADES);
    const fallidos: { ruta: string; codigo: string }[] = [];
    const leidas: Entrada[] = [];
    const refsDeArchivos = new Set<string>();
    for (const tipo of this.tipos) {
      for (const { ruta } of await listarTodo(this.almacen, `${CARPETAS[tipo]}/`)) {
        if (!ruta.endsWith('.md')) continue;
        // La ref del nombre cuenta aunque el archivo no se pueda leer: no se vuelve a asignar (ni se pisa).
        const delNombre = /^([A-Z]+(?:-[A-Z]+)*-\d{4,})--/.exec(ruta.slice(ruta.lastIndexOf('/') + 1))?.[1];
        if (delNombre) refsDeArchivos.add(delNombre);
        const r = leerEntidad((await leerTexto(this.almacen, ruta)) ?? '');
        if (!r.ok) fallidos.push({ ruta, codigo: r.error.codigo });
        else if (r.valor.frontmatter.tipo !== tipo) fallidos.push({ ruta, codigo: 'entidad.carpetaEquivocada' });
        else leidas.push({ id: r.valor.frontmatter.id, ref: r.valor.frontmatter.ref, ruta, fm: r.valor.frontmatter });
      }
    }
    this.porId.clear();
    this.idPorRef.clear();
    this.refsOcupadas = refsDeArchivos;
    for (const e of leidas) {
      const previa = this.porId.get(e.id);
      // Dos archivos con el mismo id (un corte a mitad de renombrar): gana el que está en su sitio y, si lo están
      // los dos, el modificado más tarde.
      if (previa) {
        const enSuSitio = (x: Entrada) => x.ruta === rutaEntidad(x.fm.tipo, x.ref, x.fm.titulo);
        const fecha = (x: Entrada) => Date.parse(x.fm.modificado ?? x.fm.creado ?? '') || 0;
        const queda =
          enSuSitio(previa) !== enSuSitio(e) ? (enSuSitio(previa) ? previa : e) : fecha(e) > fecha(previa) ? e : previa;
        fallidos.push({ ruta: (queda === previa ? e : previa).ruta, codigo: 'entidad.duplicada' });
        if (queda === previa) continue;
      }
      this.porId.set(e.id, e);
    }
    for (const e of this.porId.values()) this.idPorRef.set(e.ref, e.id);
    return fallidos;
  }

  /** El frontmatter de las entidades de un tipo. */
  lista<T extends TipoEntidad>(tipo: T): FrontmatterEntidades[T][] {
    return [...this.porId.values()].filter((e) => e.fm.tipo === tipo).map((e) => e.fm as FrontmatterEntidades[T]);
  }

  /** Frontmatter de una entidad por ref o id, sin abrir su archivo. */
  frontmatter(refOId: string): FrontmatterEntidad | undefined {
    return this.buscar(refOId)?.fm;
  }

  private buscar(refOId: string): Entrada | undefined {
    return this.porId.get(this.idPorRef.get(refOId) ?? refOId);
  }

  /** Refs de los archivos que hay (también de los que no se pudieron leer). */
  private refsOcupadas = new Set<string>();

  /** Refs en uso (también las de archivos que no se pudieron leer), para asignar la siguiente sin repetir. */
  refs(): IterableIterator<string> {
    return new Set([...this.idPorRef.keys(), ...this.refsOcupadas]).values();
  }

  /**
   * Crea una entidad nueva con la siguiente ref libre de su tipo: la ref se asigna y la entidad se guarda en el
   * mismo turno (dos creaciones a la vez no se llevan la misma). Devuelve la ref.
   */
  crear(tipo: TipoEntidad, hacer: (ref: string) => Entidad): Promise<string> {
    this.comprobarEscritura();
    return this.turnos.en(`crear:${tipo}`, async () => {
      const ref = asignarRef(tipo, this.refs());
      const entidad = hacer(ref);
      if (entidad.frontmatter.ref !== ref || entidad.frontmatter.tipo !== tipo)
        throw new Error(`La entidad nueva debe ser ${tipo} con la ref ${ref}`);
      await this.turnos.en(entidad.frontmatter.id, () => this.guardarAhora(entidad));
      return ref;
    });
  }

  async leer(refOId: string): Promise<Resultado<Entidad>> {
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    const texto = await leerTexto(this.almacen, e.ruta);
    if (texto === null) return fallo('almacen.noEncontrado', { ref: refOId });
    return leerEntidad(texto);
  }

  /** Guarda una entidad (nueva o no), conservando su YAML previo y renombrando si cambió el título. */
  guardar(entidad: Entidad): Promise<string> {
    this.comprobarEscritura();
    return this.turnos.en(entidad.frontmatter.id, () => this.guardarAhora(entidad));
  }

  /**
   * Lee la entidad y guarda lo que devuelva `cambio`, sin que otra escritura de la misma se cuele entre medias.
   * Si `cambio` devuelve `null`, no se escribe nada.
   */
  async actualizar(refOId: string, cambio: (e: Entidad) => Entidad | null): Promise<Resultado<boolean>> {
    this.comprobarEscritura();
    const e = this.buscar(refOId);
    if (!e) return fallo('almacen.noEncontrado', { ref: refOId });
    return this.turnos.en(e.id, async () => {
      const actual = await this.leer(e.id);
      if (!actual.ok) return actual;
      const nueva = cambio(actual.valor);
      if (!nueva) return ok(false);
      await this.guardarAhora(nueva);
      return ok(true);
    });
  }

  private async guardarAhora(entidad: Entidad): Promise<string> {
    this.comprobarEscritura();
    const fm = entidad.frontmatter;
    const previa = this.porId.get(fm.id);
    const destino = rutaEntidad(fm.tipo, fm.ref, fm.titulo);
    // Una ref que ya es de otra entidad (o de un archivo que no se pudo leer) no se pisa.
    const duena = this.idPorRef.get(fm.ref);
    if ((duena && duena !== fm.id) || (!previa && this.refsOcupadas.has(fm.ref)))
      throw new Error(`entidad.refOcupada: ${fm.ref}`);
    if (previa?.ruta !== destino && (await this.almacen.existe(destino)))
      throw new Error(`entidad.destinoOcupado: ${destino}`);
    const textoPrevio = previa ? ((await leerTexto(this.almacen, previa.ruta)) ?? undefined) : undefined;
    const datos = codificador.encode(escribirEntidad(entidad, textoPrevio));
    if (previa && previa.ruta !== destino) {
      const origen = previa.ruta;
      await conDiario(this.almacen, RUTA_DIARIO_ENTIDADES, origen, destino, async () => {
        await this.almacen.escribir(destino, datos);
        await this.almacen.borrar(origen);
      });
    } else await this.almacen.escribir(destino, datos);
    if (previa && previa.ref !== fm.ref) this.idPorRef.delete(previa.ref);
    this.porId.set(fm.id, { id: fm.id, ref: fm.ref, ruta: destino, fm });
    this.idPorRef.set(fm.ref, fm.id);
    this.opciones.alCambiar?.();
    return destino;
  }

  private comprobarEscritura(): void {
    if (!this.escribible()) throw new ErrorSoloLectura();
  }
}
