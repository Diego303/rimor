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
  /** (mediana de B − mediana de A) / mediana de A × 100. */
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
  const cambio = ((db.mediana - da.mediana) / da.mediana) * 100;
  const significativo = Number.isFinite(p) && p < UMBRAL_SIGNIFICACION;
  const sentido = !significativo || cambio === 0 ? 'igual' : cambio < 0 ? 'baja' : 'sube';
  return { a: da, b: db, cambio, p, u, significativo, sentido };
}
