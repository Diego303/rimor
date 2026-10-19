import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
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

/** Un contenedor que se desplaza de verdad: alto fijo, `scrollTop` que se guarda y avisos de `scroll`. */
function simularDesplazamiento(contenedor: HTMLElement, alto = 600) {
  let arriba = 0;
  Object.defineProperty(contenedor, 'clientHeight', { configurable: true, get: () => alto });
  // Lo que se puede desplazar: el alto de la lista virtual (happy-dom no maqueta).
  Object.defineProperty(contenedor, 'scrollHeight', {
    configurable: true,
    get: () =>
      Number.parseFloat((contenedor.querySelector('.feed-virtual') as HTMLElement | null)?.style.height ?? '0'),
  });
  Object.defineProperty(contenedor, 'scrollTop', {
    configurable: true,
    get: () => arriba,
    set: (v: number) => {
      arriba = Math.max(0, v);
    },
  });
  contenedor.scrollTo = ((o: ScrollToOptions) => {
    arriba = Math.max(0, o.top ?? arriba);
    contenedor.dispatchEvent(new Event('scroll'));
  }) as typeof contenedor.scrollTo;
  contenedor.getBoundingClientRect = () =>
    ({ top: 0, left: 0, width: 800, height: alto, right: 800, bottom: alto }) as DOMRect;
  return {
    get arriba() {
      return arriba;
    },
    irArriba() {
      arriba = 0;
      contenedor.dispatchEvent(new Event('scroll'));
    },
  };
}

/** `dias` días de 5 mensajes, del más antiguo al más reciente (como `filasDelFeed`). */
const filasDeDias = (desde: number, hasta: number): FilaFeed[] =>
  Array.from({ length: hasta - desde }, (_, k) => desde + k).flatMap((d) => [
    { t: 'dia' as const, clave: `dia:${d}`, etiqueta: `día ${d}` },
    ...Array.from({ length: 5 }, (_, i) => ({
      t: 'mensaje' as const,
      clave: `m${d}-${i}`,
      fm: { ...elementoFalso(d * 10 + i + 1).frontmatter },
    })),
  ]);

describe('carga de días anteriores', () => {
  it('no carga al montar, carga una tanda al llegar arriba y conserva la posición', async () => {
    const pedido = vi.fn();
    const contenedorListo: { c: HTMLElement | null } = { c: null };
    function Banco() {
      const [desde, setDesde] = useState(93);
      return (
        <main
          className="amain"
          ref={(c) => {
            if (c && !contenedorListo.c) {
              contenedorListo.c = c;
              sim.s = simularDesplazamiento(c);
            }
          }}
        >
          <Feed
            filas={filasDeDias(desde, 100)}
            pintar={(f) => <p style={{ height: 150 }}>{f.clave}</p>}
            enfocado={null}
            etiqueta="Feed"
            {...(desde > 0
              ? {
                  alLlegarArriba: () => {
                    pedido();
                    setDesde((d) => Math.max(0, d - 7));
                  },
                }
              : {})}
          />
        </main>
      );
    }
    const sim: { s: ReturnType<typeof simularDesplazamiento> | null } = { s: null };
    render(<Banco />);
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    // Al montar no se pide nada: la vista se ancla abajo.
    expect(pedido).not.toHaveBeenCalled();
    const antes = sim.s?.arriba ?? 0;
    expect(antes).toBeGreaterThan(0);

    // Arriba: una tanda (no todas) y la vista se queda donde estaba (se compensa lo añadido).
    await act(async () => sim.s?.irArriba());
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(pedido).toHaveBeenCalledTimes(1);
    expect(sim.s?.arriba ?? 0).toBeGreaterThan(1000);
  });
});
