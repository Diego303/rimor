import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { Feed, mensajeDe, moverSeleccion } from './Feed';
import type { FilaFeed } from './filas';

const filas: FilaFeed[] = Array.from({ length: 5000 }, (_, i) => ({
  t: 'mensaje',
  clave: `m${i}`,
  fm: { ...elementoFalso(i + 1).frontmatter },
}));

describe('lista virtual del feed', () => {
  it('con 5.000 mensajes monta solo los visibles (y un margen)', () => {
    const inicio = performance.now();
    const { container } = render(
      <main className="amain">
        <Feed filas={filas} pintar={(f) => <p>{f.clave}</p>} enfocado={null} etiqueta="Feed" />
      </main>,
    );
    const montadas = container.querySelectorAll('.fila-feed').length;
    expect(montadas).toBeGreaterThan(0);
    expect(montadas).toBeLessThan(60);
    // El anclaje abajo necesita desplazamiento de verdad (happy-dom no maqueta): queda para la prueba en navegador.
    expect(performance.now() - inicio).toBeLessThan(1000);
  });

  it('j/k: sin selección empieza por el último; no se sale de los extremos', () => {
    const pocas = filas.slice(0, 3);
    const [a, b, c] = pocas.map((f) => (f.t === 'mensaje' ? f.fm.ref : ''));
    expect(moverSeleccion(pocas, null, 1)).toBe(c);
    expect(moverSeleccion(pocas, c ?? null, 1)).toBe(c);
    expect(moverSeleccion(pocas, b ?? null, -1)).toBe(a);
    expect(moverSeleccion(pocas, a ?? null, -1)).toBe(a);
    expect(moverSeleccion([], null, 1)).toBeNull();
    expect(mensajeDe(pocas, b ?? null)?.ref).toBe(b);
    expect(mensajeDe(pocas, 'NO-0001')).toBeNull();
  });
});
