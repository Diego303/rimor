/**
 * Estimador de Hodges-Lehmann de la diferencia de posición entre dos series, con su intervalo (LEC-06, v0.2).
 * Firma preparada en IN-011; la implementa IN-047.
 */

export interface ResultadoHodgesLehmann {
  /** Mediana de todas las diferencias b − a. */
  estimacion: number;
  icBajo: number;
  icAlto: number;
}

export type HodgesLehmann = (a: readonly number[], b: readonly number[]) => ResultadoHodgesLehmann;
