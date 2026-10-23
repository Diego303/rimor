import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerTexto } from '../../almacen/contrato';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

describe('Datos y copias: recordatorio y piloto', () => {
  beforeAll(async () => {
    await import('../inicio/Inicio');
    await import('./Datos');
    await import('../papelera/Papelera');
    await import('../ajustes/Ajustes');
  }, 120_000);

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('Inicio recuerda la copia sin bloquear; «Más tarde» la pospone un día', async () => {
    const { espacio } = await montarApp('/', [elementoFalso(1, 'hola', 'texto')]);
    expect(await screen.findByText('Toca hacer una copia', {}, PRIMERA_CARGA)).toBeTruthy();
    expect(screen.getByText(/^Aún no has hecho ninguna copia de este espacio/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Más tarde' }));
    await waitFor(() => expect(screen.queryByText('Toca hacer una copia')).toBeNull());
    const hasta = Date.parse(espacio.estado().recordatorioHasta ?? '');
    expect(hasta - Date.now()).toBeGreaterThan(23 * 3_600_000);
  }, 30_000);

  it('exportar desde el recordatorio lo quita y el piloto pasa a verde con la señal', async () => {
    await montarApp('/', [elementoFalso(1, 'hola', 'texto')]);
    await screen.findByText('Toca hacer una copia', {}, PRIMERA_CARGA);
    expect(document.querySelector('.space .piloto.warn')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar ZIP' }));
    await waitFor(() => expect(screen.queryByText('Toca hacer una copia')).toBeNull(), ESCRITURA);
    await waitFor(() => expect(document.querySelector('.space .senal-copia-al-dia')).toBeTruthy());
    // Después de la animación, el piloto verde.
    await waitFor(() => expect(document.querySelector('.space .piloto:not(.warn)')).toBeTruthy(), { timeout: 5000 });
  }, 30_000);

  it('el plegado guarda los umbrales; sin ZIP previo, la papelera se vacía sin descargar', async () => {
    const { router, espacio, almacen } = await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await act(() => router.navigate({ to: '/datos' }));
    fireEvent.click(await screen.findByText('Recordatorio de copia', {}, PRIMERA_CARGA));
    const cambios = screen.getByRole('spinbutton', { name: 'Cambios sin copia' });
    fireEvent.change(cambios, { target: { value: '2000' } });
    fireEvent.blur(cambios);
    expect((cambios as HTMLInputElement).value).toBe('1000');
    fireEvent.click(screen.getByRole('checkbox', { name: /Exportar un ZIP antes/ }));
    await waitFor(async () => {
      const ajustes = JSON.parse((await leerTexto(almacen, '.rimor/ajustes.json')) ?? '{}');
      expect(ajustes.copias).toMatchObject({ cambios: 1000, zipPrevio: false });
    }, ESCRITURA);

    await act(async () => void (await espacio.repositorio.moverAPapelera('TXT-0001')));
    await act(() => router.navigate({ to: '/papelera' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar la papelera' }, PRIMERA_CARGA));
    const dialogo = (await screen.findByText(/Puedes descargar antes su ZIP/)).closest('dialog') as HTMLElement;
    const confirmar = within(dialogo).getByRole('button', { name: 'Vaciar la papelera' });
    await waitFor(() => expect((confirmar as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(confirmar);
    await waitFor(() => expect(espacio.repositorio.enPapelera()).toHaveLength(0), ESCRITURA);
  }, 30_000);
});
