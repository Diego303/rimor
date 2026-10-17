#!/usr/bin/env node
// Rechaza colores literales fuera de src/ui/tema/tokens.css (rimor-diseno.md §14.3).
// Uso: node scripts/comprobar-colores.mjs [carpeta]   (por defecto, src/)
// Una línea se exime con el comentario «rimor-permitir-color».
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXTENSIONES = /\.(ts|tsx|css|astro|mjs)$/;
const PRUEBAS = /\.test\.(ts|tsx|mjs)$/;
const EXIMIR = 'rimor-permitir-color';
const PALETA =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const UTILIDADES =
  'bg|text|border|divide|fill|stroke|ring|outline|from|to|via|decoration|shadow|accent|caret|placeholder';
const NOMBRES =
  'black|white|red|orange|yellow|green|blue|purple|pink|gray|grey|brown|cyan|magenta|navy|teal|maroon|olive|silver|gold|lime|aqua|fuchsia|crimson|coral|salmon|tomato|orchid|plum|khaki|indigo|violet|beige|ivory';
const PROPIEDADES =
  'color|background|background-color|backgroundColor|border-color|borderColor|fill|stroke|outline-color';

const REGLAS = [
  // Hexadecimal de color. No cuenta tras «href=», donde «#add» es un ancla.
  { nombre: 'hexadecimal', re: /(?<![\w&]|href=["'{`]{1,2})#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi },
  { nombre: 'función de color', re: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*[\d.a-z-]/gi },
  {
    nombre: 'paleta de Tailwind',
    re: new RegExp(`\\b(?:${UTILIDADES})-(?:(?:${PALETA})-\\d{2,3}|white|black)\\b`, 'g'),
  },
  { nombre: 'color con nombre', re: new RegExp(`\\b(?:${PROPIEDADES})\\s*:\\s*['"]?(?:${NOMBRES})\\b`, 'gi') },
];

/**
 * Busca colores literales en un texto.
 * @param {string} texto
 * @returns {{ linea: number, regla: string, valor: string }[]}
 */
export function buscarColores(texto) {
  const hallados = [];
  texto.split('\n').forEach((linea, i) => {
    if (linea.includes(EXIMIR)) return;
    for (const { nombre, re } of REGLAS) {
      for (const m of linea.matchAll(re)) hallados.push({ linea: i + 1, regla: nombre, valor: m[0] });
    }
  });
  return hallados;
}

function* recorrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) yield* recorrer(ruta);
    else if (EXTENSIONES.test(e.name)) yield ruta;
  }
}

/**
 * Recorre una carpeta y devuelve los colores literales de cada archivo, salvo `ui/tema/tokens.css` y las pruebas.
 * @param {string} carpeta
 */
export function comprobarCarpeta(carpeta) {
  const tokens = ['ui', 'tema', 'tokens.css'].join(sep);
  const hallados = [];
  for (const ruta of recorrer(carpeta)) {
    const rel = relative(carpeta, ruta);
    if (rel === tokens || PRUEBAS.test(rel)) continue;
    for (const h of buscarColores(readFileSync(ruta, 'utf8'))) hallados.push({ archivo: rel, ...h });
  }
  return hallados;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const carpeta = process.argv[2] ?? fileURLToPath(new URL('../src', import.meta.url));
  const hallados = comprobarCarpeta(carpeta);
  for (const h of hallados) console.error(`${h.archivo}:${h.linea}  ${h.regla} «${h.valor}» fuera de tokens.css`);
  if (hallados.length) {
    console.error(`\n${hallados.length} color(es) literal(es). Usa los tokens de src/ui/tema/tokens.css.`);
    process.exit(1);
  }
  console.log('Colores: solo tokens.');
}
