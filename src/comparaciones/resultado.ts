/**
 * Lo que una comparación guarda en su `resultado` (pequeño: para citar sus cifras sin recalcular) y sus cifras
 * citables (`{{CMP-0004.cambio}}`). Lleva el hash del original de cada fuente: si alguna cambia, la comparación se
 * recalcula. TS puro.
 */
import { fmtCifra, fmtNumero, fmtP, type Idioma } from '../i18n/formatos';
import { escalaDe, formatosDe } from '../lectores/mediciones/lector';
import type { ClaseComparacion } from './clases';
import type { ComparacionDatos } from './datos';
import type { ComparacionJson } from './json';
import type { ComparacionLogs } from './logs';
import type { ComparacionMediciones } from './mediciones';

/** Si cambia cómo se calcula, las comparaciones guardadas se recalculan al abrirlas. */
export const VERSION_CALCULO = 1;

interface Comun {
  version: number;
  clase: ClaseComparacion;
  /** El hash del original de cada fuente (en el orden de `fuentes`) cuando se calculó. */
  fuentes_hash: string[];
  /** Cómo se llamaba cada fuente (la etiqueta de su serie o su título), para nombrarlas sin abrirlas. */
  nombres?: string[];
  /** La versión del lector de cada fuente: si sube, cambian sus derivados y se recalcula. */
  versiones_lector?: number[];
}

export interface ResultadoMediciones extends Comun {
  clase: 'mediciones';
  /** Cambio de la mediana de B respecto de A, en %; `null` si no se puede calcular (mediana de A igual a 0). */
  cambio: number | null;
  p: number | null;
  significativo: boolean;
  sentido: 'baja' | 'sube' | 'igual';
  mediana_a: number;
  mediana_b: number;
  unidad: string;
  n_a: number;
  n_b: number;
  /** Diferencia B − A según Hodges-Lehmann y su intervalo del 95 %, en `unidad` (IN-047; antes no se guardaba). */
  hl?: number | null;
  hl_bajo?: number | null;
  hl_alto?: number | null;
}

export interface ResultadoLogs extends Comun {
  clase: 'logs';
  /** Número de línea (desde 1) en que se separan; `null` si siguen el mismo camino. */
  divergencia: number | null;
  nuevos: number;
  ausentes: number;
  cambian: number;
}

export interface ResultadoDatos extends Comun {
  clase: 'datos';
  filas_a: number;
  filas_b: number;
  columnas_anadidas: number;
  columnas_quitadas: number;
  /** Columnas comunes que cambian de tipo. */
  columnas_tipo: number;
  /** Columnas comunes que cambian de distribución. */
  cambian: number;
}

export interface ResultadoJson extends Comun {
  clase: 'json';
  anadidas: number;
  quitadas: number;
  cambiadas: number;
}

export type ResultadoComparacion = ResultadoMediciones | ResultadoLogs | ResultadoDatos | ResultadoJson;

const finito = (x: number): number | null => (Number.isFinite(x) ? x : null);

/** Lo que se guarda de cada fuente: su hash, su nombre y la versión de su lector. */
export interface DeLasFuentes {
  hashes: string[];
  nombres?: string[];
  versiones?: number[];
}

const comunDe = (f: DeLasFuentes) => ({
  version: VERSION_CALCULO,
  fuentes_hash: f.hashes,
  ...(f.nombres ? { nombres: f.nombres } : {}),
  ...(f.versiones ? { versiones_lector: f.versiones } : {}),
});

export function resultadoDeMediciones(c: ComparacionMediciones, f: DeLasFuentes): ResultadoMediciones {
  return {
    ...comunDe(f),
    clase: 'mediciones',
    cambio: finito(c.resultado.cambio),
    p: finito(c.resultado.p),
    significativo: c.resultado.significativo,
    sentido: c.resultado.sentido,
    mediana_a: c.a.d.mediana,
    mediana_b: c.b.d.mediana,
    unidad: c.unidad,
    n_a: c.a.d.n,
    n_b: c.b.d.n,
    hl: finito(c.resultado.hl.estimacion),
    hl_bajo: finito(c.resultado.hl.icBajo),
    hl_alto: finito(c.resultado.hl.icAlto),
  };
}

export function resultadoDeLogs(c: ComparacionLogs, f: DeLasFuentes): ResultadoLogs {
  return {
    ...comunDe(f),
    clase: 'logs',
    divergencia: c.divergencia === null ? null : c.divergencia + 1,
    nuevos: c.nuevos.length,
    ausentes: c.ausentes.length,
    cambian: c.cambian.length,
  };
}

export function resultadoDeDatos(c: ComparacionDatos, f: DeLasFuentes): ResultadoDatos {
  return {
    ...comunDe(f),
    clase: 'datos',
    filas_a: c.filas[0],
    filas_b: c.filas[1],
    columnas_anadidas: c.anadidas.length,
    columnas_quitadas: c.quitadas.length,
    columnas_tipo: c.cambianTipo.length,
    cambian: c.cambios.length,
  };
}

export function resultadoDeJson(c: ComparacionJson, f: DeLasFuentes): ResultadoJson {
  return {
    ...comunDe(f),
    clase: 'json',
    anadidas: c.anadidas.length,
    quitadas: c.quitadas.length,
    cambiadas: c.cambiadas.length,
  };
}

const esNumeroONulo = (x: unknown) => x === null || typeof x === 'number';

/** El resultado guardado, si tiene la forma de esta versión; si no (otra versión, editado a mano), `null`. */
export function leerResultado(r: Record<string, unknown>): ResultadoComparacion | null {
  if (r.version !== VERSION_CALCULO || !Array.isArray(r.fuentes_hash)) return null;
  if (r.clase === 'mediciones')
    return esNumeroONulo(r.cambio) && esNumeroONulo(r.p) && typeof r.mediana_a === 'number'
      ? (r as unknown as ResultadoMediciones)
      : null;
  if (r.clase === 'logs')
    return esNumeroONulo(r.divergencia) && typeof r.nuevos === 'number' ? (r as unknown as ResultadoLogs) : null;
  if (r.clase === 'datos')
    return ['filas_a', 'filas_b', 'columnas_anadidas', 'columnas_quitadas', 'columnas_tipo', 'cambian'].every((k) =>
      Number.isFinite(r[k]),
    )
      ? (r as unknown as ResultadoDatos)
      : null;
  if (r.clase === 'json')
    return ['anadidas', 'quitadas', 'cambiadas'].every((k) => Number.isFinite(r[k]))
      ? (r as unknown as ResultadoJson)
      : null;
  return null;
}

/** Las fuentes (por posición) cuyo original ya no es el de cuando se calculó; `hashes` son los de ahora. */
export function fuentesCambiadas(r: ResultadoComparacion | null, hashes: readonly (string | undefined)[]): number[] {
  return hashes.flatMap((h, i) => (!r || h === undefined || r.fuentes_hash[i] !== h ? [i] : []));
}

/** Lo guardado es de otra versión del lector de alguna fuente (o no lo dice): hay que recalcular y guardarlo. */
export const desfasado = (r: ResultadoComparacion | null, versiones: readonly number[]): boolean =>
  !r || (r.versiones_lector ?? []).join(',') !== versiones.join(',');

/** El cambio con su signo y una cifra decimal: `−4,5 %`, `+3,1 %`. */
export function textoCambio(cambio: number | null, idioma: Idioma): string {
  if (cambio === null) return '—';
  const texto = fmtCifra(cambio, 1, '%', idioma);
  return cambio > 0 && texto !== fmtCifra(0, 1, '%', idioma) ? `+${texto}` : texto;
}

/** Las cifras que se pueden citar de una comparación, ya escritas. */
export function cifrasDeResultado(r: ResultadoComparacion, idioma: Idioma): [nombre: string, texto: string][] {
  if (r.clase === 'mediciones') {
    // Como la vista: en µs o ns si son de menos de 1 ms (0,26 ns no puede citarse «0,000000 ms»), y la diferencia de
    // Hodges-Lehmann con los decimales de la segunda serie.
    const unidad = r.unidad === 's' ? 's' : 'ms';
    const a = { d: { mediana: r.mediana_a }, unidad } as const;
    const b = { d: { mediana: r.mediana_b }, unidad } as const;
    const escala = escalaDe([a, b]);
    const fb = formatosDe(b, idioma, escala);
    const hl = (clave: 'hl' | 'hl_bajo' | 'hl_alto'): [string, string][] => {
      const v = r[clave];
      return typeof v === 'number' ? [[clave, fb.conUnidad(v)]] : [];
    };
    return [
      ['cambio', textoCambio(r.cambio, idioma)],
      ['p', r.p === null ? '—' : fmtP(r.p, idioma)],
      ['mediana_a', formatosDe(a, idioma, escala).conUnidad(r.mediana_a)],
      ['mediana_b', fb.conUnidad(r.mediana_b)],
      ...hl('hl'),
      ...hl('hl_bajo'),
      ...hl('hl_alto'),
    ];
  }
  if (r.clase === 'json')
    return [
      ['cambian', fmtNumero(r.anadidas + r.quitadas + r.cambiadas, idioma)],
      ['anadidas', fmtNumero(r.anadidas, idioma)],
      ['quitadas', fmtNumero(r.quitadas, idioma)],
      ['cambiadas', fmtNumero(r.cambiadas, idioma)],
    ];
  if (r.clase === 'datos')
    return [
      ['filas_a', fmtNumero(r.filas_a, idioma)],
      ['filas_b', fmtNumero(r.filas_b, idioma)],
      ['cambian', fmtNumero(r.cambian, idioma)],
    ];
  return [
    ['divergencia', r.divergencia === null ? '—' : fmtNumero(r.divergencia, idioma)],
    ['nuevos', fmtNumero(r.nuevos, idioma)],
    ['ausentes', fmtNumero(r.ausentes, idioma)],
  ];
}
