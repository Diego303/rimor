/** Avisos de método de una serie de mediciones (LEC-06, benchstat): pocas repeticiones, ruido alto, atípicos. */
import { atipicos, describir } from './descriptiva';

/** benchstat recomienda al menos 10 repeticiones (y 20 como ideal). */
export const MINIMO_REPETICIONES = 10;
/** Coeficiente de variación por encima del cual la medida es ruidosa. */
export const CV_MAXIMO = 0.05;

export type AvisoMetodo =
  | { tipo: 'pocas'; n: number; minimo: number }
  | { tipo: 'ruido'; cv: number; maximo: number }
  | { tipo: 'atipicos'; valores: number[] };

export function avisosDeMetodo(valores: readonly number[]): AvisoMetodo[] {
  const d = describir(valores);
  const avisos: AvisoMetodo[] = [];
  if (d.n < MINIMO_REPETICIONES) avisos.push({ tipo: 'pocas', n: d.n, minimo: MINIMO_REPETICIONES });
  // Con media 0 el CV es infinito: si hay dispersión, es ruido igualmente.
  const ruidoso = Number.isFinite(d.cv) ? Math.abs(d.cv) > CV_MAXIMO : d.desviacion > 0;
  if (d.n > 1 && ruidoso) avisos.push({ tipo: 'ruido', cv: d.cv, maximo: CV_MAXIMO });
  const fuera = d.n >= 4 ? atipicos(valores) : [];
  if (fuera.length) avisos.push({ tipo: 'atipicos', valores: fuera });
  return avisos;
}
