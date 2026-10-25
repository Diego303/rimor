/**
 * Qué se puede comparar con qué (CMP-01): dos logs, dos mediciones, dos conjuntos de datos (IN-044) o dos
 * configuraciones (IN-045). TS puro: la interfaz traduce el motivo cuando
 * no se puede.
 */
import type { FrontmatterComun, TipoElemento } from '@rimor/formato';

export type ClaseComparacion = 'logs' | 'mediciones' | 'datos' | 'json';

const CLASES: Partial<Record<TipoElemento, ClaseComparacion>> = {
  log: 'logs',
  mediciones: 'mediciones',
  datos: 'datos',
  json: 'json',
};

/** La clase de comparación de un tipo, o `null` si ese tipo aún no se compara. */
export const claseDe = (tipo: TipoElemento): ClaseComparacion | null => CLASES[tipo] ?? null;

export type MotivoNoComparable = 'mismo' | 'distintoTipo' | 'sinComparacion';

/** Si dos elementos se pueden comparar (y cómo), o por qué no. */
export function comparables(
  a: Pick<FrontmatterComun, 'id' | 'tipo'>,
  b: Pick<FrontmatterComun, 'id' | 'tipo'>,
): { clase: ClaseComparacion } | { motivo: MotivoNoComparable } {
  if (a.id === b.id) return { motivo: 'mismo' };
  if (a.tipo !== b.tipo) return { motivo: 'distintoTipo' };
  const clase = claseDe(a.tipo);
  return clase ? { clase } : { motivo: 'sinComparacion' };
}
