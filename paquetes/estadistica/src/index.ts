/**
 * @rimor/estadistica: estadística de mediciones verificada contra referencias (SciPy y benchstat).
 * TS puro, sin dependencias. Lo implementa IN-011.
 */

/** Copia ordenada de menor a mayor; no modifica la entrada. */
export function ordenados(valores: readonly number[]): number[] {
  return [...valores].sort((a, b) => a - b);
}
