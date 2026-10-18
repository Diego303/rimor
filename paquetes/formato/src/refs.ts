/** Refs legibles por tipo (`LOG-0042`): asignación y análisis (plan §13.3). */
import { PREFIJOS, type Tipo } from './tipos';

export type Ref = `${string}-${string}`;

const PREFIJOS_ORDENADOS = [...new Set(Object.values(PREFIJOS))].sort((a, b) => b.length - a.length);

/** Prefijo y número de una ref; `null` si no tiene la forma `PREFIJO-NNNN`. */
export function analizarRef(ref: string): { prefijo: string; numero: number } | null {
  for (const prefijo of PREFIJOS_ORDENADOS) {
    if (!ref.startsWith(`${prefijo}-`)) continue;
    const resto = ref.slice(prefijo.length + 1);
    if (/^\d{4,}$/.test(resto)) return { prefijo, numero: Number(resto) };
  }
  return null;
}

export const esRef = (x: string): x is Ref => analizarRef(x) !== null;

/** Siguiente ref libre de un tipo: el mayor número existente de su prefijo más uno, con al menos 4 cifras. */
export function asignarRef(tipo: Tipo, existentes: Iterable<string>): Ref {
  const prefijo = PREFIJOS[tipo];
  let mayor = 0;
  for (const r of existentes) {
    const a = analizarRef(r);
    if (a && a.prefijo === prefijo && a.numero > mayor) mayor = a.numero;
  }
  return `${prefijo}-${String(mayor + 1).padStart(4, '0')}`;
}
