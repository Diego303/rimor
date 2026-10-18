/**
 * Detección de un documento Markdown (LEC-08), barata y sin parser: señales por línea, sin expresiones que
 * retrocedan (los encabezados se leen con `encabezadoDe`). TS puro.
 */
import { encabezadoDe } from '../prompt/analisis';

/** Caracteres que se miran para detectar. */
const MUESTRA = 20_000;

const TAREA = /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]/;
const VALLA = /^[ \t]*(?:```|~~~)/;
const SEPARADOR_TABLA = /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/;
const LISTA = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+\S/;
const ENLACE = /\[[^\]\n]{1,200}\]\([^)\s]{1,500}\)/;
const PALABRA = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

/** Palabras de un texto. */
export const contarPalabras = (texto: string) => texto.match(PALABRA)?.length ?? 0;

/** Recuento rápido de palabras sin los bloques de código (para el resumen provisional al capturar). */
export function palabrasAprox(texto: string): number {
  let dentro = false;
  let n = 0;
  for (const linea of texto.split('\n')) {
    if (VALLA.test(linea)) {
      dentro = !dentro;
      continue;
    }
    if (!dentro) n += contarPalabras(linea.replace(/^[ \t]*(?:#{1,6}|[-*+]|\d+[.)]|>)[ \t]+(?:\[[ xX]\][ \t]+)?/, ''));
  }
  return n;
}

/** Encabezado Setext: una línea de texto subrayada con `===` o `---` (que no sigue a otra línea en blanco). */
function esSetext(lineas: readonly string[], i: number): boolean {
  const texto = lineas[i] ?? '';
  const subrayado = lineas[i + 1] ?? '';
  return (
    /^[ \t]{0,3}(?:=+|-+)[ \t]*$/.test(subrayado) && texto.trim() !== '' && !LISTA.test(texto) && !VALLA.test(texto)
  );
}

/**
 * 0,75 con un encabezado (ATX o Setext) y otra señal distinta, con dos señales fuertes (tareas, código, tabla) o con
 * tres cualesquiera; 0,7 con dos encabezados o más y 200 caracteres; si no, 0. Por debajo de Prompt (`CLAUDE.md`,
 * prompts con variables) y por encima de Idea y Texto.
 */
export function confianzaMarkdown(texto: string): number {
  const t = texto.slice(0, MUESTRA);
  let encabezados = 0;
  const senales = new Set<string>();
  const lineas = t.split('\n');
  for (const [i, linea] of lineas.entries()) {
    if (encabezadoDe(linea) || esSetext(lineas, i)) encabezados++;
    else if (TAREA.test(linea)) senales.add('tareas');
    else if (VALLA.test(linea)) senales.add('codigo');
    else if (SEPARADOR_TABLA.test(linea)) senales.add('tabla');
    else if (LISTA.test(linea)) senales.add('lista');
    if (ENLACE.test(linea)) senales.add('enlace');
  }
  const fuertes = ['tareas', 'codigo', 'tabla'].filter((s) => senales.has(s)).length;
  if ((encabezados && senales.size >= 1) || fuertes >= 2 || senales.size >= 3) return 0.75;
  if (encabezados >= 2 && t.trim().length >= 200) return 0.7;
  return 0;
}
