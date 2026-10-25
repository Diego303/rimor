/**
 * Cambiar el tipo de un elemento (IN-026, tecla `t`; lo reutiliza IN-027): se vuelve a leer su original con otro
 * lector y se guarda con el tipo, la ref (el prefijo va con el tipo; la vieja queda en `alias` y sigue llevando a
 * él) y el resumen nuevos. El `id` no cambia: las menciones por id siguen valiendo y el archivo se renombra solo.
 */
import { asignarRef, type Elemento, type FrontmatterComun, isoConZona } from '@rimor/formato';
import type { Repositorio } from '../almacen/repositorio';
import { esEstadoComun } from '../espacio/estados';
import { MARCA_PENDIENTE } from '../lectores/archivo/lector';
import type { Lector } from '../lectores/contrato';
import type { Registro } from '../lectores/registro';
import { detectar, entradaDeArchivo } from './detector';
import { decodificarTexto } from './firmas';

/** Tipos que leen bytes: no se puede llegar a ellos (ni salir) cambiando de lector un texto. */
const TIPOS_BINARIOS = new Set(['archivo', 'imagen', 'pdf']);

/** ¿Se puede cambiar este elemento a este lector? Solo entre lectores de texto, y a otro distinto. */
export function sePuedeCambiar(el: Pick<Elemento, 'frontmatter'>, lector: Pick<Lector, 'tipo' | 'nombre'>): boolean {
  const fm = el.frontmatter;
  return !TIPOS_BINARIOS.has(fm.tipo) && !TIPOS_BINARIOS.has(lector.tipo) && fm.lector.nombre !== lector.nombre;
}

/** El texto original, esté en el `.md` o en un adjunto (los textos grandes). */
async function textoDe(el: Elemento, repositorio: Repositorio): Promise<string | null> {
  if (el.original !== null) return el.original;
  const ruta = el.frontmatter.adjunto?.ruta;
  if (!ruta) return null;
  const bytes = await repositorio.leerAdjunto(ruta);
  return bytes ? (decodificarTexto(bytes)?.texto ?? null) : null;
}

export interface OpcionesCambio {
  /** El lector de ahora: sus claves propias del frontmatter (`url`, `vuelve`…) no pasan al nuevo. */
  anterior?: Lector;
  reloj?: () => Date;
}

/**
 * El frontmatter con el tipo nuevo: sin las claves propias del lector anterior, con las del nuevo, y con el estado
 * solo si es común o del tipo nuevo (si no, el que dé el lector nuevo, como `semilla` en una idea).
 */
export function frontmatterConTipo(
  fm: FrontmatterComun,
  lector: Lector,
  datos: {
    ref: string;
    resumen: Record<string, unknown>;
    metadatos: Record<string, unknown>;
    viejas: readonly string[];
  },
  ahora: Date,
): FrontmatterComun {
  const base: Record<string, unknown> = { ...fm };
  for (const clave of datos.viejas) delete base[clave];
  // Un estado común (lo decidió quien lo usa) o válido en el tipo nuevo se conserva y gana al que traiga el lector
  // nuevo; uno propio del tipo anterior se quita (y vale el del lector nuevo, como `semilla` en una idea).
  const estado = fm.estado && (esEstadoComun(fm.estado) || lector.estados?.includes(fm.estado)) ? fm.estado : null;
  delete base.estado;
  // El alias: todas las refs que tuvo, sin la que vuelve a tener (ida y vuelta) y sin repetir.
  const alias = [...new Set([...(fm.alias ?? []), fm.ref])].filter((r) => r !== datos.ref);
  return {
    ...base,
    ...datos.metadatos,
    ...(estado ? { estado } : {}),
    tipo: lector.tipo,
    ref: datos.ref,
    alias,
    lector: { nombre: lector.nombre, version: lector.version, resumen: datos.resumen },
    modificado: isoConZona(ahora),
  } as FrontmatterComun;
}

/**
 * Cambia el tipo. Devuelve la ref nueva, o `null` si no se pudo: binario, sin original, mismo lector, el lector
 * nuevo no sabe leerlo, o el elemento cambió mientras se leía (no se pisa una edición).
 */
export async function cambiarTipo(
  refOId: string,
  lector: Lector,
  repositorio: Repositorio,
  { anterior, reloj = () => new Date() }: OpcionesCambio = {},
): Promise<string | null> {
  const leido = await repositorio.leerElemento(refOId);
  if (!leido.ok || !sePuedeCambiar(leido.valor, lector)) return null;
  const el = leido.valor;
  const texto = await textoDe(el, repositorio);
  if (texto === null) return null;
  const nombre = el.frontmatter.adjunto?.nombre;
  const entrada = { texto, ...(nombre ? { nombre } : {}) };
  // Si el lector nuevo no sabe leerlo, no se guarda nada a medias.
  const borrador = await lector.leer(entrada).catch(() => null);
  if (!borrador) return null;
  const previo = anterior ? await anterior.leer(entrada).catch(() => null) : null;
  const viejas = Object.keys(previo?.metadatos ?? {});
  let nueva: string | null = null;
  const r = await repositorio.actualizarElemento(el.frontmatter.id, (actual) => {
    // En turno: si el elemento cambió mientras se leía (otra edición), no se pisa.
    if (actual.frontmatter.hash !== el.frontmatter.hash || actual.frontmatter.ref !== el.frontmatter.ref) return null;
    // Entre lectores del mismo tipo (Código y Diff) la ref no cambia: el prefijo es el mismo.
    nueva =
      actual.frontmatter.tipo === lector.tipo ? actual.frontmatter.ref : asignarRef(lector.tipo, repositorio.refs());
    return {
      ...actual,
      frontmatter: frontmatterConTipo(
        actual.frontmatter,
        lector,
        { ref: nueva, resumen: borrador.resumen ?? {}, metadatos: borrador.metadatos ?? {}, viejas },
        reloj(),
      ),
    };
  });
  return r.ok && r.valor ? nueva : null;
}

/**
 * Los archivos guardados con el lector genérico porque aún no tenían el suyo (`pendiente_lector`, IN-017) se releen
 * con el que ahora los reconoce (un Parquet de antes de IN-044): tipo, ref, resumen y sin la marca. Solo con un
 * lector de binarios, que guarda el adjunto tal cual (como el genérico). Devuelve las refs nuevas.
 */
export async function releerPendientes(
  repositorio: Repositorio,
  registro: Registro,
  { reloj = () => new Date() }: Pick<OpcionesCambio, 'reloj'> = {},
): Promise<string[]> {
  const nuevas: string[] = [];
  const pendientes = repositorio
    .elementos()
    .filter((fm) => fm.lector.nombre === 'archivo' && (fm as Record<string, unknown>)[MARCA_PENDIENTE] && fm.adjunto);
  for (const fm of pendientes) {
    const adjunto = fm.adjunto;
    if (!adjunto) continue;
    const nombre = adjunto.nombre ?? fm.titulo;
    const mime = adjunto.mime ?? '';
    // Sin leerlo: si ni por su nombre ni por su tipo lo reclama un lector (un vídeo, un ZIP), no se lee el adjunto
    // entero en cada apertura. Uno renombrado (un Parquet sin `.parquet`) se queda pendiente.
    const porNombre = detectar({ archivos: [new File([], nombre, { type: mime })], nombre, mime }, registro).lector;
    if (!porNombre || porNombre === 'archivo') continue;
    const bytes = await repositorio.leerAdjunto(adjunto.ruta).catch(() => null);
    if (!bytes) continue;
    const { entrada, cabecera } = entradaDeArchivo(nombre, mime, bytes);
    const detectado = detectar(entrada, registro, { cabecera }).lector;
    const lector = detectado ? registro.porNombre(detectado) : undefined;
    if (!lector || lector.nombre === 'archivo') continue;
    const borrador = await lector.leer(entrada).catch(() => null);
    if (!borrador || borrador.original !== null) continue;
    let nueva: string | null = null;
    const r = await repositorio.actualizarElemento(fm.id, (actual) => {
      // Si cambió mientras se leía (otra pestaña ya lo releyó, o se editó), no se pisa.
      if (actual.frontmatter.hash !== fm.hash || actual.frontmatter.lector.nombre !== 'archivo') return null;
      nueva = asignarRef(lector.tipo, repositorio.refs());
      return {
        ...actual,
        frontmatter: frontmatterConTipo(
          actual.frontmatter,
          lector,
          {
            ref: nueva,
            resumen: borrador.resumen ?? {},
            metadatos: borrador.metadatos ?? {},
            viejas: [MARCA_PENDIENTE],
          },
          reloj(),
        ),
      };
    });
    if (r.ok && r.valor && nueva) nuevas.push(nueva);
  }
  return nuevas;
}
