/** El original de cada elemento: normalización, hash y cerca de su bloque de código (plan §13.4, P3). */
import { sha256Hex } from './sha256';
import { bytesUtf8 } from './utf8';

/** A partir de este tamaño, el original va como adjunto (D8: 2 MB). */
export const LIMITE_ORIGINAL_EN_MD = 2 * 1024 * 1024;

/** Finales de línea `\n` y sin espacios al final de cada línea ni del texto: lo que se compara para duplicados. */
export function normalizarOriginal(texto: string): string {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\s+$/, '');
}

/** `sha256:…` del original normalizado. */
export function hashOriginal(texto: string): `sha256:${string}` {
  return `sha256:${sha256Hex(normalizarOriginal(texto))}`;
}

/** ¿Cabe el original dentro del `.md`? */
export const cabeEnMd = (texto: string): boolean => bytesUtf8(texto) <= LIMITE_ORIGINAL_EN_MD;

/** Cerca de acentos graves más larga que cualquier racha del texto (mínimo tres). */
export function cercaPara(texto: string): string {
  let mayor = 0;
  for (const m of texto.matchAll(/`+/g)) mayor = Math.max(mayor, m[0].length);
  return '`'.repeat(Math.max(3, mayor + 1));
}
