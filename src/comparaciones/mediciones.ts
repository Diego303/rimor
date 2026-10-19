/**
 * Comparación de dos mediciones (CMP-01, pantalla «Comparación de mediciones»): la primera serie de cada una (como
 * las cifras del lector), en la misma unidad, con el cambio de la mediana, Mann-Whitney y el veredicto de
 * `@rimor/estadistica`, las descriptivas y los avisos de método de cada serie. TS puro.
 */
import { type AvisoMetodo, avisosDeMetodo, type Comparacion, comparar, describir } from '@rimor/estadistica';
import type { DatosMediciones, SerieDerivada } from '../lectores/mediciones/lector';
import type { UnidadSerie } from '../lectores/mediciones/series';

export interface ComparacionMediciones {
  a: SerieDerivada;
  b: SerieDerivada;
  /** La unidad común de las dos series (la suya si coinciden; si no, ms). */
  unidad: UnidadSerie;
  resultado: Comparacion;
}

const A_MS: Record<UnidadSerie, number> = { ms: 1, s: 1000 };

/** La serie en `unidad`, con su descriptiva y sus avisos rehechos si cambia de unidad. */
function enUnidad(s: SerieDerivada, unidad: UnidadSerie): SerieDerivada {
  if (s.unidad === unidad) return s;
  const valores = s.valores.map((v) => (v * A_MS[s.unidad]) / A_MS[unidad]);
  return { etiqueta: s.etiqueta, unidad, valores, d: describir(valores), avisos: avisosDeMetodo(valores) };
}

/** Compara la primera serie de cada una; `null` si alguna no tiene valores. */
export function compararMediciones(a: DatosMediciones, b: DatosMediciones): ComparacionMediciones | null {
  const sa = a.series[0];
  const sb = b.series[0];
  if (!sa?.valores.length || !sb?.valores.length) return null;
  const unidad: UnidadSerie = sa.unidad === sb.unidad ? sa.unidad : 'ms';
  const ea = enUnidad(sa, unidad);
  const eb = enUnidad(sb, unidad);
  return { a: ea, b: eb, unidad, resultado: comparar(ea.valores, eb.valores) };
}

/** Los avisos de método de una comparación: los de cada serie, con la suya. */
export const avisosDe = (c: ComparacionMediciones): { serie: 'a' | 'b'; aviso: AvisoMetodo }[] => [
  ...c.a.avisos.map((aviso) => ({ serie: 'a' as const, aviso })),
  ...c.b.avisos.map((aviso) => ({ serie: 'b' as const, aviso })),
];
