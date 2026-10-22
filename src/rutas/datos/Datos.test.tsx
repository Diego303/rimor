import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { escribirTexto } from '../../almacen/contrato';
import { AlmacenMemoria } from '../../almacen/memoria';
import {
  cancelarExportacion,
  type EspacioExportable,
  exportarEspacio,
  PLAZO_SIN_PROGRESO_MS,
  useExportacion,
} from '../../datos/exportacion';
import { MAX_ADJUNTO_JSON } from '../../datos/exportar';
import { ESTADO_INICIAL, type EstadoCuidado } from '../../espacio/estado';
import { useEspacio } from '../../estado/espacio';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

/** Lo descargado: nombre y contenido. */
let descargas: { nombre: string; blob: Blob }[] = [];

describe('Datos y copias: exportar', () => {
  beforeAll(async () => {
    await import('./Datos');
    await import('../ajustes/Ajustes');
  }, 120_000);

  beforeEach(() => {
    descargas = [];
    const blobs = new Map<string, Blob>();
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      const url = `blob:prueba-${blobs.size}`;
      blobs.set(url, b as Blob);
      return url;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      descargas.push({ nombre: this.download, blob: blobs.get(this.href) as Blob });
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('«Exportar ZIP» descarga el ZIP, avisa con su nombre y apunta la copia (el piloto pasa a verde)', async () => {
    const { router, espacio } = await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await act(() => router.navigate({ to: '/datos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Exportar ZIP' }, PRIMERA_CARGA));
    await waitFor(() => expect(descargas).toHaveLength(1), ESCRITURA);
    expect(descargas[0]?.nombre).toMatch(/^rimor-trabajo-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(descargas[0]?.blob.type).toBe('application/zip');
    await waitFor(() => expect(screen.getAllByText(/^Exportado rimor-trabajo-.*\.zip \(/).length).toBeGreaterThan(0));
    await waitFor(() => expect(espacio.estado().ultimaCopia).not.toBeNull());
    expect(espacio.estado().cambiosDesdeCopia).toBe(0);
    await waitFor(() => expect(useEspacio.getState().copiaAlDia).toBe(true));
  }, 30_000);

  it('Ctrl+E exporta desde cualquier pantalla', async () => {
    await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true })));
    await waitFor(() => expect(descargas.map((d) => d.nombre.endsWith('.zip'))).toEqual([true]), ESCRITURA);
  }, 30_000);

  it('el JSON con adjuntos excluidos lo dice y no cuenta como copia', async () => {
    const { router, espacio } = await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await act(async () => {
      await espacio.almacen.escribir('adjuntos/aa/grande.bin', new Uint8Array(MAX_ADJUNTO_JSON + 1));
    });
    await act(() => router.navigate({ to: '/datos' }));
    fireEvent.click(await screen.findByText('Otras exportaciones', {}, PRIMERA_CARGA));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    await waitFor(() => expect(descargas).toHaveLength(1), ESCRITURA);
    expect(descargas[0]?.nombre).toMatch(/\.json$/);
    const [descarga] = descargas;
    if (!descarga) throw new Error('sin descarga');
    const json = JSON.parse(await descarga.blob.text());
    expect(json.manifest.adjuntos_excluidos).toEqual(['adjuntos/aa/grande.bin']);
    await waitFor(() => expect(screen.getAllByText(/· 1 adjunto excluido$/).length).toBeGreaterThan(0));
    expect(espacio.estado().ultimaCopia).toBeNull();
  }, 30_000);

  it('si falla, lo dice y no apunta la copia; una a la vez; el porcentaje sube hasta el final', async () => {
    const { router, espacio } = await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await act(() => router.navigate({ to: '/datos' }));
    const boton = await screen.findByRole('button', { name: 'Exportar ZIP' }, PRIMERA_CARGA);
    const leer = vi.spyOn(espacio.almacen, 'leer').mockRejectedValue(new Error('roto'));
    fireEvent.click(boton);
    await waitFor(() =>
      expect(screen.getAllByText('No se pudo exportar. No se ha tocado nada.').length).toBeGreaterThan(0),
    );
    expect(descargas).toEqual([]);
    expect(espacio.estado().ultimaCopia).toBeNull();
    leer.mockRestore();

    const porcentajes: number[] = [];
    const baja = useExportacion.subscribe((s) => porcentajes.push(s.porcentaje));
    const [a, b] = await act(() => Promise.all([exportarEspacio(espacio, 'zip'), exportarEspacio(espacio, 'zip')]));
    baja();
    expect(a?.completa).toBe(true);
    expect(b).toBeNull();
    expect(porcentajes).toContain(100);
    expect(useExportacion.getState()).toEqual({ tipo: null, porcentaje: 0 });
    // La copia previa a algo destructivo lleva el motivo en el nombre.
    const previa = await act(() => exportarEspacio(espacio, 'zip', { motivo: 'antes de reemplazar' }));
    expect(previa?.nombre).toMatch(/-antes-de-reemplazar\.zip$/);
  }, 30_000);
});

/** Un espacio de mentira en memoria, con su estado de cuidado y el modo de la pestaña. */
async function espacioFalso(modo: 'escritor' | 'lector' = 'escritor') {
  const almacen = new AlmacenMemoria();
  const manifest = {
    formato: 'rimor',
    esquema: 1,
    espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Trabajo' },
    app: { version: '0.0.1' },
  } as EspacioExportable['manifest'];
  await escribirTexto(almacen, 'manifest.json', JSON.stringify(manifest));
  await escribirTexto(almacen, 'elementos/a.md', 'a');
  let estado: EstadoCuidado = { ...ESTADO_INICIAL, cambiosDesdeCopia: 3 };
  const guardados: EstadoCuidado[] = [];
  const espacio: EspacioExportable = {
    id: 'x',
    almacen,
    enMemoria: true,
    manifest,
    esperarEscrituras: async () => undefined,
    estado: () => estado,
    guardarEstado: async (cambio) => {
      estado = cambio(estado);
      guardados.push(estado);
    },
    coordinacion: { modo: () => modo },
  };
  return {
    espacio,
    almacen,
    guardados,
    cambiar: (n: number) => (estado = { ...estado, cambiosDesdeCopia: estado.cambiosDesdeCopia + n }),
  };
}

describe('exportarEspacio', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lo cambiado mientras se exporta sigue contando; la fecha es la del principio', async () => {
    const { espacio, almacen, guardados, cambiar } = await espacioFalso();
    const leer = almacen.leer.bind(almacen);
    // Dos cambios llegan a mitad de la exportación.
    vi.spyOn(almacen, 'leer').mockImplementation(async (ruta) => {
      if (ruta === 'elementos/a.md') cambiar(2);
      return leer(ruta);
    });
    const inicio = new Date('2026-10-22T10:00:00+02:00');
    const hecho = await exportarEspacio(espacio, 'zip', { reloj: () => inicio });
    expect(hecho?.apuntada).toBe(true);
    expect(guardados.at(-1)).toMatchObject({ cambiosDesdeCopia: 2, ultimaCopia: '2026-10-22T10:00:00+02:00' });
  });

  it('en la pestaña que solo lee, se descarga pero no se apunta como copia', async () => {
    const { espacio, guardados } = await espacioFalso('lector');
    const hecho = await exportarEspacio(espacio, 'zip');
    expect(hecho).toMatchObject({ completa: true, apuntada: false });
    expect(guardados).toEqual([]);
  });

  it('cancelar corta la exportación (aunque una lectura no vuelva) y no se descarga ni se apunta nada', async () => {
    const { espacio, almacen, guardados } = await espacioFalso();
    vi.spyOn(almacen, 'leer').mockImplementation(() => new Promise(() => undefined));
    const enMarcha = exportarEspacio(espacio, 'zip');
    await vi.waitFor(() => expect(useExportacion.getState().tipo).toBe('zip'));
    cancelarExportacion();
    await expect(enMarcha).rejects.toMatchObject({ name: 'AbortError' });
    expect(guardados).toEqual([]);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
    expect(useExportacion.getState()).toEqual({ tipo: null, porcentaje: 0 });
  });

  it('sin progreso durante el plazo, se da por atascada y se corta', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    const { espacio, almacen } = await espacioFalso();
    vi.spyOn(almacen, 'leer').mockImplementation(() => new Promise(() => undefined));
    const enMarcha = exportarEspacio(espacio, 'zip');
    const fallo = enMarcha.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(PLAZO_SIN_PROGRESO_MS + 10_000);
    expect(await fallo).toBe('exportar.atascada');
  });
});

describe('Ctrl+E con un diálogo abierto', () => {
  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('no exporta ni llega al navegador', async () => {
    await montarApp('/ajustes', [elementoFalso(1, 'hola', 'texto')]);
    await screen.findByRole('heading', { name: 'Ajustes' }, PRIMERA_CARGA);
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' })));
    const tecla = new KeyboardEvent('keydown', { key: 'e', ctrlKey: true, cancelable: true });
    act(() => void window.dispatchEvent(tecla));
    expect(tecla.defaultPrevented).toBe(true);
    expect(useExportacion.getState().tipo).toBeNull();
  }, 30_000);
});
