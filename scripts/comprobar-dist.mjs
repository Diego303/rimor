#!/usr/bin/env node
// Comprueba la construcción: el HTML enlaza los iconos de marca con la BASE correcta, los archivos existen
// y la CSP (ADR-0005) va antes de cualquier script, autoriza cada script en línea por su hash y es estricta.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashesDeScripts } from './csp.mjs';

/**
 * Problemas de una política CSP: directivas que deben ser exactas y un `script-src` solo con el propio
 * origen, hashes y `'wasm-unsafe-eval'` (compilar WebAssembly, IN-044): ni comodines, ni esquemas, ni
 * `'unsafe-inline'` ni `'unsafe-eval'`.
 * @param {string} politica
 * @returns {string[]}
 */
export function validarCsp(politica) {
  const fallos = [];
  const directivas = Object.fromEntries(
    politica
      .split(';')
      .map((d) => d.trim().split(/\s+/))
      .filter((p) => p[0])
      .map(([nombre, ...valores]) => [nombre, valores]),
  );
  const exacta = (nombre, esperado) => {
    if ((directivas[nombre] ?? []).join(' ') !== esperado) fallos.push(`la CSP debe llevar «${nombre} ${esperado}»`);
  };
  exacta('default-src', "'self'");
  exacta('object-src', "'none'");
  exacta('base-uri', "'self'");
  exacta('form-action', "'none'");
  for (const v of directivas['script-src'] ?? ['(falta)'])
    if (v !== "'self'" && v !== "'wasm-unsafe-eval'" && !/^'sha256-[A-Za-z0-9+/]+=*'$/.test(v))
      fallos.push(`script-src no admite ${v}`);
  return fallos;
}

function principal() {
  const dist = fileURLToPath(new URL('../dist/', import.meta.url));
  const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const fallos = [];

  const enlaces = [
    ['icon', 'marca/favicon.svg'],
    ['icon', 'marca/rimor-app-claro-32.png'],
    ['apple-touch-icon', 'marca/rimor-app-claro-180.png'],
  ];
  for (const [rel, ruta] of enlaces) {
    if (!html.includes(`rel="${rel}" href="${base}${ruta}"`))
      fallos.push(`falta <link rel="${rel}" href="${base}${ruta}">`);
    if (!existsSync(join(dist, ruta))) fallos.push(`no existe dist/${ruta}`);
  }
  for (const media of ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'])
    if (!html.includes(`media="${media}"`)) fallos.push(`falta theme-color para ${media}`);
  if (!existsSync(join(dist, 'marca/manifest-iconos.json'))) fallos.push('no existe dist/marca/manifest-iconos.json');

  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
  if (!csp) fallos.push('falta la CSP');
  else {
    if (html.indexOf(csp[0]) > html.indexOf('<script')) fallos.push('la CSP va después de un script');
    for (const h of hashesDeScripts(html)) if (!csp[1].includes(h)) fallos.push(`la CSP no autoriza el script ${h}`);
    fallos.push(...validarCsp(csp[1]));
  }

  if (fallos.length) {
    for (const f of fallos) console.error(f);
    process.exit(1);
  }
  console.log('Construcción: iconos de marca enlazados y publicados; CSP estricta con los hashes de sus scripts.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
