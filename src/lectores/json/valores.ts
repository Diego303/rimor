/** Cómo se escribe un valor de JSON en una línea (IN-045): los textos entre comillas; mapas y listas, abreviados. */
import type { ValorJson } from './analisis';

/** Largo máximo de un valor en una línea. */
export const LARGO_VALOR = 80;

export function valorCorto(v: ValorJson, largo = LARGO_VALOR): string {
  const texto = Array.isArray(v)
    ? v.length
      ? '[…]'
      : '[]'
    : v !== null && typeof v === 'object'
      ? Object.keys(v).length
        ? '{…}'
        : '{}'
      : JSON.stringify(v);
  return texto.length > largo ? `${texto.slice(0, largo - 1)}…` : texto;
}
