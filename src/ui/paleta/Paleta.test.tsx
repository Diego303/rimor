import type { Elemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

function el(n: number, titulo: string, colecciones: string[] = []): Elemento {
  const base = elementoFalso(n, `texto ${n}`, 'texto');
  return { ...base, frontmatter: { ...base.frontmatter, titulo, colecciones } };
}

const ELEMENTOS = [el(1, 'Timeout en streaming', ['gateway']), el(2, 'Receta de pan')];

const ctrlK = () => act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })));
const paleta = () => screen.getByRole('dialog', { name: 'Paleta de comandos' });
/** Cerrada, el diálogo no está en el árbol de accesibilidad: se mira el propio elemento. */
const abierta = () => Boolean(document.querySelector('dialog.paleta')?.hasAttribute('open'));
const caja = () => within(paleta()).getByRole('combobox') as HTMLInputElement;
const opciones = () =>
  within(paleta())
    .queryAllByRole('option')
    .map((o) => o.querySelector('.tt')?.textContent);
const activa = () =>
  within(paleta())
    .queryAllByRole('option')
    .find((o) => o.getAttribute('aria-selected') === 'true');
const pulsar = (key: string, extra: Partial<KeyboardEventInit> = {}) => fireEvent.keyDown(caja(), { key, ...extra });

describe('Paleta de comandos', () => {
  beforeAll(async () => {
    await import('../../rutas/ajustes/Ajustes');
    await import('../../rutas/coleccion/Coleccion');
    await import('../../rutas/elemento/Elemento');
    await import('../../rutas/buscar/Buscar');
  }, 120_000);

  beforeEach(() => localStorage.clear());

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('Ctrl+K la abre con las acciones y las colecciones; flechas con vuelta, Enter ejecuta y Esc cierra', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    ctrlK();
    expect(abierta()).toBe(true);
    expect(opciones()).toEqual([
      'Ir a Inicio',
      'Ir a Buscar',
      'Ver los atajos de teclado',
      'Escribir en el compositor',
      'Ir a Ajustes',
      'Ir a la papelera',
      'Ir a Datos y copias',
      'gateway',
    ]);
    // Las teclas del atajo, a la derecha.
    expect(within(paleta()).getAllByRole('option')[0]?.querySelector('.rt')?.textContent).toBe('gluegoh');
    expect(activa()?.textContent).toContain('Ir a Inicio');
    pulsar('ArrowUp');
    expect(activa()?.textContent).toContain('gateway');
    pulsar('ArrowDown');
    pulsar('ArrowDown');
    expect(activa()?.textContent).toContain('Ir a Buscar');
    pulsar('End', { ctrlKey: true });
    expect(activa()?.textContent).toContain('gateway');
    pulsar('Home', { ctrlKey: true });
    pulsar('Enter');
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(abierta()).toBe(false);

    // Esc (el cierre del diálogo) y Ctrl+K desde la caja la cierran.
    ctrlK();
    act(() => void document.querySelector('dialog.paleta')?.dispatchEvent(new Event('close')));
    await waitFor(() => expect(screen.queryByRole('combobox')).toBeNull());
    ctrlK();
    pulsar('k', { ctrlKey: true });
    await waitFor(() => expect(abierta()).toBe(false));
  }, 30_000);

  it('al escribir: acciones y colecciones que casan, elementos del buscador y «Buscar…»; sin nada, lo dice', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    ctrlK();
    fireEvent.change(caja(), { target: { value: 'gate' } });
    await waitFor(() => expect(opciones()).toEqual(['gateway', 'Buscar «gate» en Buscar']));
    pulsar('Enter');
    await waitFor(() => expect(router.state.location.pathname).toBe('/c/gateway'));

    ctrlK();
    fireEvent.change(caja(), { target: { value: 'pan' } });
    await waitFor(() => expect(opciones()).toEqual(['Receta de pan', 'Buscar «pan» en Buscar']), ESCRITURA);
    expect(within(paleta()).getByText('Texto · TXT-0002')).toBeTruthy();
    expect(within(paleta()).getAllByRole('option')[0]?.querySelector('mark')?.textContent).toBe('pan');
    pulsar('Enter');
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/TXT-0002'));

    ctrlK();
    fireEvent.change(caja(), { target: { value: 'zzzz' } });
    await waitFor(() => expect(opciones()).toEqual(['Buscar «zzzz» en Buscar']));
    pulsar('Enter');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'zzzz' }));
  }, 30_000);

  it('las acciones de la pantalla primero; las últimas usadas salen arriba al volver a abrirla', async () => {
    const { router, espacio } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'TXT-0001' } }));
    await screen.findByRole('button', { name: 'Timeout en streaming' }, PRIMERA_CARGA);
    ctrlK();
    expect(opciones().slice(0, 6)).toEqual([
      'Editar el título',
      'Cambiar el estado',
      'Cambiar tipo',
      'Fijar o soltar',
      'Escribir una nota',
      'Mover a la papelera',
    ]);
    fireEvent.change(caja(), { target: { value: 'fijar' } });
    await waitFor(() => expect(opciones()[0]).toBe('Fijar o soltar'));
    pulsar('Enter');
    await waitFor(() => expect(espacio.repositorio.frontmatter('TXT-0001')?.fijado).toBe(true), ESCRITURA);

    ctrlK();
    expect(opciones()[0]).toBe('Fijar o soltar');
    expect(within(paleta()).getAllByText('Recientes')).toHaveLength(1);
  }, 30_000);

  it('con otro diálogo abierto, Ctrl+K lo cierra y abre la paleta; con la paleta, la cierra; nunca llega al navegador', async () => {
    await montarApp('/ajustes', ELEMENTOS);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })));
    expect(screen.getByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
    const tecla = new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true });
    act(() => void window.dispatchEvent(tecla));
    expect(tecla.defaultPrevented).toBe(true);
    expect(abierta()).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).toBeNull();
    // Con el foco fuera de la caja (en el relleno del diálogo), también la cierra.
    (document.activeElement as HTMLElement | null)?.blur();
    ctrlK();
    await waitFor(() => expect(abierta()).toBe(false));
  }, 30_000);

  it('lo que casa por poco va después de los elementos; el detalle no cuenta; la activa sigue siendo la misma', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/e/$ref', params: { ref: 'TXT-0001' } }));
    await screen.findByRole('button', { name: 'Timeout en streaming' }, PRIMERA_CARGA);
    ctrlK();
    // «pan» no casa con «En esta pantalla» de cada acción.
    fireEvent.change(caja(), { target: { value: 'pan' } });
    // Antes de que responda el buscador, se elige «Buscar…» (la última, con la flecha arriba).
    pulsar('ArrowUp');
    expect(activa()?.textContent).toContain('Buscar «pan»');
    await waitFor(() => expect(opciones()).toEqual(['Receta de pan', 'Buscar «pan» en Buscar']), ESCRITURA);
    expect(activa()?.textContent).toContain('Buscar «pan»');

    fireEvent.change(caja(), { target: { value: 'rec' } });
    await waitFor(() => expect(opciones()[0]).toBe('Receta de pan'), ESCRITURA);
    expect(opciones()).toContain('Escribir en el compositor');
    expect(opciones().at(-1)).toBe('Buscar «rec» en Buscar');
    // Cmd+↓ y Cmd+↑ van a los extremos.
    pulsar('ArrowDown', { metaKey: true });
    expect(activa()?.textContent).toContain('Buscar «rec»');
    pulsar('ArrowUp', { metaKey: true });
    expect(activa()?.textContent).toContain('Receta de pan');
    // El Enter que confirma un IME no ejecuta nada.
    pulsar('Enter', { isComposing: true });
    pulsar('Enter', { keyCode: 229 });
    expect(abierta()).toBe(true);
    expect(router.state.location.pathname).toBe('/e/TXT-0001');
  }, 30_000);

  it('los grupos tienen nombre para el lector de pantalla', async () => {
    await montarApp('/ajustes', ELEMENTOS);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    ctrlK();
    const acciones = within(paleta()).getByRole('group', { name: 'Acciones' });
    expect(within(acciones).getAllByRole('option').length).toBe(7);
    expect(within(within(paleta()).getByRole('group', { name: 'Colecciones' })).getAllByRole('option')).toHaveLength(1);
  }, 30_000);

  it('«Buscar…» desde Buscar conserva la vista elegida', async () => {
    const { router } = await montarApp('/ajustes', ELEMENTOS);
    await act(() => router.navigate({ to: '/buscar', search: { q: 'pan', vista: 'densa' } }));
    await screen.findByRole('textbox', { name: 'Buscar' }, PRIMERA_CARGA);
    ctrlK();
    fireEvent.change(caja(), { target: { value: 'timeout' } });
    pulsar('ArrowUp');
    pulsar('Enter');
    await waitFor(() => expect(router.state.location.search).toEqual({ q: 'timeout', vista: 'densa' }));
  }, 30_000);

  it('Ctrl+K también desde un campo de texto', async () => {
    await montarApp('/ajustes', ELEMENTOS);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    const campo = document.createElement('input');
    document.body.append(campo);
    campo.focus();
    act(() => void campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })));
    expect(abierta()).toBe(true);
    campo.remove();
  }, 30_000);
});
