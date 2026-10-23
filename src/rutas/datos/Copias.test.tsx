import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { leerTexto } from '../../almacen/contrato';
import { leerAjustes } from '../../espacio/ajustes';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';
import { PilotoCopia } from '../Rail';

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

describe('Datos y copias: casos de la revisión', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('el plegado sigue a los ajustes de ahora y no pierde lo que no conoce; un número vacío vuelve; Intro guarda', async () => {
    const { router, espacio, almacen } = await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await act(() => router.navigate({ to: '/datos' }));
    fireEvent.click(await screen.findByText('Recordatorio de copia', {}, PRIMERA_CARGA));
    const cambios = screen.getByRole('spinbutton', { name: 'Cambios sin copia' }) as HTMLInputElement;
    // Otra pestaña (o una versión posterior) cambia los ajustes: el plegado lo enseña.
    await act(() =>
      espacio.guardarAjustes((a) => ({ ...a, copias: { ...a.copias, cambios: 100, automatica: true } as never })),
    );
    await waitFor(() => expect(cambios.value).toBe('100'));
    fireEvent.change(cambios, { target: { value: '' } });
    fireEvent.blur(cambios);
    expect(cambios.value).toBe('100');
    const dias = screen.getByRole('spinbutton', { name: 'Días sin copia' }) as HTMLInputElement;
    dias.focus();
    fireEvent.change(dias, { target: { value: '14' } });
    fireEvent.keyDown(dias, { key: 'Enter' });
    await waitFor(async () => {
      const guardado = JSON.parse((await leerTexto(almacen, '.rimor/ajustes.json')) ?? '{}');
      expect(guardado.copias).toMatchObject({ cambios: 100, dias: 14, automatica: true });
    }, ESCRITURA);
  }, 30_000);

  it('leer unos ajustes con `copias` que no es un objeto no inventa claves', () => {
    expect(Object.keys(leerAjustes(JSON.stringify({ esquema: 1, copias: [1, 2] })).copias).sort()).toEqual([
      'avisar',
      'cambios',
      'dias',
      'zipPrevio',
    ]);
  });

  it('el piloto anima solo con una copia nueva, y deja de animar si vuelve a ámbar', () => {
    const { rerender } = render(<PilotoCopia alDia={true} ultimaCopia="a" etiqueta="x" />);
    // Al abrir ya al día: sin animación.
    expect(document.querySelector('.senal-copia-al-dia')).toBeNull();
    rerender(<PilotoCopia alDia={false} ultimaCopia="a" etiqueta="x" />);
    // Subir los umbrales lo pone verde sin copia nueva: sin animación.
    rerender(<PilotoCopia alDia={true} ultimaCopia="a" etiqueta="x" />);
    expect(document.querySelector('.senal-copia-al-dia')).toBeNull();
    rerender(<PilotoCopia alDia={false} ultimaCopia="a" etiqueta="x" />);
    rerender(<PilotoCopia alDia={true} ultimaCopia="b" etiqueta="x" />);
    expect(document.querySelector('.piloto-animado .senal-copia-al-dia')).toBeTruthy();
    rerender(<PilotoCopia alDia={false} ultimaCopia="b" etiqueta="x" />);
    expect(document.querySelector('.senal-copia-al-dia')).toBeNull();
    expect(document.querySelector('.piloto.warn')).toBeTruthy();
  });
});
