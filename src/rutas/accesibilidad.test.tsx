/**
 * Auditoría de accesibilidad de v0.1 (IN-040) con axe-core sobre las pantallas, en happy-dom: sin las reglas que
 * necesitan maquetación real (el contraste se comprueba en los tokens, `contraste.test.ts`). Ninguna infracción seria
 * ni crítica. La pasada con teclado y lector de pantalla y axe en navegador real, a validación humana.
 */
import { type Elemento, isoConZona, type TipoElemento } from '@rimor/formato';
import { act, cleanup, screen } from '@testing-library/react';
import axe from 'axe-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { crearComparacion } from '../comparaciones/crear';
import { crearHilo } from '../hilos/hilos';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { REGISTRO } from '../lectores/registro';
import { montarApp, PRIMERA_CARGA } from '../pruebas/app';

function el(n: number, tipo: TipoElemento, titulo: string, original: string): Elemento {
  const base = elementoFalso(n, original, tipo);
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo,
      titulo,
      ref: `${tipo === 'log' ? 'LOG' : 'TXT'}-${String(n).padStart(4, '0')}`,
      colecciones: ['gateway'],
      creado: isoConZona(new Date(Date.now() - n * 60_000)),
    },
  };
}

const ELEMENTOS = [
  el(1, 'texto', 'Timeout en streaming', 'El cliente corta a los 30 s'),
  el(2, 'log', 'Log del gateway', '2026-10-17T17:40:45Z ERROR stream: read timeout after 30000ms'),
];

/** Lo que axe encuentra serio o crítico. */
async function infracciones(): Promise<string[]> {
  const r = await axe.run(document.body, {
    rules: {
      // Necesitan maquetación real (happy-dom no la tiene).
      'color-contrast': { enabled: false },
      'scrollable-region-focusable': { enabled: false },
    },
    resultTypes: ['violations'],
  });
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

describe('accesibilidad de las pantallas (axe)', () => {
  beforeAll(async () => {
    await import('./inicio/Inicio');
    await import('./elemento/Elemento');
    await import('./buscar/Buscar');
    await import('./coleccion/Coleccion');
    await import('./datos/Datos');
    await import('./ajustes/Ajustes');
    await import('./papelera/Papelera');
    await import('./importar/Importar');
    await import('./hilo/Hilo');
    await import('./comparacion/Comparacion');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  const rutas: [string, string, Parameters<typeof screen.findByRole>[1]][] = [
    ['/', 'Inicio', {}],
    ['/e/TXT-0001', 'elemento', {}],
    ['/buscar?q=timeout', 'Buscar', {}],
    ['/c/gateway', 'colección', {}],
    ['/datos', 'Datos y copias', {}],
    ['/ajustes', 'Ajustes', {}],
    ['/papelera', 'papelera', {}],
    ['/importar', 'Importar', {}],
  ];

  it('Inicio vacío (la bienvenida), la paleta abierta y la ayuda de atajos', async () => {
    await montarApp('/');
    await screen.findByRole('button', { name: /Pega este log/ }, PRIMERA_CARGA);
    expect(await infracciones()).toEqual([]);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
    expect(await infracciones()).toEqual([]);
    act(() => void document.querySelector<HTMLDialogElement>('dialog.paleta')?.close());
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })));
    expect(await infracciones()).toEqual([]);
  }, 30_000);

  it('un hilo y una comparación', async () => {
    const med = (n: number, texto: string) => {
      const e = el(n, 'mediciones', `Mediciones ${n}`, texto);
      return {
        ...e,
        frontmatter: {
          ...e.frontmatter,
          ref: `MED-000${n}` as Elemento['frontmatter']['ref'],
          lector: { ...e.frontmatter.lector, nombre: 'mediciones' },
        },
      };
    };
    const error = (n: number) => {
      const e = el(n, 'error', `Error ${n}`, `Error: fallo ${n}\n    at f (a.js:1:1)`);
      return {
        ...e,
        frontmatter: {
          ...e.frontmatter,
          ref: `ERR-000${n}` as Elemento['frontmatter']['ref'],
          lector: { ...e.frontmatter.lector, nombre: 'error' },
        },
      };
    };
    const { router, espacio } = await montarApp('/ajustes', [
      med(3, '# a\n38.4 ms\n39.0 ms\n37.9 ms\n38.8 ms\n40.1 ms'),
      med(4, '# b\n36.9 ms\n37.4 ms\n35.9 ms\n36.5 ms\n36.0 ms'),
      error(5),
      error(6),
    ]);
    const hilo = await act(() => crearHilo('Fallo', ['ERR-0005', 'ERR-0006'], espacio));
    const cmp = await act(() =>
      crearComparacion('MED-0003', 'MED-0004', {
        repositorio: espacio.repositorio,
        entidades: espacio.entidades,
        derivar: async (e) =>
          (REGISTRO.paraElemento(e) as NonNullable<ReturnType<typeof REGISTRO.paraElemento>>).derivar(e),
        titular: (a, b) => `${a} frente a ${b}`,
      }),
    );
    if (!cmp.ok) throw new Error(`sin comparación: ${JSON.stringify(cmp.error)}`);
    await act(() => router.navigate({ to: '/hilo/$ref', params: { ref: hilo } }));
    await screen.findAllByRole('heading', {}, PRIMERA_CARGA);
    await act(async () => new Promise((r) => setTimeout(r, 500)));
    expect(await infracciones()).toEqual([]);
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: cmp.valor } }));
    await screen.findAllByRole('heading', {}, PRIMERA_CARGA);
    await act(async () => new Promise((r) => setTimeout(r, 500)));
    expect(await infracciones()).toEqual([]);
  }, 60_000);

  it.each(rutas)(
    '%s (%s) sin infracciones serias',
    async (ruta) => {
      const { router } = await montarApp('/ajustes', ELEMENTOS);
      await act(() => router.navigate({ to: ruta as never }));
      await screen.findAllByRole('heading', {}, PRIMERA_CARGA);
      await act(async () => new Promise((r) => setTimeout(r, 500)));
      expect(await infracciones()).toEqual([]);
    },
    30_000,
  );
});
