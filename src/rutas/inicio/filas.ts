/**
 * Las filas del feed de Inicio (ORG-01): separadores de día y mensajes en orden cronológico (lo más reciente
 * abajo, junto al compositor, como en un chat), con las búsquedas del compositor y las ideas que vuelven
 * intercaladas en «Hoy». Puro: la vista solo pinta lo que sale de aquí.
 */
import type { FrontmatterComun } from '@rimor/formato';
import type { BusquedaPendiente } from '../../captura/compositor';
import { sinClasificar } from '../../espacio/resumen';
import { fmtDia, type Idioma } from '../../i18n/formatos';

export type Filtro = 'todo' | 'sinClasificar';

export type FilaFeed =
  | { t: 'dia'; clave: string; etiqueta: string }
  | { t: 'mensaje'; clave: string; fm: FrontmatterComun }
  | { t: 'busqueda'; clave: string; busqueda: BusquedaPendiente }
  | { t: 'ideas'; clave: string };

/** El día civil (`AAAA-MM-DD`) de un instante, en la zona del equipo. */
export function claveDia(instante: string | Date): string {
  const fecha = typeof instante === 'string' ? new Date(instante) : instante;
  if (Number.isNaN(fecha.getTime())) return '';
  // A mano y no con `isoConZona`: se calcula para cada elemento del feed (miles).
  const mes = fecha.getMonth() + 1;
  const dia = fecha.getDate();
  return `${fecha.getFullYear()}-${mes < 10 ? '0' : ''}${mes}-${dia < 10 ? '0' : ''}${dia}`;
}

/** «Hoy», «Ayer» o el día («15 oct»; con año si no es el actual). */
export function etiquetaDia(clave: string, ahora: Date, idioma: Idioma, textos: { hoy: string; ayer: string }): string {
  const hoy = claveDia(ahora);
  if (clave === hoy) return textos.hoy;
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  if (clave === claveDia(ayer)) return textos.ayer;
  // Las 12:00 del día, para que ningún cambio de hora lo mueva al día de al lado.
  return fmtDia(new Date(`${clave}T12:00:00`), ahora, idioma);
}

/** ¿Sale en el feed con este filtro? Los archivados, solo si se buscan aparte (no en el feed). */
export const visibleCon = (fm: FrontmatterComun, filtro: Filtro) =>
  filtro === 'sinClasificar' ? sinClasificar(fm) : fm.estado !== 'archivado';

/** Los días con algo que enseñar, del más reciente al más antiguo, con cuántos mensajes tiene cada uno. */
export function diasConMensajes(
  elementos: readonly FrontmatterComun[],
  filtro: Filtro,
): { clave: string; n: number }[] {
  const n = new Map<string, number>();
  for (const fm of elementos) {
    if (!visibleCon(fm, filtro)) continue;
    const dia = claveDia(fm.creado);
    if (dia) n.set(dia, (n.get(dia) ?? 0) + 1);
  }
  return [...n].map(([clave, k]) => ({ clave, n: k })).sort((a, b) => (a.clave < b.clave ? 1 : -1));
}

/** Días que se cargan de una vez: al empezar y cada vez que se llega arriba. */
export const DIAS_POR_TANDA = 7;
/** Mensajes mínimos de la primera carga (si los últimos 7 días traen pocos, se cargan más días). */
export const MINIMO_INICIAL = 50;

/** Cuántos días (de los que tienen algo, del más reciente hacia atrás) se pintan al empezar. */
export function diasIniciales(dias: readonly { n: number }[]): number {
  let total = 0;
  let k = 0;
  while (k < dias.length && (k < DIAS_POR_TANDA || total < MINIMO_INICIAL)) total += dias[k++]?.n ?? 0;
  return k;
}

export interface OpcionesFeed {
  filtro: Filtro;
  /** Cuántos días con algo, empezando por el más reciente. */
  dias: number;
  ahora: Date;
  idioma: Idioma;
  textos: { hoy: string; ayer: string };
  busquedas?: readonly BusquedaPendiente[];
  /** Si hay ideas que vuelven: van al principio de «Hoy». */
  conIdeas?: boolean;
}

/** Las filas que pinta la lista virtual, en orden cronológico. */
export function filasDelFeed(elementos: readonly FrontmatterComun[], o: OpcionesFeed): FilaFeed[] {
  const hoy = claveDia(o.ahora);
  const delDia = new Map<string, { cuando: number; fila: FilaFeed }[]>();
  const anotar = (dia: string, cuando: number, fila: FilaFeed) => {
    const lista = delDia.get(dia) ?? [];
    lista.push({ cuando, fila });
    delDia.set(dia, lista);
  };
  const conMensajes = new Set<string>();
  for (const fm of elementos) {
    if (!visibleCon(fm, o.filtro)) continue;
    const dia = claveDia(fm.creado);
    if (!dia) continue;
    conMensajes.add(dia);
    anotar(dia, Date.parse(fm.creado), { t: 'mensaje', clave: fm.id, fm });
  }
  // Las búsquedas son de esta sesión: siempre en su día (normalmente, hoy) y en los dos filtros.
  for (const [i, b] of (o.busquedas ?? []).entries()) {
    const dia = claveDia(b.en);
    if (dia) anotar(dia, Date.parse(b.en), { t: 'busqueda', clave: `busqueda:${i}`, busqueda: b });
  }
  if (o.conIdeas && o.filtro === 'todo') anotar(hoy, Number.NEGATIVE_INFINITY, { t: 'ideas', clave: 'ideas' });

  // Los días cargados se cuentan por sus mensajes (como `diasConMensajes`); el de una búsqueda o el de las ideas
  // (hoy) se añade siempre, sin quitarle el sitio a otro.
  const cargados = new Set([...conMensajes].sort((a, b) => (a < b ? 1 : -1)).slice(0, Math.max(1, o.dias)));
  const dias = [...delDia.keys()].filter((d) => cargados.has(d) || !conMensajes.has(d)).sort();
  const filas: FilaFeed[] = [];
  for (const dia of dias) {
    filas.push({ t: 'dia', clave: `dia:${dia}`, etiqueta: etiquetaDia(dia, o.ahora, o.idioma, o.textos) });
    const lista = delDia.get(dia) ?? [];
    lista.sort((a, b) => a.cuando - b.cuando);
    for (const { fila } of lista) filas.push(fila);
  }
  return filas;
}

/** Texto sin acentos ni mayúsculas, para buscar. */
export const normalizar = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Resultados que enseña un mensaje de búsqueda (el resto, en Buscar). */
export const RESULTADOS_EN_FEED = 5;

/**
 * Búsqueda en lo que el repositorio tiene en memoria (título, ref, colecciones, etiquetas y lo que diga `legible`:
 * el nombre del tipo en el idioma de la interfaz y el resumen del lector), con todas las palabras, sin acentos. No
 * busca por el nombre interno del tipo (`texto` casaría con «text»). La sustituye el buscador completo (IN-032).
 * Primero lo que lo tiene en el título; después, lo más reciente.
 */
export function buscarEnMemoria(
  elementos: readonly FrontmatterComun[],
  consulta: string,
  legible: (fm: FrontmatterComun) => string = () => '',
): { total: number; resultados: FrontmatterComun[] } {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean);
  if (!palabras.length) return { total: 0, resultados: [] };
  const hallados: { fm: FrontmatterComun; enTitulo: boolean }[] = [];
  for (const fm of elementos) {
    const titulo = normalizar(fm.titulo);
    const resto = normalizar([fm.ref, ...(fm.colecciones ?? []), ...(fm.etiquetas ?? []), legible(fm)].join(' '));
    if (!palabras.every((p) => titulo.includes(p) || resto.includes(p))) continue;
    hallados.push({ fm, enTitulo: palabras.every((p) => titulo.includes(p)) });
  }
  hallados.sort((a, b) => Number(b.enTitulo) - Number(a.enTitulo) || Date.parse(b.fm.creado) - Date.parse(a.fm.creado));
  return { total: hallados.length, resultados: hallados.slice(0, RESULTADOS_EN_FEED).map((h) => h.fm) };
}
