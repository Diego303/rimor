import 'fake-indexeddb/auto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../espacio/Espacio';
import VistaArchivo from './archivo/Vista';
import { elementoFalso } from './pruebas/falsos';
import VistaTexto from './texto/Vista';

describe('vista de Texto', () => {
  it('pinta el Markdown saneado (sin scripts) con sus enlaces y menciones', () => {
    const el = elementoFalso(
      1,
      '# Título\n\n**negrita** <script>window.malo = 1</script> https://docs.rs/ureq ERR-0015',
      'texto',
    );
    const { container } = render(
      <VistaTexto
        el={el}
        datos={{ lineas: 3, palabras: 6, enlaces: ['https://docs.rs/ureq'], menciones: ['ERR-0015'] }}
      />,
    );
    expect(container.querySelector('h1')?.textContent).toBe('Título');
    expect(container.querySelector('strong')?.textContent).toBe('negrita');
    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { malo?: number }).malo).toBeUndefined();
    const enlace = screen.getAllByRole('link', { name: 'https://docs.rs/ureq' }).at(-1);
    expect(enlace?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('link', { name: 'ERR-0015' }).getAttribute('href')).toBe('#/e/ERR-0015');
  });
});

describe('vista de Archivo', () => {
  it('enseña nombre, tamaño y tipo, y descarga los bytes del adjunto', async () => {
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    const almacen = new AlmacenMemoria();
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-archivo',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const blobs: Blob[] = [];
    // Sin tocar el `URL` global para siempre: espías que se restauran al acabar.
    const crear = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob);
      return 'blob:x';
    });
    const revocar = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    function ConAdjunto() {
      const { repositorio } = useEspacioAbierto();
      const base = elementoFalso(1, '', 'archivo');
      const el = {
        ...base,
        original: null,
        frontmatter: {
          ...base.frontmatter,
          tipo: 'archivo' as const,
          adjunto: { hash: 'b'.repeat(64), ruta: 'adjuntos/bb/datos.bin', nombre: 'datos.bin', mime: '', tam: 3 },
        },
      };
      void repositorio;
      return <VistaArchivo el={el} datos={{ nombre: 'datos.bin', tam: 3, mime: '' }} />;
    }
    await almacen.escribir('adjuntos/bb/datos.bin', new Uint8Array([7, 8, 9]));
    render(
      <ProveedorEspacio dependencias={dependencias}>
        <ConAdjunto />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('datos.bin')).toBeTruthy();
    expect(screen.getByText(/^3\sB$/)).toBeTruthy();
    expect(screen.getByText('tipo desconocido')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar el original' }));
    await waitFor(() => expect(clic).toHaveBeenCalled());
    expect(new Uint8Array((await blobs[0]?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(new Uint8Array([7, 8, 9]));
    clic.mockRestore();
    crear.mockRestore();
    revocar.mockRestore();
  });
});
