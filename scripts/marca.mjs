#!/usr/bin/env node
// `pnpm marca` (IN-089): optimiza los SVG de marca con SVGO (sin metadatos, conservando viewBox, <title>,
// <style> y clases, por debajo de 1 KB), publica en public/marca/ solo lo que usa la app y genera el
// logotipo con el texto en contornos para usos fuera de la app. Las salidas se guardan en el repositorio.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { optimize } from 'svgo';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const ORIGEN = join(RAIZ, 'docs/marca/originales/rimor-icono');
const DOCS = join(RAIZ, 'docs/marca/svg');
const PUBLICO = join(RAIZ, 'public/marca');
const LIMITE = 1024;

const PNG_PUBLICADOS = [
  'rimor-app-claro-32.png',
  'rimor-app-claro-180.png',
  'rimor-app-claro-192.png',
  'rimor-app-claro-512.png',
  'rimor-maskable-claro-192.png',
  'rimor-maskable-claro-512.png',
];

/** Quita el espacio de nombres de procedencia que deja el bloque de metadatos. */
const quitarC2pa = {
  name: 'quitarC2pa',
  fn: () => ({
    element: {
      enter: (nodo) => {
        for (const atributo of Object.keys(nodo.attributes))
          if (atributo.startsWith('xmlns:c2pa')) delete nodo.attributes[atributo];
      },
    },
  }),
};

const CONFIG = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: { inlineStyles: false, minifyStyles: false, cleanupIds: false, removeUnknownsAndDefaults: false },
      },
    },
    'removeMetadata',
    quitarC2pa,
  ],
};

/** Optimiza un SVG y comprueba que sigue entero y cabe en 1 KB. */
export function optimizarSvg(svg, nombre) {
  const { data } = optimize(svg, { ...CONFIG, path: nombre });
  const problemas = [];
  if (Buffer.byteLength(data) > LIMITE) problemas.push(`pesa ${Buffer.byteLength(data)} B`);
  if (data.includes('<metadata')) problemas.push('conserva <metadata>');
  if (!data.includes('viewBox')) problemas.push('ha perdido el viewBox');
  if (svg.includes('<title') && !data.includes('<title')) problemas.push('ha perdido el <title>');
  if (svg.includes('<style') && !data.includes('<style')) problemas.push('ha perdido el <style>');
  const clases = (texto) => new Set([...texto.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  const perdidas = [...clases(svg)].filter((c) => !clases(data).has(c));
  if (perdidas.length) problemas.push(`ha perdido las clases ${perdidas.join(', ')}`);
  return { data, problemas };
}

/** Logotipo con «Rimor» en contornos: la composición de rimor-logotipo-*.svg (x 52, y 31,5, 21 px). */
function logotipoEnContornos(fuente, tinta, senal) {
  // Glifo a glifo (avance, kerning y espaciado de −0,4): opentype.js no admite todas las sustituciones de Archivo.
  const escala = 21 / fuente.unitsPerEm;
  const glifos = [...'Rimor'].map((c) => fuente.charToGlyph(c));
  let x = 52;
  const d = glifos
    .map((g, i) => {
      const trazo = g.getPath(x, 31.5, 21).toPathData(2);
      const siguiente = glifos[i + 1];
      x += (g.advanceWidth ?? 0) * escala - 0.4 + (siguiente ? fuente.getKerningValue(g, siguiente) * escala : 0);
      return trazo;
    })
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48" width="240" height="96" role="img"><title>Rimor</title>` +
    `<path d="M7 24 C10.5 12.5 13.5 12.5 17 24 S23.5 35.5 27 24" fill="none" stroke="${tinta}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<circle cx="33" cy="15.5" r="3.1" fill="${senal}"/>` +
    `<path d="M40 24 H41" fill="none" stroke="${tinta}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="${d}" fill="${tinta}"/></svg>\n`
  );
}

function principal() {
  mkdirSync(DOCS, { recursive: true });
  mkdirSync(PUBLICO, { recursive: true });
  let errores = 0;
  const salidas = [
    ...readdirSync(join(ORIGEN, 'svg')).map((n) => [join(ORIGEN, 'svg', n), join(DOCS, n)]),
    [join(ORIGEN, 'favicon.svg'), join(PUBLICO, 'favicon.svg')],
  ];
  for (const [de, a] of salidas) {
    const { data, problemas } = optimizarSvg(readFileSync(de, 'utf8'), de);
    if (problemas.length) {
      console.error(`${de}: ${problemas.join(', ')}`);
      errores++;
    }
    writeFileSync(a, `${data}\n`);
  }
  for (const png of PNG_PUBLICADOS) copyFileSync(join(ORIGEN, 'png', png), join(PUBLICO, png));

  const manifest = JSON.parse(readFileSync(join(ORIGEN, 'manifest-iconos.json'), 'utf8'));
  for (const icono of manifest.icons) icono.src = icono.src.replace(/^png\//, '');
  writeFileSync(join(PUBLICO, 'manifest-iconos.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const require = createRequire(import.meta.url);
  const woff = readFileSync(require.resolve('@fontsource/archivo/files/archivo-latin-700-normal.woff'));
  const fuente = opentype.parse(woff.buffer.slice(woff.byteOffset, woff.byteOffset + woff.byteLength));
  writeFileSync(
    join(RAIZ, 'docs/marca/rimor-logotipo-contornos-claro.svg'),
    logotipoEnContornos(fuente, '#191919', '#EE4F1F'),
  );
  writeFileSync(
    join(RAIZ, 'docs/marca/rimor-logotipo-contornos-oscuro.svg'),
    logotipoEnContornos(fuente, '#EDEBE6', '#FF6A3D'),
  );

  if (errores) process.exit(1);
  console.log(
    `Marca: ${salidas.length} SVG optimizados, ${PNG_PUBLICADOS.length} PNG publicados y logotipo en contornos.`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) principal();
