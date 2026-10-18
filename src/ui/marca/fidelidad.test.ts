import { readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { ESTADOS_SENAL, type EstadoSenal } from './estadosSenal';
import { GUION, ONDA } from './geometria';

/**
 * Fidelidad de senal.css con los SVG de rimor-animaciones (D18): cada <animate>, <animateTransform> y
 * <animateMotion> del original tiene su @keyframes con los mismos tiempos (keyTimes → %), los mismos valores
 * (con los colores por token), la misma duración y la misma curva. La comparación de píxeles en cinco
 * instantes queda para Playwright.
 */
const css = readFileSync(new URL('./senal.css', import.meta.url), 'utf8');
const carpeta = new URL('./referencia/', import.meta.url);
const TOKENS: Record<string, string> = {
  '#EE4F1F': '--key',
  '#FF6A3D': '--key',
  '#A8A49B': '--apagado',
  '#5E5B55': '--apagado',
  '#B32F27': '--bad',
  '#FF7A6B': '--bad',
  '#191919': '--ink',
  '#EDEBE6': '--ink',
};

/** @keyframes de senal.css: nombre → porcentaje → declaraciones. */
function fotogramas(): Map<string, Map<number, Record<string, string>>> {
  const salida = new Map<string, Map<number, Record<string, string>>>();
  for (const m of css.matchAll(/@keyframes ([\w-]+) \{([\s\S]*?)\n\}/g)) {
    const marcos = new Map<number, Record<string, string>>();
    for (const f of (m[2] ?? '').matchAll(/(\d+(?:\.\d+)?)% \{([^}]*)\}/g)) {
      const decl = Object.fromEntries(
        (f[2] ?? '')
          .split(';')
          .map((d) => d.trim())
          .filter(Boolean)
          .map((d) => {
            const i = d.indexOf(':');
            return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
          }),
      );
      marcos.set(Number(f[1]), decl);
    }
    salida.set(m[1] ?? '', marcos);
  }
  return salida;
}

const num = (x: string) => Number.parseFloat(x);
const mismo = (a: string, b: string) => a.replace(/\s+/g, '') === b.replace(/\s+/g, '');

/** Papel del elemento animado en el SVG original, que da el nombre de su @keyframes. */
function papel(padre: string): string {
  if (padre.startsWith('<text') && padre.includes('Roboto Mono')) return 'frase';
  if (padre.startsWith('<text')) return 'nombre';
  if (padre.startsWith('<circle') && padre.includes('fill="none"')) return 'anillo';
  if (padre.startsWith('<circle')) return 'punto';
  if (padre.startsWith('<g')) return 'onda';
  if (/stroke="#(A8A49B|5E5B55)"/i.test(padre)) return 'referencia';
  if (padre.includes('stroke-dasharray="26 74"')) return 'tramo';
  if (padre.includes(`d="${GUION}"`)) return 'guion';
  if (padre.includes(`d="${ONDA}"`)) return 'onda';
  return 'desconocido';
}

/** Propiedad y valor CSS que corresponden a un valor del SVG. */
function aCss(atributo: string, tipo: string | undefined, valor: string): [string, string] {
  if (atributo === 'fill') return ['fill', `var(${TOKENS[valor.toUpperCase()] ?? valor})`];
  if (atributo === 'r') return ['r', `${num(valor)}px`];
  if (atributo === 'transform' && tipo === 'scale') {
    const [x, y] = valor.split(/\s+/);
    return ['transform', `scale(${num(x ?? '1')}, ${num(y ?? x ?? '1')})`];
  }
  if (atributo === 'transform' && tipo === 'translate') {
    const x = num(valor.split(/\s+/)[0] ?? '0');
    return ['transform', x === 0 ? 'translateX(0)' : `translateX(${x}px)`];
  }
  return [atributo, valor];
}

const marcos = fotogramas();
const svgs = readdirSync(carpeta);

describe('fidelidad de las animaciones con sus SVG', () => {
  for (const [estado, def] of Object.entries(ESTADOS_SENAL) as [EstadoSenal, (typeof ESTADOS_SENAL)[EstadoSenal]][]) {
    for (const tema of ['claro', 'oscuro']) {
      it(`${estado} (${def.svg}, ${tema})`, () => {
        const nombre = svgs.find((n) => n === `${def.svg}-${tema}.svg`);
        expect(nombre, 'SVG de referencia').toBeTruthy();
        const svg = readFileSync(new URL(nombre as string, carpeta), 'utf8');
        const animaciones = [...svg.matchAll(/<(animate|animateTransform|animateMotion)\b([^>]*)\/>/g)];
        expect(animaciones.length).toBeGreaterThan(0);
        for (const a of animaciones) {
          const attrs: Record<string, string | undefined> = Object.fromEntries(
            [...(a[2] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]]),
          );
          // El elemento al que pertenece: la última etiqueta abierta antes de la animación.
          const padre = [...svg.slice(0, a.index).matchAll(/<(path|circle|text|g)\b[^>]*>/g)].at(-1)?.[0] ?? '';
          const rol = papel(padre);
          const kf = marcos.get(`senal-${estado}-${rol}`);
          expect(kf, `@keyframes senal-${estado}-${rol}`).toBeTruthy();
          if (!kf) continue;
          expect(attrs.dur).toBe(`${def.duracionS}s`);
          const tiempos = (attrs.keyTimes ?? '').split(';').map((t) => Math.round(num(t) * 1000) / 10);
          // Cada keyTime del SVG es un fotograma (un mismo @keyframes puede juntar dos animaciones del elemento).
          for (const t of tiempos) expect(kf.has(t), `${rol}: fotograma al ${t} %`).toBe(true);
          if (a[1] === 'animateMotion') {
            const puntos = (attrs.keyPoints ?? '').split(';');
            tiempos.forEach((t, i) => {
              expect(kf.get(t)?.['offset-distance']).toBe(`${num(puntos[i] ?? '0') * 100}%`);
            });
          } else {
            const valores = (attrs.values ?? '').split(';');
            tiempos.forEach((t, i) => {
              const [prop, esperado] = aCss(attrs.attributeName ?? '', attrs.type, valores[i] ?? '');
              const real = kf.get(t)?.[prop] ?? '';
              const iguales = /^-?[\d.]+$/.test(esperado) ? num(real) === num(esperado) : mismo(real, esperado);
              expect(iguales, `${rol} ${prop} al ${t} %: ${real} frente a ${esperado}`).toBe(true);
            });
          }
          // Curva: los recorridos lineales del SVG son lineales en CSS; los demás usan la curva común.
          const clase = rol === 'onda' && padre.startsWith('<g') ? 'escala' : rol;
          const bloque = new RegExp(`\\.senal-${estado} \\.${clase} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
          if (attrs.calcMode === 'linear') expect(bloque, `${rol}: lineal`).toContain('linear');
          else expect(bloque, `${rol}: curva común`).not.toContain('linear');
        }
      });
    }
  }
});

describe('reglas del movimiento', () => {
  it('solo se animan propiedades que no recalculan el diseño', () => {
    const permitidas = new Set(['stroke-dashoffset', 'opacity', 'transform', 'r', 'fill', 'offset-distance']);
    for (const kf of marcos.values())
      for (const decl of kf.values()) for (const p of Object.keys(decl)) expect(permitidas.has(p), p).toBe(true);
  });

  it('pesa menos de 4 KB comprimido junto con Senal.tsx', () => {
    const tsx = readFileSync(new URL('./Senal.tsx', import.meta.url));
    expect(gzipSync(Buffer.concat([Buffer.from(css), tsx])).length).toBeLessThan(4096);
  });
});
