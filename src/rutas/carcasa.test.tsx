import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useEspacio } from '../estado/espacio';
import { crearRouter } from './rutas';

function montar(ruta = '/') {
  const router = crearRouter(createMemoryHistory({ initialEntries: [ruta] }));
  render(<RouterProvider router={router} />);
  return router;
}

describe('Carcasa', () => {
  afterEach(() =>
    useEspacio.setState({ nombre: '', sinClasificar: 0, colecciones: [], ultimaCopia: null, copiaAlDia: false }),
  );

  it('pinta el raíl con la sección activa, el recuento, las colecciones y el pie del espacio', async () => {
    useEspacio.setState({
      nombre: 'Trabajo',
      sinClasificar: 7,
      colecciones: [{ id: 'gateway', nombre: 'gateway', recuento: 12 }],
      copiaAlDia: true,
    });
    montar('/');
    const inicio = await screen.findByRole('link', { name: /Inicio/ });
    expect(inicio.getAttribute('aria-current')).toBe('page');
    expect(inicio.textContent).toContain('7');
    expect(screen.getByRole('link', { name: /gateway/ }).getAttribute('href')).toContain('/c/gateway');
    expect(screen.getByRole('img', { name: 'Copia al día' })).toBeTruthy();
    expect(screen.getByText('Trabajo')).toBeTruthy();
  });

  it('navega desde el raíl y con los atajos «/» y «g h»', async () => {
    const router = montar('/');
    fireEvent.click(await screen.findByRole('link', { name: /Buscar/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/buscar'));
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'h' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    fireEvent.keyDown(window, { key: '/' });
    await waitFor(() => expect(router.state.location.pathname).toBe('/buscar'));
  });

  it('los atajos no se disparan escribiendo en un campo', async () => {
    const router = montar('/');
    await screen.findByRole('link', { name: /Inicio/ });
    const campo = document.createElement('input');
    document.body.append(campo);
    campo.focus();
    fireEvent.keyDown(campo, { key: '/' });
    await act(async () => undefined);
    expect(router.state.location.pathname).toBe('/');
    campo.remove();
  });

  it('«?» abre la ayuda de atajos', async () => {
    montar('/');
    await screen.findByRole('link', { name: /Inicio/ });
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(await screen.findByText('Atajos de teclado')).toBeTruthy();
    expect(screen.getByText('Ir a Inicio')).toBeTruthy();
  });

  it('cada ruta tiene su pantalla', async () => {
    const router = montar('/e/LOG-0042');
    expect(await screen.findByRole('heading', { name: 'LOG-0042' })).toBeTruthy();
    await act(() => router.navigate({ to: '/datos' }));
    expect(await screen.findByRole('heading', { name: 'Datos y copias' })).toBeTruthy();
  });
});
