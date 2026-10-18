import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { optimizarSvg } from '../../../scripts/marca.mjs';
import { GUION, ONDA, PUNTO } from './geometria';

const raiz = new URL('../../../', import.meta.url);
const leer = (ruta: string) => readFileSync(new URL(ruta, raiz), 'utf8');
const svgsDe = (carpeta: string) =>
  readdirSync(new URL(carpeta, raiz))
    .filter((n) => n.endsWith('.svg'))
    .map((n) => `${carpeta}${n}`);

describe('SVG de marca publicados', () => {
  const publicados = [...svgsDe('public/marca/'), ...svgsDe('docs/marca/svg/')];

  it('hay SVG publicados', () => {
    expect(publicados.length).toBeGreaterThanOrEqual(12);
  });

  for (const ruta of publicados) {
    it(`${ruta}: sin <metadata>, con viewBox y por debajo de 1 KB`, () => {
      const svg = leer(ruta);
      expect(statSync(new URL(ruta, raiz)).size).toBeLessThan(1024);
      expect(svg).not.toContain('<metadata');
      expect(svg).not.toContain('c2pa');
      expect(svg).toContain('viewBox="0 0 ');
    });
  }

  it('el favicon conserva su <style> con prefers-color-scheme y las clases de sus formas', () => {
    const favicon = leer('public/marca/favicon.svg');
    expect(favicon).toMatch(/<style>.*@media \(prefers-color-scheme:dark\).*<\/style>/);
    expect(favicon).toContain('stroke:#EDEBE6');
    expect(favicon).toContain('fill:#FF6A3D');
    expect(favicon.match(/class="i"/g)).toHaveLength(2);
    expect(favicon).toContain('class="k"');
    expect(favicon).toContain('stroke-width="3.6"');
  });

  it('los iconos con título lo conservan', () => {
    for (const ruta of svgsDe('docs/marca/svg/')) expect(leer(ruta)).toContain('<title>Rimor</title>');
  });

  it('optimizarSvg avisa si un SVG pierde lo que debe conservar o pesa demasiado', () => {
    const grande = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><title>x</title><text>${'Rimor '.repeat(300)}</text></svg>`;
    expect(optimizarSvg(grande, 'x.svg').problemas.join()).toMatch(/pesa \d+ B/);
    const limpio = optimizarSvg(leer('docs/marca/originales/rimor-icono/svg/rimor-simbolo.svg'), 'x.svg');
    expect(limpio.problemas).toEqual([]);
  });
});

describe('geometría', () => {
  it('es la del símbolo original', () => {
    const original = leer('docs/marca/originales/rimor-icono/svg/rimor-simbolo.svg');
    expect(original).toContain(`d="${ONDA}"`);
    expect(original).toContain(`<circle cx="${PUNTO.cx}" cy="${PUNTO.cy}" r="${PUNTO.r}"`);
    expect(original).toContain(`d="${GUION}"`);
  });
});

describe('manifest de iconos', () => {
  it('apunta a los PNG publicados', () => {
    const manifest = JSON.parse(leer('public/marca/manifest-iconos.json')) as { icons: { src: string }[] };
    const publicados = readdirSync(new URL('public/marca/', raiz));
    for (const icono of manifest.icons) expect(publicados).toContain(icono.src);
  });
});
