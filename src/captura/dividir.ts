/**
 * Captura múltiple (CAP-07, IN-049): un pegado con varias URL (una por línea) o con varios bloques separados por
 * líneas en blanco se puede guardar como varios elementos. Aquí cómo se parte; si conviene ofrecerlo lo decide la
 * vista previa (`previa.ts`), que sabe qué es cada bloque. TS puro.
 */
import { esEnlaceCompleto } from './detector';

/** Partes como mucho: más enlaces o más bloques no se ofrecen dividir (sería otra cosa: una lista, un documento). */
export const MAX_ENLACES = 50;
export const MAX_BLOQUES = 20;
/** Un texto más largo no se parte (la vista previa lo calcula a cada pausa al escribir). */
export const LARGO_MAXIMO = 256 * 1024;

export interface Partes {
  via: 'enlaces' | 'bloques';
  partes: string[];
}

/**
 * Las partes de un texto: cada línea si son todas URL o DOI completos (al menos dos), o si no los bloques que separan
 * una o más líneas en blanco (al menos dos); `null` si es una sola cosa o son demasiadas.
 */
export function partes(texto: string): Partes | null {
  if (texto.length > LARGO_MAXIMO) return null;
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lineas.length >= 2 && lineas.every(esEnlaceCompleto))
    return lineas.length <= MAX_ENLACES ? { via: 'enlaces', partes: lineas } : null;
  // Un salto de línea seguido de una o más líneas en blanco (o solo con espacios) separa dos bloques.
  const bloques = texto
    .split(/\r?\n(?:[^\S\r\n]*\r?\n)+/)
    .map((b) => b.replace(/\s+$/, ''))
    .filter((b) => b.trim());
  return bloques.length >= 2 && bloques.length <= MAX_BLOQUES ? { via: 'bloques', partes: bloques } : null;
}
