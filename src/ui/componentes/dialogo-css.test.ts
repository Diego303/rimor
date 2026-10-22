import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('componentes.css: diálogos', () => {
  it('un diálogo cerrado no se ve aunque sea una tarjeta (`.card` le da `display: flex`)', () => {
    const css = readFileSync(new URL('./componentes.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.dialogo:not\(\[open\]\) \{\s*display: none;/);
  });
});
