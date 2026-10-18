import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('carcasa.css', () => {
  it('conserva las medidas de las pantallas y la consulta de contenedor a 720 px', () => {
    const css = readFileSync(new URL('./carcasa.css', import.meta.url), 'utf8');
    expect(css).toContain('grid-template-columns: 212px minmax(0, 1fr)');
    expect(css).toMatch(/\.col \{[^}]*max-width: 780px/);
    expect(css).toMatch(/\.amain \{[^}]*padding: 22px 24px 0/);
    expect(css).toContain('@container app (max-width: 720px)');
    expect(css).toMatch(/\.rb\[aria-current="page"\] \.n \{\s*color: var\(--key-text\)/);
  });
});
