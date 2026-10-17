#!/usr/bin/env node
// Rechaza colores literales fuera de src/ui/tema/tokens.css (rimor-diseno.md §14.3).
// Una línea se exime con el comentario «rimor-permitir-color».
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TOKENS = ['src', 'ui', 'tema', 'tokens.css'].join(sep);
const EXTENSIONES = /\.(ts|tsx|css|astro|mjs)$/;
const EXIMIR = 'rimor-permitir-color';
const PALETA_TAILWIND =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const REGLAS = [
  { nombre: 'hexadecimal', re: /(?<![\w&])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi },
  { nombre: 'función de color', re: /\b(?:rgba?|hsla?)\(\s*[\d.]/gi },
  {
    nombre: 'paleta de Tailwind',
    re: new RegExp(
      `\\b(?:bg|text|border|fill|stroke|ring|outline|from|to|via|decoration|shadow)-(?:${PALETA_TAILWIND})-\\d{2,3}\\b`,
      'g',
    ),
  },
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

function principal() {
  let errores = 0;
  for (const ruta of recorrer(join(RAIZ, 'src'))) {
    const rel = relative(RAIZ, ruta);
    if (rel === TOKENS || /\.test\.(ts|tsx|mjs)$/.test(rel)) continue;
    for (const h of buscarColores(readFileSync(ruta, 'utf8'))) {
      console.error(`${rel}:${h.linea}  ${h.regla} «${h.valor}» fuera de tokens.css`);
      errores++;
    }
  }
  if (errores) {
    console.error(`\n${errores} color(es) literal(es). Usa los tokens de src/ui/tema/tokens.css.`);
    process.exit(1);
  }
  console.log('Colores: solo tokens.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
