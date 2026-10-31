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

/**
 * Problemas de la PWA (IN-050): el manifest con los colores, los iconos de `manifest-iconos.json` (bajo `marca/`) y el
 * destino de «Compartir»; la precarga del service worker sin DuckDB (79 MB, que va bajo demanda).
 * @param {{ theme_color?: string; background_color?: string; icons?: { src: string }[]; share_target?: any }} manifest
 * @param {{ src: string }[]} iconos los de `manifest-iconos.json`
 * @param {string} sw el `sw.js` construido
 * @param {string} base la `BASE`, con su barra final: la portada se precarga con ella
 * @returns {string[]}
 */
export function validarPwa(manifest, iconos, sw, base = '/') {
  const fallos = [];
  if (manifest.theme_color !== '#E8E6E1') fallos.push('el manifest debe llevar theme_color #E8E6E1'); // rimor-permitir-color
  if (manifest.background_color !== '#F6F5F1') fallos.push('el manifest debe llevar background_color #F6F5F1'); // rimor-permitir-color
  const srcs = new Set((manifest.icons ?? []).map((i) => i.src));
  for (const i of iconos) if (!srcs.has(`marca/${i.src}`)) fallos.push(`al manifest le falta el icono marca/${i.src}`);
  const destino = manifest.share_target;
  if (destino?.action !== 'compartir' || destino?.method !== 'POST' || destino?.enctype !== 'multipart/form-data')
    fallos.push('el manifest debe llevar share_target POST multipart a «compartir»');
  if (!destino?.params?.files?.some((/** @type {{ name: string }} */ f) => f.name === 'archivos'))
    fallos.push('el share_target debe aceptar archivos («archivos»)');
  // Las entradas de la precarga, como las escribe Workbox: `{"revision":…,"url":"_astro/App.js"}`.
  const precarga = [...sw.matchAll(/"url":"([^"]+)"/g)].map((m) => m[1]);
  if (!precarga.length) fallos.push('el service worker no precarga nada');
  for (const u of precarga)
    if (/\.wasm$|duckdb/.test(u)) fallos.push(`el service worker precarga ${u} (DuckDB va bajo demanda)`);
  if (!precarga.includes(base)) fallos.push(`el service worker no precarga la portada (${base})`);
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

  // PWA (IN-050).
  if (!html.includes(`rel="manifest" href="${base}manifest.webmanifest"`))
    fallos.push(`falta <link rel="manifest" href="${base}manifest.webmanifest">`);
  if (!existsSync(join(dist, 'manifest.webmanifest')) || !existsSync(join(dist, 'sw.js')))
    fallos.push('faltan dist/manifest.webmanifest o dist/sw.js');
  else
    fallos.push(
      ...validarPwa(
        JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8')),
        JSON.parse(readFileSync(join(dist, 'marca/manifest-iconos.json'), 'utf8')).icons,
        readFileSync(join(dist, 'sw.js'), 'utf8'),
        base,
      ),
    );

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
  console.log(
    'Construcción: iconos de marca enlazados y publicados; CSP estricta con los hashes de sus scripts; manifest y service worker de la PWA.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
