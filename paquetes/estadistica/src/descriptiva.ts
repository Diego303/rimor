/** Estadística descriptiva de una serie de mediciones (LEC-06). TS puro, sin dependencias. */
import { ordenados } from './orden';

export interface Descriptiva {
  n: number;
  mediana: number;
  media: number;
  /** Desviación típica muestral (n − 1). */
  desviacion: number;
  /** Coeficiente de variación: desviación / media. */
  cv: number;
  minimo: number;
  maximo: number;
  p5: number;
  p95: number;
  q1: number;
  q3: number;
  /** IC 95 % de la mediana por estadísticos de orden (ver `icMediana`). */
  icBajo: number;
  icAlto: number;
}

/**
 * Percentil por interpolación lineal entre estadísticos de orden (método 7 de Hyndman y Fan, el de
 * `numpy.percentile` y R por defecto): posición h = (n − 1)·q sobre la serie ordenada.
 */
export function percentil(orden: readonly number[], q: number): number {
  const n = orden.length;
  if (!n) return Number.NaN;
  const h = (n - 1) * Math.min(1, Math.max(0, q));
  const i = Math.floor(h);
  const a = orden[i] as number;
  const b = orden[Math.min(n - 1, i + 1)] as number;
  return a + (h - i) * (b - a);
}

/** Mediana de una serie ya ordenada. */
export function medianaOrdenada(orden: readonly number[]): number {
  const n = orden.length;
  if (!n) return Number.NaN;
  const m = n >> 1;
  return n % 2 ? (orden[m] as number) : ((orden[m - 1] as number) + (orden[m] as number)) / 2;
}

export const Z95 = 1.959963984540054;

/**
 * Intervalo de confianza del 95 % de la mediana por estadísticos de orden, con la aproximación normal de la
 * binomial (n, ½): rangos (1-based) j = ⌊n/2 − z·√n/2⌋ y k = ⌈1 + n/2 + z·√n/2⌉, acotados a [1, n].
 * Es el método de las pantallas de referencia; con n pequeño se amplía a los extremos.
 */
export function icMediana(orden: readonly number[], z = 1.96): [number, number] {
  const n = orden.length;
  if (!n) return [Number.NaN, Number.NaN];
  const j = Math.max(1, Math.floor(n / 2 - (z * Math.sqrt(n)) / 2));
  const k = Math.min(n, Math.ceil(1 + n / 2 + (z * Math.sqrt(n)) / 2));
  return [orden[j - 1] as number, orden[k - 1] as number];
}

/** Todas las medidas descriptivas de una serie. Con menos de dos valores, desviación y CV son NaN. */
export function describir(valores: readonly number[]): Descriptiva {
  const orden = ordenados(valores);
  const n = orden.length;
  const media = n ? orden.reduce((s, x) => s + x, 0) / n : Number.NaN;
  const desviacion = n > 1 ? Math.sqrt(orden.reduce((s, x) => s + (x - media) ** 2, 0) / (n - 1)) : Number.NaN;
  const [icBajo, icAlto] = icMediana(orden);
  return {
    n,
    mediana: medianaOrdenada(orden),
    media,
    desviacion,
    cv: desviacion / media,
    minimo: n ? (orden[0] as number) : Number.NaN,
    maximo: n ? (orden[n - 1] as number) : Number.NaN,
    p5: percentil(orden, 0.05),
    p95: percentil(orden, 0.95),
    q1: percentil(orden, 0.25),
    q3: percentil(orden, 0.75),
    icBajo,
    icAlto,
  };
}

/** Valores fuera de [Q1 − 1,5·IQR, Q3 + 1,5·IQR] (regla de Tukey). */
export function atipicos(valores: readonly number[]): number[] {
  const orden = ordenados(valores);
  const q1 = percentil(orden, 0.25);
  const q3 = percentil(orden, 0.75);
  const iqr = q3 - q1;
  return valores.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
}
