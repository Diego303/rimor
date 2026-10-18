#!/usr/bin/env node
// Comprueba la construcción: el HTML enlaza los iconos de marca con la BASE correcta y los archivos existen.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const fallos = [];

const enlaces = [
  ['icon', 'marca/favicon.svg'],
  ['icon', 'marca/rimor-app-claro-32.png'],
  ['apple-touch-icon', 'marca/rimor-app-claro-180.png'],
];
for (const [rel, ruta] of enlaces) {
  if (!html.includes(`rel="${rel}" href="${base}${ruta}"`))
    fallos.push(`falta <link rel="${rel}" href="${base}${ruta}">`);
  if (!existsSync(join(DIST, ruta))) fallos.push(`no existe dist/${ruta}`);
}
for (const media of ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'])
  if (!html.includes(`media="${media}"`)) fallos.push(`falta theme-color para ${media}`);
if (!existsSync(join(DIST, 'marca/manifest-iconos.json'))) fallos.push('no existe dist/marca/manifest-iconos.json');

if (fallos.length) {
  for (const f of fallos) console.error(f);
  process.exit(1);
}
console.log('Construcción: iconos de marca enlazados y publicados.');
