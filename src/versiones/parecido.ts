/**
 * Cuánto se parecen dos textos (CMP-02): Jaccard de sus *shingles* de tres palabras, sobre los primeros 200 KB.
 * Por encima de 0,6, o con el mismo título, una captura nueva es la versión siguiente de otra. TS puro.
 */

/** Con más de esto (en parecido), una captura es una versión nueva. */
export const UMBRAL_PARECIDO = 0.6;
/** Palabras por *shingle*. */
const TAMANO = 3;
/** Cuánto texto se mira de cada uno (los prompts, documentos y códigos son mucho más cortos). */
const MUESTRA = 200 * 1024;

/** Los *shingles* de un texto: grupos de tres palabras seguidas, sin mayúsculas ni acentos. */
export function shingles(texto: string): Set<string> {
  const palabras = texto
    .slice(0, MUESTRA)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
    .filter(Boolean);
  const conjunto = new Set<string>();
  // Con menos de tres palabras, el texto entero es su único shingle.
  if (palabras.length < TAMANO) {
    if (palabras.length) conjunto.add(palabras.join(' '));
    return conjunto;
  }
  for (let i = 0; i + TAMANO <= palabras.length; i++) conjunto.add(palabras.slice(i, i + TAMANO).join(' '));
  return conjunto;
}

/** Jaccard: lo común entre todo (0 si los dos están vacíos). */
export function parecido(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (!a.size && !b.size) return 0;
  const [menor, mayor] = a.size <= b.size ? [a, b] : [b, a];
  let comunes = 0;
  for (const x of menor) if (mayor.has(x)) comunes++;
  return comunes / (a.size + b.size - comunes);
}

/** El título para comparar: sin mayúsculas ni espacios de más. */
export const tituloComparable = (titulo: string) => titulo.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
