/** Cómo se escribe un valor de JSON en una línea (IN-045): los textos entre comillas; mapas y listas, abreviados. */
import type { ValorJson } from './analisis';

/** Largo máximo de un valor en una línea. */
export const LARGO_VALOR = 80;

export function valorCorto(v: ValorJson): string {
  const texto = Array.isArray(v)
    ? v.length
      ? '[…]'
      : '[]'
    : v !== null && typeof v === 'object'
      ? Object.keys(v).length
        ? '{…}'
        : '{}'
      : JSON.stringify(v);
  return texto.length > LARGO_VALOR ? `${texto.slice(0, LARGO_VALOR - 1)}…` : texto;
}
