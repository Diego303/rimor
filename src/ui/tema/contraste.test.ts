import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contraste } from './contraste';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Variables `--x: #rrggbb` del primer bloque que sigue a `selector`. */
function tokensDe(selector: string): Record<string, string> {
  const inicio = css.indexOf(selector);
  const bloque = css.slice(css.indexOf('{', inicio) + 1, css.indexOf('}', inicio));
  return Object.fromEntries([...bloque.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\b/gi)].map((m) => [m[1], m[2]]));
}

const claro = tokensDe(':root {');
const oscuroSistema = tokensDe(':root:not([data-theme="light"])');
const oscuro = tokensDe(':root[data-theme="dark"]');

// Pares de rimor-diseno.md §13.1: [texto, fondo, mínimo en claro, mínimo en oscuro].
const PARES: [string, string, number, number | null][] = [
  ['--ink', '--panel', 16.1, 13.1],
  ['--muted', '--panel', 5.4, 5.5],
  ['--muted', '--panel-2', 4.5, 4.8],
  ['--faint', '--panel', 4.5, 4.6],
  ['--key-text', '--panel', 4.5, 6.2],
  ['--ok', '--panel', 5.6, 7.5],
  ['--warn', '--panel', 5.6, 7.4],
  ['--bad', '--panel', 5.7, 6.1],
  ['--ok', '--ok-soft', 4.9, null],
  ['--warn', '--warn-soft', 4.9, null],
  ['--bad', '--bad-soft', 4.7, null],
  ['--key-ink', '--key', 4.8, 6.1],
];
// La guía redondea a un decimal: el valor real puede quedar hasta 0,05 por debajo del de la tabla.
const TOLERANCIA = 0.05;
// Todos los pares de la tabla son de texto: además, nunca por debajo de AA (4,5:1).
const AA = 4.5;

describe('contraste de los tokens (§13.1)', () => {
  it('calcula bien los extremos', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contraste('#777777', '#777777')).toBe(1);
  });

  it('los dos bloques oscuros son idénticos', () => {
    expect(oscuro).toEqual(oscuroSistema);
  });

  for (const [texto, fondo, minClaro, minOscuro] of PARES) {
    it(`${texto} sobre ${fondo}`, () => {
      const c = contraste(claro[texto] ?? '', claro[fondo] ?? '');
      expect(c).toBeGreaterThanOrEqual(minClaro - TOLERANCIA);
      expect(c).toBeGreaterThanOrEqual(AA);
      if (minOscuro !== null) {
        const o = contraste(oscuro[texto] ?? claro[texto] ?? '', oscuro[fondo] ?? '');
        expect(o).toBeGreaterThanOrEqual(minOscuro - TOLERANCIA);
        expect(o).toBeGreaterThanOrEqual(AA);
      }
    });
  }

  it('el punto naranja sobre --panel llega a 3:1 en los dos temas (gráfico, WCAG 1.4.11)', () => {
    expect(contraste(claro['--key'] ?? '', claro['--panel'] ?? '')).toBeGreaterThanOrEqual(3);
    expect(contraste(oscuro['--key'] ?? '', oscuro['--panel'] ?? '')).toBeGreaterThanOrEqual(3);
  });

  it('el botón primario de peligro (`.btn.pri.dan`, --accent-ink sobre --bad) llega a AA en los dos temas', () => {
    const componentes = readFileSync(new URL('../componentes/componentes.css', import.meta.url), 'utf8');
    expect(componentes).toMatch(/\.btn\.pri\.dan \{[^}]*background: var\(--bad\);[^}]*color: var\(--accent-ink\);/);
    expect(contraste(claro['--accent-ink'] ?? '', claro['--bad'] ?? '')).toBeGreaterThanOrEqual(AA);
    expect(contraste(oscuro['--accent-ink'] ?? '', oscuro['--bad'] ?? '')).toBeGreaterThanOrEqual(AA);
  });

  it('el símbolo sobre el icono de señal llega a 4,8:1 (IN-089)', () => {
    expect(contraste('#191919', '#EE4F1F')).toBeGreaterThanOrEqual(4.8 - TOLERANCIA);
    expect(contraste('#191919', '#EE4F1F')).toBeGreaterThanOrEqual(AA);
  });
});
