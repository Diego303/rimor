#!/usr/bin/env node
// Suma, comprimido con gzip, el HTML, el JavaScript y el CSS que carga la portada al abrir (presupuesto: 300 KB).
// Sigue los import estáticos desde dist/index.html; los dinámicos son carga diferida y no cuentan.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const LIMITE_KB = 300;
const base = (process.env.BASE ?? '/').replace(/\/?$/, '/');

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const inicio = new Set();
for (const m of html.matchAll(/(?:src|href|component-url|renderer-url)="([^"]+\.(?:js|css))"/g)) inicio.add(m[1]);

/** Convierte una URL del sitio en una ruta de dist/. */
const aRuta = (url) => join(DIST, normalize(url.startsWith(base) ? url.slice(base.length) : url.replace(/^\//, '')));

const faltan = [...inicio].filter((url) => !existsSync(aRuta(url)));
if (!inicio.size || faltan.length) {
  console.error(
    inicio.size
      ? `No se encuentran en dist/: ${faltan.join(', ')}. ¿Se construyó con otra BASE (ahora «${base}»)?`
      : 'dist/index.html no carga ningún módulo: la isla no está montada.',
  );
  process.exit(1);
}

// El propio index.html cuenta: lleva en línea los estilos y scripts pequeños.
const vistos = new Map([[join(DIST, 'index.html'), gzipSync(html).length]]);
const pendientes = [...inicio].map(aRuta);
while (pendientes.length) {
  const ruta = pendientes.pop();
  if (vistos.has(ruta)) continue;
  if (!existsSync(ruta)) {
    console.error(`Import estático sin archivo: ${ruta.slice(DIST.length)}`);
    process.exit(1);
  }
  const datos = readFileSync(ruta);
  vistos.set(ruta, gzipSync(datos).length);
  if (!ruta.endsWith('.js')) continue;
  const codigo = datos.toString('utf8');
  // import estáticos: `import x from"./a.js"`, `import"./a.js"` y `export … from"./a.js"`; no `import("./a.js")`.
  for (const m of codigo.matchAll(/(?:\bfrom\s*|\bimport\s*)["']([^"']+\.js)["']/g)) {
    pendientes.push(m[1].startsWith('.') ? join(dirname(ruta), m[1]) : aRuta(m[1]));
  }
}

const total = [...vistos.values()].reduce((a, b) => a + b, 0) / 1024;
console.log(`Carga inicial: ${total.toFixed(1)} KB comprimidos en ${vistos.size} archivos (límite ${LIMITE_KB} KB).`);
if (total > LIMITE_KB) {
  for (const [ruta, tam] of [...vistos].sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.error(`  ${(tam / 1024).toFixed(1).padStart(7)} KB  ${ruta.slice(DIST.length)}`);
  process.exit(1);
}
