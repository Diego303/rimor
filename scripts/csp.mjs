#!/usr/bin/env node
// Política de seguridad de contenido (SEG-02, ADR-0005): tras `astro build`, añade a cada HTML de dist/ una
// <meta http-equiv="Content-Security-Policy"> con los hashes SHA-256 de sus scripts en línea.
// GitHub Pages no permite cabeceras propias: la <meta> es la única vía.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Dominios de enriquecimiento que admiten peticiones desde el navegador (F0-7). Cuáles se usan lo decide Ajustes. */
export const DOMINIOS_ENRIQUECIMIENTO = [
  'https://api.github.com',
  'https://gitlab.com',
  'https://api.deps.dev',
  'https://registry.npmjs.org',
  'https://crates.io',
  'https://pypi.org',
  'https://api.osv.dev',
  'https://api.crossref.org',
  'https://doi.org',
  'https://api.datacite.org',
];

const SCRIPT_EN_LINEA = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

/** Hashes `'sha256-…'` de los scripts en línea de un HTML. */
export function hashesDeScripts(html) {
  return [...html.matchAll(SCRIPT_EN_LINEA)].map(
    (m) => `'sha256-${createHash('sha256').update(m[1], 'utf8').digest('base64')}'`,
  );
}

/** Texto de la política para un HTML. */
export function politica(html) {
  const scripts = [...new Set(hashesDeScripts(html))];
  return [
    "default-src 'self'",
    `script-src 'self' ${scripts.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${DOMINIOS_ENRIQUECIMIENTO.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}

/** Inserta (o sustituye) la <meta> de la CSP justo después de <meta charset>, antes de cualquier script. */
export function conCsp(html) {
  const sinPrevia = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
  const meta = `<meta http-equiv="Content-Security-Policy" content="${politica(sinPrevia)}">`;
  const charset = /<meta charset="?[^">]*"?\s*\/?>/i.exec(sinPrevia);
  if (charset) return sinPrevia.replace(charset[0], `${charset[0]}${meta}`);
  return sinPrevia.replace(/<head[^>]*>/i, (m) => `${m}${meta}`);
}

function* htmls(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) yield* htmls(ruta);
    else if (e.name.endsWith('.html')) yield ruta;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  let n = 0;
  for (const ruta of htmls(dist)) {
    writeFileSync(ruta, conCsp(readFileSync(ruta, 'utf8')));
    n++;
  }
  console.log(`CSP: ${n} página(s).`);
}
