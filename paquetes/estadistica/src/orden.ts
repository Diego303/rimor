/** Copia ordenada de menor a mayor; no modifica la entrada. */
export function ordenados(valores: readonly number[]): number[] {
  return [...valores].sort((a, b) => a - b);
}
