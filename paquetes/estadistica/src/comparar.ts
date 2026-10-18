/**
 * Comparación de dos series de mediciones (CMP-01): cambio porcentual de las medianas, Mann-Whitney y veredicto.
 * El veredicto no decide qué es «mejor»: dice si cambia y en qué sentido; el lector lo traduce («más rápido»).
 */
import { type Descriptiva, describir } from './descriptiva';
import { mannWhitney } from './mannWhitney';

export const UMBRAL_SIGNIFICACION = 0.05;

export interface Comparacion {
  a: Descriptiva;
  b: Descriptiva;
  /** (mediana de B − mediana de A) / |mediana de A| × 100; NaN si la mediana de A es 0. */
  cambio: number;
  p: number;
  u: number;
  significativo: boolean;
  /** Sentido del cambio de B respecto de A si es significativo; «igual» si no hay diferencia clara. */
  sentido: 'baja' | 'sube' | 'igual';
}

export function comparar(a: readonly number[], b: readonly number[]): Comparacion {
  const da = describir(a);
  const db = describir(b);
  const { u, p } = mannWhitney(a, b);
  const diferencia = db.mediana - da.mediana;
  const cambio = da.mediana === 0 ? Number.NaN : (diferencia / Math.abs(da.mediana)) * 100;
  const significativo = Number.isFinite(p) && p < UMBRAL_SIGNIFICACION;
  // El sentido sale de la diferencia de medianas (vale con medianas negativas o nulas); si son iguales pero la
  // prueba ve diferencia, de U: con U₁ por encima de su media, A tiende a valores mayores, así que B baja.
  const porU = u - (a.length * b.length) / 2;
  const signo = diferencia !== 0 ? Math.sign(diferencia) : -Math.sign(porU);
  const sentido = !significativo || signo === 0 ? 'igual' : signo < 0 ? 'baja' : 'sube';
  return { a: da, b: db, cambio, p, u, significativo, sentido };
}
