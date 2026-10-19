// IndexedDB en memoria para la caché del espacio; sin Worker, el almacén cae a memoria.
import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  // Inicio arrastra casi toda la app: se carga una vez antes (ver la carcasa).
  beforeAll(async () => {
    await import('../rutas/inicio/Inicio');
  }, 120_000);

  it('arranca y muestra el raíl', async () => {
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Rimor' }, { timeout: 5000 })).toBeTruthy();
  });

  it('Ctrl+Mayús+Espacio lleva a Inicio y enfoca el compositor desde otra pantalla', async () => {
    window.location.hash = '#/ajustes';
    render(<App />);
    await screen.findByRole('navigation', { name: 'Rimor' }, { timeout: 5000 });
    await act(async () => undefined);
    fireEvent.keyDown(window, { key: ' ', code: 'Space', ctrlKey: true, shiftKey: true });
    // El idioma sale del navegador de pruebas: se busca la caja por su papel.
    const area = await screen.findByRole('textbox', {}, { timeout: 5000 });
    await waitFor(() => expect(document.activeElement).toBe(area));
  }, 15_000);
});
