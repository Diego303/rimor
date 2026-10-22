import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportarEspacio, useExportacion } from '../../datos/exportacion';
import { MAX_ADJUNTO_JSON } from '../../datos/exportar';
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
