import type { Elemento, TipoElemento } from '@rimor/formato';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { ListaDensa, TARJETAS_POR_TANDA } from './Vistas';

function el(n: number, tipo: TipoElemento, titulo: string, original: string, extra = {}): Elemento {
  const base = elementoFalso(n, original, tipo);
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      ref: `${tipo === 'idea' ? 'IDE' : 'TXT'}-${String(n).padStart(4, '0')}`,
      tipo,
      titulo,
      colecciones: ['gateway'],
      creado: `2026-10-${String(10 + (n % 15)).padStart(2, '0')}T10:00:00+02:00`,
      ...extra,
    },
  };
}

const ELEMENTOS = [
  el(1, 'texto', 'Árbol de llamadas', 'primera línea\nsegunda'),
  el(2, 'idea', 'Probar ureq', 'probar ureq con streaming', { estado: 'semilla' }),
  el(3, 'texto', 'Zeta', 'zeta', { colecciones: ['gateway', 'api'] }),
];

const filasDensa = () =>
  [...document.querySelectorAll('.lista-densa tbody tr.click .densa-titulo b')].map((b) => b.textContent);

describe('Vistas de un grupo', () => {
  beforeAll(async () => {
    await import('../coleccion/Coleccion');
    await import('../buscar/Buscar');
    await import('../ajustes/Ajustes');
    await import('../elemento/Elemento');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('en la colección: el selector lleva la vista a la dirección; el mosaico agrupa con recuento y tarjetas', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/c/$coleccion', params: { coleccion: 'gateway' } }));
    const vista = await screen.findByRole('group', { name: 'Vista' }, PRIMERA_CARGA);
    expect(within(vista).getByRole('button', { name: 'Lista' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(vista).getByRole('button', { name: 'Mosaico' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ vista: 'mosaico' }));
    const grupos = () => [...document.querySelectorAll('.grupo-mosaico > h3')].map((h) => h.textContent);
    await waitFor(() => expect(grupos()).toEqual(['Texto · 2', 'Idea · 1']));
    // La tarjeta del lector, cuando llega el elemento.
    await waitFor(() => expect(document.querySelector('.tarjeta-texto')?.textContent).toBe('zeta'), ESCRITURA);
    // Por fecha: un grupo por día.
    fireEvent.click(screen.getByRole('button', { name: 'Fecha' }));
    await waitFor(() => expect(grupos()).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Probar ureq' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/IDE-0002'));
    // «Atrás» vuelve al mosaico.
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.search).toEqual({ vista: 'mosaico' }));
  }, 30_000);

  it('la lista densa: columnas, ordenar con aria-sort, Enter abre y las flechas mueven el foco', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() =>
      router.navigate({ to: '/c/$coleccion', params: { coleccion: 'gateway' }, search: { vista: 'densa' } }),
    );
    const tabla = await screen.findByRole('table', {}, PRIMERA_CARGA);
    expect(
      within(tabla)
        .getAllByRole('columnheader')
        .map((c) => c.textContent?.replace(/[↑↓\s]/g, '')),
    ).toEqual(['Tipo', 'Título', 'Fecha', 'Colecciones', 'Estado']);
    // Por defecto, lo más reciente arriba.
    expect(filasDensa()).toEqual(['Zeta', 'Probar ureq', 'Árbol de llamadas']);
    expect(within(tabla).getByRole('columnheader', { name: /Fecha/ }).getAttribute('aria-sort')).toBe('descending');
    fireEvent.click(within(tabla).getByRole('button', { name: 'Título' }));
    expect(filasDensa()).toEqual(['Árbol de llamadas', 'Probar ureq', 'Zeta']);
    expect(
      within(tabla)
        .getByRole('columnheader', { name: /Título/ })
        .getAttribute('aria-sort'),
    ).toBe('ascending');
    fireEvent.click(within(tabla).getByRole('button', { name: /Título/ }));
    expect(filasDensa()).toEqual(['Zeta', 'Probar ureq', 'Árbol de llamadas']);
    // Estado visible con su nombre y colecciones.
    const filas = [...document.querySelectorAll('.lista-densa tbody tr.click')];
    expect(filas[1]?.querySelector('.st')?.textContent).toBe('semilla');
    expect(filas[0]?.textContent).toContain('gateway, api');

    (filas[0] as HTMLElement).focus();
    fireEvent.keyDown(filas[0] as HTMLElement, { key: 'ArrowDown' });
    await waitFor(() => expect(document.activeElement?.getAttribute('data-indice')).toBe('1'));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Enter' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/IDE-0002'));
  }, 30_000);

  it('el mosaico pinta una tanda de tarjetas y «Ver más» añade otra', async () => {
    const muchos = Array.from({ length: TARJETAS_POR_TANDA + 10 }, (_, i) =>
      el(i + 1, 'texto', `Nota ${i + 1}`, `nota`),
    );
    const { router } = await montarApp('/ajustes', muchos);
    await act(() =>
      router.navigate({ to: '/c/$coleccion', params: { coleccion: 'gateway' }, search: { vista: 'mosaico' } }),
    );
    await waitFor(
      () => expect(document.querySelectorAll('.tarjeta-elemento')).toHaveLength(TARJETAS_POR_TANDA),
      PRIMERA_CARGA,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver más (quedan 10)' }));
    await waitFor(() => expect(document.querySelectorAll('.tarjeta-elemento')).toHaveLength(TARJETAS_POR_TANDA + 10));
    expect(screen.queryByRole('button', { name: /Ver más/ })).toBeNull();
  }, 30_000);

  it('en Buscar: el selector conserva la consulta, y escribir conserva la vista', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/buscar', search: { q: 'zeta' } }));
    const vista = await screen.findByRole('group', { name: 'Vista' }, ESCRITURA);
    fireEvent.click(within(vista).getByRole('button', { name: 'Densa' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'zeta', vista: 'densa' }));
    await waitFor(() => expect(filasDensa()).toEqual(['Zeta']));
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar' }), { target: { value: 'ureq' } });
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'ureq', vista: 'densa' }));
    await waitFor(() => expect(filasDensa()).toEqual(['Probar ureq']), ESCRITURA);
    fireEvent.click(within(screen.getByRole('group', { name: 'Vista' })).getByRole('button', { name: 'Lista' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'ureq' }));
  }, 30_000);
});

describe('lista densa con muchos elementos', () => {
  afterEach(cleanup);

  it('con 1.000, solo monta las filas que se ven (y un margen)', () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => el(i + 1, 'texto', `Nota ${i + 1}`, 'nota').frontmatter);
    render(<ListaDensa elementos={muchos} alAbrir={() => undefined} />);
    const montadas = document.querySelectorAll('.lista-densa tbody tr.click').length;
    expect(montadas).toBeGreaterThan(5);
    expect(montadas).toBeLessThan(100);
    // Los espaciadores ocupan el alto de las que no están montadas.
    expect(document.querySelectorAll('.lista-densa tr.espaciador')).toHaveLength(1);
  });

  it('Fin lleva el foco a la última aunque no esté montada; siempre queda una fila a la que llegar con Tab', async () => {
    const muchos = Array.from({ length: 1000 }, (_, i) => el(i + 1, 'texto', `Nota ${i + 1}`, 'nota').frontmatter);
    const { rerender } = render(<ListaDensa elementos={muchos} alAbrir={() => undefined} />);
    const contenedor = document.querySelector('.lista-densa') as HTMLElement;
    const primera = document.querySelector('.lista-densa tbody tr.click') as HTMLElement;
    primera.focus();
    fireEvent.keyDown(primera, { key: 'End' });
    // El navegador avisa del desplazamiento después: entonces se monta la última y recibe el foco.
    expect(document.activeElement?.getAttribute('data-indice')).toBe('0');
    // happy-dom no desplaza (`scrollTo` no hace nada): se hace lo que haría el navegador y se avisa del desplazamiento.
    await act(async () => {
      contenedor.scrollTop = 1000 * 38;
      fireEvent.scroll(contenedor);
    });
    await waitFor(() => expect(document.activeElement?.getAttribute('data-indice')).toBe('999'));

    // La lista encoge (otra búsqueda): la fila tabulable sigue existiendo.
    rerender(<ListaDensa elementos={muchos.slice(0, 3)} alAbrir={() => undefined} />);
    await waitFor(() => expect(document.querySelectorAll('.lista-densa tbody tr.click[tabindex="0"]')).toHaveLength(1));
  });
});
