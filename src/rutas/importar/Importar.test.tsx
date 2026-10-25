import { type Elemento, escribirElemento, rutaElemento } from '@rimor/formato';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { zipSync } from 'fflate';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { escribirTexto, leerTexto, listarTodo } from '../../almacen/contrato';
import { AlmacenMemoria } from '../../almacen/memoria';
import { exportarZip } from '../../datos/exportar';
import { useArchivoImportar } from '../../datos/importar/importacion';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { lectorTexto } from '../../lectores/texto/lector';
import { ESCRITURA, montarApp, PRIMERA_CARGA } from '../../pruebas/app';

/**
 * El resumen de verdad de lector Texto para `texto N` (el mismo para todos). Con el de mentira de `elementoFalso`, la
 * puesta al día del resumen (en segundo plano) escribiría a destiempo y cambiaría lo que se compara.
 */
let resumenTexto: Record<string, unknown> = {};

function el(n: number, cambios: Partial<Elemento['frontmatter']> = {}): Elemento {
  const base = elementoFalso(n, `texto ${n}`, 'texto');
  const lector = { nombre: 'texto', version: lectorTexto.version, resumen: resumenTexto };
  return { ...base, frontmatter: { ...base.frontmatter, lector, ...cambios } };
}

/** Un ZIP exportado de otro espacio con estos elementos. */
async function zipDe(elementos: Elemento[]): Promise<File> {
  const a = new AlmacenMemoria();
  await escribirTexto(
    a,
    'manifest.json',
    JSON.stringify({
      formato: 'rimor',
      esquema: 1,
      espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Otro' },
      app: { version: '0.1.0' },
    }),
  );
  for (const e of elementos)
    await escribirTexto(
      a,
      rutaElemento(e.frontmatter.ref, e.frontmatter.titulo, e.frontmatter.creado),
      escribirElemento(e),
    );
  const { trozos } = await exportarZip(a, {
    ahora: new Date('2026-10-15T12:00:00+02:00'),
    version: '0.1.0',
    ceder: async () => undefined,
  });
  return new File(trozos as Uint8Array<ArrayBuffer>[], 'rimor-otro-2026-10-15.zip', { type: 'application/zip' });
}

async function volcado(almacen: AlmacenMemoria) {
  const salida: Record<string, string> = {};
  for (const { ruta } of await listarTodo(almacen, '')) salida[ruta] = (await leerTexto(almacen, ruta)) ?? '';
  return salida;
}

describe('Importar', () => {
  beforeAll(async () => {
    await import('./Importar');
    await import('../datos/Datos');
    await import('../ajustes/Ajustes');
    await import('../inicio/Inicio');
    resumenTexto = lectorTexto.resumen(await lectorTexto.derivar(elementoFalso(1, 'texto 1', 'texto')));
  }, 120_000);

  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prueba');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    useArchivoImportar.setState({ archivo: null });
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 300)));
  });

  it('un ZIP malicioso se rechaza con su archivo y su regla, sin escribir nada', async () => {
    const { router, almacen } = await montarApp('/ajustes', [el(1)]);
    const antes = await volcado(almacen);
    const malo = zipSync({
      'manifest.json': new TextEncoder().encode(
        '{"formato":"rimor","esquema":1,"espacio":{"id":"x","nombre":"x"},"app":{"version":"0.1.0"}}',
      ),
      '../fuera.md': new TextEncoder().encode('x'),
    });
    act(() => useArchivoImportar.setState({ archivo: new File([malo], 'malo.zip') }));
    await act(() => router.navigate({ to: '/importar' }));
    const error = await screen.findByRole('alert', {}, PRIMERA_CARGA);
    expect(within(error).getByText('No se puede importar este archivo')).toBeTruthy();
    expect(error.textContent).toContain(
      '../fuera.md: es una ruta que sale del espacio o no es válida. No se ha escrito nada.',
    );
    expect(await volcado(almacen)).toEqual(antes);
  }, 30_000);

  it('vista previa (nuevos, idénticos, actualizados, conflictos) y fusionar', async () => {
    const aquiDespues = el(2, { titulo: 'Dos aquí', modificado: '2026-10-16T10:00:00+02:00' });
    const { router, espacio } = await montarApp('/ajustes', [el(1), aquiDespues]);
    const archivo = await zipDe([el(1), el(2, { titulo: 'Dos allí', modificado: '2026-10-15T08:00:00+02:00' }), el(3)]);
    act(() => useArchivoImportar.setState({ archivo }));
    await act(() => router.navigate({ to: '/importar' }));
    await screen.findByText(/^ZIP válido: esquema 1, 3 archivos/, {}, PRIMERA_CARGA);
    const cifras = [...document.querySelectorAll('.stat')].map((s) => s.textContent);
    expect(cifras).toEqual(['1nuevos', '1idénticos', '0actualizados', '1en conflicto']);
    fireEvent.click(screen.getByText('Ver el conflicto'));
    expect(screen.getByText(/se queda la de aquí; la otra, al historial/)).toBeTruthy();
    // La ref del conflicto se puede pulsar (como `refb` en `SC.importar`): enseña el de aquí sin salir de Importar.
    const ref = document.querySelector('.kv dt button.ref') as HTMLElement;
    fireEvent.click(ref);
    const visto = screen.getByRole('heading', { name: `${ref.textContent}, en este espacio` }).closest('dialog');
    expect(visto?.querySelector('.tarjeta-elemento')).toBeTruthy();
    fireEvent.click(within(visto as HTMLElement).getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByRole('button', { name: 'Importar' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Fusionar/ })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    await screen.findByText(/^Importado: 1 nuevos, 0 actualizados, 1 conflictos resueltos/, {}, ESCRITURA);
    await waitFor(() => expect(espacio.repositorio.frontmatter('TXT-0003')).toBeTruthy());
    expect(espacio.repositorio.frontmatter('TXT-0002')?.titulo).toBe('Dos aquí');
    // El final se queda a la vista y el archivo se olvida: no se puede importar otra vez sin elegirlo.
    expect(screen.getByRole('heading', { name: 'Importación terminada' })).toBeTruthy();
    expect(useArchivoImportar.getState().archivo).toBeNull();
  }, 30_000);

  it('reemplazar exporta antes una copia y deja solo lo del archivo', async () => {
    const { router, espacio } = await montarApp('/ajustes', [el(1), el(5, { titulo: 'Solo aquí' })]);
    const archivo = await zipDe([el(1), el(2)]);
    act(() => useArchivoImportar.setState({ archivo }));
    await act(() => router.navigate({ to: '/importar' }));
    await screen.findByText(/^ZIP válido/, {}, PRIMERA_CARGA);
    fireEvent.click(screen.getByRole('radio', { name: /Reemplazar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    await screen.findByText(/^Importado:/, {}, ESCRITURA);
    // La copia previa se descargó con su motivo en el nombre.
    const descargas = vi.mocked(HTMLAnchorElement.prototype.click).mock.contexts as HTMLAnchorElement[];
    expect(descargas.map((a) => a.download)).toEqual([expect.stringMatching(/-antes-de-reemplazar\.zip$/)]);
    await waitFor(() => expect(espacio.repositorio.frontmatter('TXT-0005')).toBeUndefined());
    expect(espacio.repositorio.frontmatter('TXT-0002')).toBeTruthy();
  }, 30_000);

  it('sin el ZIP previo, «Reemplazar» dice que no se exporta copia y no la exporta', async () => {
    const { router, espacio } = await montarApp('/ajustes', [el(1)]);
    await act(() => espacio.guardarAjustes((a) => ({ ...a, copias: { ...a.copias, zipPrevio: false } })));
    act(() => useArchivoImportar.setState({ archivo: null }));
    const archivo = await zipDe([el(2)]);
    act(() => useArchivoImportar.setState({ archivo }));
    await act(() => router.navigate({ to: '/importar' }));
    await screen.findByText(/^ZIP válido/, {}, PRIMERA_CARGA);
    expect(screen.getByText(/No se exporta una copia antes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Reemplazar/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }));
    await screen.findByText(/^Importado:/, {}, ESCRITURA);
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  }, 30_000);

  it('Datos y copias lista los demás espacios de este navegador para abrirlos', async () => {
    localStorage.setItem('rimor:espacios', JSON.stringify([{ id: 'otro', nombre: 'Trabajo (importado)' }]));
    const { router } = await montarApp('/ajustes', [el(1)]);
    await act(() => router.navigate({ to: '/datos' }));
    fireEvent.click(await screen.findByText('Espacios y papelera', {}, PRIMERA_CARGA));
    expect(screen.getByText('Trabajo (importado)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir' })).toBeTruthy();
    localStorage.removeItem('rimor:espacios');
  }, 30_000);

  it('«Importar…» en Datos y copias elige el archivo y lleva a la pantalla', async () => {
    const { router } = await montarApp('/ajustes', [el(1)]);
    await act(() => router.navigate({ to: '/datos' }));
    await screen.findByRole('button', { name: 'Importar…' }, PRIMERA_CARGA);
    const selector = document.querySelector('input[type="file"]') as HTMLInputElement;
    const archivo = await zipDe([el(1)]);
    Object.defineProperty(selector, 'files', { value: [archivo], configurable: true });
    fireEvent.change(selector);
    await waitFor(() => expect(router.state.location.pathname).toBe('/importar'));
    expect(await screen.findByRole('heading', { name: 'rimor-otro-2026-10-15.zip' }, PRIMERA_CARGA)).toBeTruthy();
  }, 30_000);
});
