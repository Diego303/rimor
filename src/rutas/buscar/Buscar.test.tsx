import { type Elemento, isoConZona, type TipoElemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useCompositor } from '../../captura/compositor';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { alternarPieza } from './Buscar';

function el(
  n: number,
  tipo: TipoElemento,
  titulo: string,
  original: string,
  extra: Partial<Elemento['frontmatter']> = {},
): Elemento {
  const base = elementoFalso(n, original, tipo);
  return {
    ...base,
    frontmatter: { ...base.frontmatter, tipo, titulo, creado: `2026-10-1${n}T10:00:00+02:00`, ...extra },
  };
}

const ELEMENTOS = [
  el(1, 'texto', 'Timeout en streaming', 'El cliente corta a los 30 s', {
    etiquetas: ['ureq'],
    colecciones: ['gateway'],
  }),
  el(2, 'texto', 'Notas del despliegue', 'Vimos un timeout leyendo el body', { etiquetas: ['staging'] }),
  el(3, 'texto', 'Receta de pan', 'Harina, agua y sal', { etiquetas: ['ureq'] }),
];

const grupos = () =>
  [...document.querySelectorAll('.grupo-busqueda > .lbl')].map((e) => e.textContent?.replace(/\s+/g, ' ').trim());
const titulos = () => [...document.querySelectorAll('.grupo-busqueda .it .tt')].map((e) => e.textContent);

describe('Buscar', () => {
  beforeAll(async () => {
    await import('./Buscar');
    await import('../ajustes/Ajustes');
    await import('../elemento/Elemento');
    await import('../inicio/Inicio');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('la caja con la consulta de la dirección, resultados por tipo, resaltado y «coincide dentro»', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/buscar', search: { q: 'timeout' } }));
    const caja = (await screen.findByRole('textbox', { name: 'Buscar' }, PRIMERA_CARGA)) as HTMLInputElement;
    expect(caja.value).toBe('timeout');
    expect(document.activeElement).toBe(caja);
    await waitFor(() => expect(screen.getByText('2 resultados')).toBeTruthy(), ESCRITURA);
    expect(grupos()).toEqual(['Texto · 2']);
    // Lo que lo tiene en el título, primero; resaltado sin mayúsculas.
    expect(titulos()).toEqual(['Timeout en streaming', 'Notas del despliegue']);
    expect([...document.querySelectorAll('.it .tt mark')].map((m) => m.textContent)).toEqual(['Timeout']);
    const filas = document.querySelectorAll('.grupo-busqueda .it');
    expect(filas[0]?.querySelector('.st')).toBeNull();
    expect(filas[1]?.querySelector('.st')?.textContent).toBe('coincide dentro');
  }, 30_000);

  it('filtros rápidos, facetas de «Afinar», sin resultados y «Limpiar», con la dirección al día', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/buscar' }));
    const caja = (await screen.findByRole('textbox', { name: 'Buscar' }, PRIMERA_CARGA)) as HTMLInputElement;
    expect(screen.getByText('Busca en todo lo que has guardado')).toBeTruthy();
    // De lo que hay: el tipo más frecuente, la colección y la etiqueta más usadas, y excluir la segunda etiqueta.
    await waitFor(() =>
      expect([...document.querySelectorAll('.row > .pill')].map((p) => p.textContent)).toEqual([
        'tipo:texto',
        'en:gateway',
        '#ureq',
        '-staging',
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: '#ureq' }));
    expect(caja.value).toBe('#ureq');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: '#ureq' }));
    await waitFor(() => expect(titulos()).toEqual(['Receta de pan', 'Timeout en streaming']), ESCRITURA);
    expect(screen.getByRole('button', { name: '#ureq' }).getAttribute('aria-pressed')).toBe('true');

    // «Afinar»: las facetas de los resultados añaden (o quitan) su filtro.
    const afinar = screen.getByText('Afinar').closest('details') as HTMLElement;
    fireEvent.click(within(afinar).getByRole('button', { name: 'gateway 1' }));
    expect(caja.value).toBe('#ureq en:gateway');
    await waitFor(() => expect(titulos()).toEqual(['Timeout en streaming']), ESCRITURA);
    expect(screen.getByText('1 resultado')).toBeTruthy();

    fireEvent.change(caja, { target: { value: 'zzzz' } });
    await waitFor(() => expect(screen.getByText('Sin resultados')).toBeTruthy(), ESCRITURA);
    expect(screen.getByText('Quita algún filtro o prueba otra palabra.')).toBeTruthy();
    expect(screen.queryByText('Afinar')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(caja.value).toBe('');
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(screen.getByText('Busca en todo lo que has guardado')).toBeTruthy();
  }, 30_000);

  it('abrir un resultado lo abre y cuenta una búsqueda con resultado abierto; cada visita es otra búsqueda', async () => {
    const { router, espacio } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/buscar', search: { q: 'pan' } }));
    const fila = await screen.findByRole('button', { name: /Receta de pan/ }, PRIMERA_CARGA);
    fireEvent.click(fila);
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/TXT-0003'));
    await waitFor(() => expect(espacio.contadores.total('busquedasConResultado')).toBe(1));
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/buscar'));
    const resultados = await waitFor(() => {
      const grupo = document.querySelector('.grupo-busqueda');
      if (!(grupo instanceof HTMLElement)) throw new Error('sin resultados');
      return grupo;
    }, PRIMERA_CARGA);
    fireEvent.click(within(resultados).getByRole('button', { name: /Receta de pan/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/TXT-0003'));
    // Volver a la pantalla es otra búsqueda: cuenta otra vez.
    await waitFor(() => expect(espacio.contadores.total('busquedasConResultado')).toBe(2));
  }, 30_000);
});

describe('búsqueda desde el compositor', () => {
  afterEach(async () => {
    cleanup();
    useCompositor.setState({ busquedas: [] });
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('el mensaje de Inicio usa el motor (difuso, en el contenido) y cuenta una vez el resultado abierto', async () => {
    const { router, espacio } = await montarApp('/', ELEMENTOS);
    await screen.findByRole('textbox', { name: 'Capturar' }, PRIMERA_CARGA);
    // «harin» casa por prefijo con «Harina», que solo está en el original: la búsqueda en memoria no lo vería.
    act(() => useCompositor.getState().anotarBusqueda('harin', isoConZona(new Date())));
    expect(await screen.findByText('1 resultado:', {}, ESCRITURA)).toBeTruthy();
    const mensaje = screen.getByText('?harin').closest('article') as HTMLElement;
    fireEvent.click(within(mensaje).getByRole('button', { name: /Receta de pan/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/TXT-0003'));
    await waitFor(() => expect(espacio.contadores.total('busquedasConResultado')).toBe(1));
    act(() => router.history.back());
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    const otraVez = (await screen.findByText('?harin', {}, PRIMERA_CARGA)).closest('article') as HTMLElement;
    fireEvent.click(await within(otraVez).findByRole('button', { name: /Receta de pan/ }, ESCRITURA));
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/TXT-0003'));
    // El mismo mensaje no vuelve a contar.
    expect(espacio.contadores.total('busquedasConResultado')).toBe(1);
  }, 30_000);
});

describe('alternar una pieza de la consulta', () => {
  it('la añade al final o la quita si ya estaba', () => {
    expect(alternarPieza('', 'tipo:log')).toBe('tipo:log');
    expect(alternarPieza('timeout  tipo:log', 'tipo:log')).toBe('timeout');
    expect(alternarPieza('timeout', '#ureq')).toBe('timeout #ureq');
  });
});
