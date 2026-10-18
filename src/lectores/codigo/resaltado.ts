/**
 * Resaltado de solo lectura (D16): los analizadores Lezer de CodeMirror, uno por lenguaje y cargado bajo demanda,
 * con `highlightCode` y `classHighlighter` (clases `tok-*`). Devuelve trozos de texto con sus clases, que la vista
 * convierte en elementos de React: nunca HTML.
 */
import type { Parser } from '@lezer/common';
import { classHighlighter, highlightCode } from '@lezer/highlight';
import type { Lenguaje } from './lenguajes';

export interface Trozo {
  texto: string;
  /** Clases `tok-*`, o vacío. */
  clases: string;
}

/** Más de esto no se resalta: se enseña tal cual, para que la vista no se atasque. */
export const MAX_CARACTERES_RESALTADO = 200_000;

type Cargador = (texto: string) => Promise<Parser>;

/** Los lenguajes con analizador Lezer oficial. C#, Ruby, Shell y SQL no lo tienen: se ven sin resaltar. */
const CARGADORES: Partial<Record<Lenguaje, Cargador>> = {
  typescript: async () => (await import('@lezer/javascript')).parser.configure({ dialect: 'ts' }),
  javascript: async () => (await import('@lezer/javascript')).parser.configure({ dialect: 'jsx' }),
  python: async () => (await import('@lezer/python')).parser,
  java: async () => (await import('@lezer/java')).parser,
  cpp: async () => (await import('@lezer/cpp')).parser,
  go: async () => (await import('@lezer/go')).parser,
  rust: async () => (await import('@lezer/rust')).parser,
  // Sin `<?php`, el fragmento es PHP puro (no una plantilla con HTML).
  php: async (texto) => {
    const { parser } = await import('@lezer/php');
    return /^\s*<\?php/.test(texto) ? parser : parser.configure({ top: 'Program' });
  },
};

/** ¿Hay analizador para este lenguaje? */
export const tieneResaltado = (l: Lenguaje | null): boolean => !!l && l in CARGADORES;

/**
 * Las líneas del código con sus trozos resaltados, o `null` si no hay analizador o el texto es demasiado grande.
 * Al unir los trozos de cada línea con saltos sale el texto original.
 */
export async function resaltar(texto: string, lenguaje: Lenguaje | null): Promise<Trozo[][] | null> {
  const cargar = lenguaje ? CARGADORES[lenguaje] : undefined;
  if (!cargar || texto.length > MAX_CARACTERES_RESALTADO) return null;
  const parser = await cargar(texto);
  const arbol = parser.parse(texto);
  const lineas: Trozo[][] = [[]];
  highlightCode(
    texto,
    arbol,
    classHighlighter,
    (trozo, clases) => (lineas.at(-1) as Trozo[]).push({ texto: trozo, clases }),
    () => lineas.push([]),
  );
  return lineas;
}
