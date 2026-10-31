import { type Elemento, isoConZona, PREFIJOS, type TipoElemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { olvidarElementos } from '../../lectores/useElemento';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

function el(n: number, tipo: TipoElemento, titulo: string): Elemento {
  const base = elementoFalso(n, `contenido ${n}`, tipo);
  const creado = isoConZona(new Date(Date.now() - n * 3_600_000));
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo,
      ref: `${PREFIJOS[tipo]}-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      titulo,
      creado,
      modificado: creado,
      lector: { nombre: tipo, version: 1, resumen: {} },
    },
  };
}

/** El recuento de una vista en el raíl. */
const enRail = (nombre: string) =>
  [...document.querySelectorAll('.rail .rb.sub')]
    .find((e) => e.querySelector('.t')?.textContent === nombre)
    ?.querySelector('.n')?.textContent;

describe('Vistas guardadas', () => {
  beforeAll(async () => {
    await import('./VistaGuardada');
    await import('../buscar/Buscar');
    await import('../ajustes/Ajustes');
  }, 120_000);

  afterEach(async () => {
    cleanup();
    olvidarElementos();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('guardar una búsqueda como vista: en el raíl con su recuento vivo, su pantalla, renombrar y borrar', async () => {
    const { router, espacio } = await montarApp('/ajustes', [
      el(1, 'error', 'Timeout en streaming'),
      el(2, 'error', 'Conexión rechazada'),
      el(3, 'log', 'Log del gateway'),
    ]);
    await act(() => router.navigate({ to: '/buscar', search: { q: 'tipo:error' } }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar como vista' }, PRIMERA_CARGA));
    const dialogo = within(document.querySelector('dialog[open]') as HTMLElement);
    const nombre = dialogo.getByRole('textbox', { name: 'Nombre' }) as HTMLInputElement;
    expect(nombre.value).toBe('tipo:error');
    fireEvent.change(nombre, { target: { value: 'Errores' } });
    fireEvent.click(dialogo.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(espacio.vistas().vistas).toMatchObject([{ id: 'errores', consulta: 'tipo:error' }]));
    // Ya guardada: lo dice y enlaza a ella.
    expect(await screen.findByRole('link', { name: 'Errores' })).toBeTruthy();
    // En el raíl, bajo Colecciones, con su recuento; que sube al llegar otro error.
    await waitFor(() => expect(enRail('Errores')).toBe('2'), ESCRITURA);
    await act(async () => void (await espacio.repositorio.guardarElemento(el(4, 'error', 'Otro error'))));
    await waitFor(() => expect(enRail('Errores')).toBe('3'), ESCRITURA);

    // Su pantalla: el panel de grupo con lo que encuentra, y la consulta.
    await act(() => router.navigate({ to: '/v/$vista', params: { vista: 'errores' } }));
    expect(await screen.findByRole('heading', { name: 'Qué hay' }, PRIMERA_CARGA)).toBeTruthy();
    expect(document.querySelector('.ah .lbl')?.textContent).toBe('Vista');
    expect(document.querySelector('.consulta-vista .mono')?.textContent).toBe('tipo:error');
    expect(document.querySelectorAll('.fila-marcable')).toHaveLength(3);
    // Renombrar en el sitio (la dirección sigue valiendo).
    fireEvent.click(screen.getByRole('button', { name: 'Errores' }));
    const campo = screen.getByRole('textbox', { name: 'Título' });
    fireEvent.change(campo, { target: { value: 'Fallos' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    await waitFor(() => expect(espacio.vistas().vistas[0]?.nombre).toBe('Fallos'));
    // Borrar, con confirmación: lleva a Buscar con su consulta.
    fireEvent.click(screen.getByText('Borrar', { selector: 'summary' }));
    fireEvent.click(screen.getByRole('button', { name: 'Borrar la vista' }));
    fireEvent.click(
      within(document.querySelector('dialog[open]') as HTMLElement).getByRole('button', { name: 'Borrar la vista' }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/buscar'), ESCRITURA);
    expect(espacio.vistas().vistas).toEqual([]);
    expect(enRail('Fallos')).toBeUndefined();
  }, 40_000);

  it('una vista que no existe', async () => {
    const { router } = await montarApp('/ajustes', []);
    await act(() => router.navigate({ to: '/v/$vista', params: { vista: 'nada' } }));
    expect(await screen.findByText('No encuentro esta vista', {}, PRIMERA_CARGA)).toBeTruthy();
  }, 30_000);
});
