import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // El enlace temporal no se revoca enseguida (Safari cancelaría la descarga).
    expect(revocar).not.toHaveBeenCalled();
    expect(new Uint8Array((await blobs[0]?.arrayBuffer()) ?? new ArrayBuffer(0))).toEqual(new Uint8Array([7, 8, 9]));
    clic.mockRestore();
    crear.mockRestore();
    revocar.mockRestore();
  });
});

describe('vista de Texto guardado aparte', () => {
  it('enseña su principio y deja descargarlo entero', async () => {
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    const almacen = new AlmacenMemoria();
    await almacen.escribir('adjuntos/cc/grande.txt', new TextEncoder().encode('principio del texto enorme'));
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-texto-grande',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const base = elementoFalso(5, '', 'texto');
    const el = {
      ...base,
      original: null,
      frontmatter: {
        ...base.frontmatter,
        adjunto: { hash: 'c'.repeat(64), ruta: 'adjuntos/cc/grande.txt', mime: 'text/plain', tam: 3_000_000 },
      },
    };
    render(
      <ProveedorEspacio dependencias={dependencias}>
        <VistaTexto el={el} datos={{ lineas: 0, palabras: 0, enlaces: [], menciones: [] }} />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('principio del texto enorme')).toBeTruthy();
    expect(screen.getByText(/guardado aparte por su tamaño/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Descargar el texto completo' })).toBeTruthy();
  });
});

describe('vista de Enlace', () => {
  it('enlaza la dirección limpia aparte y enseña lo pegado si era distinto', async () => {
    const { default: VistaEnlace } = await import('./enlace/Vista');
    const el = elementoFalso(7, 'https://docs.rs/ureq?utm_source=hn', 'enlace');
    render(
      <VistaEnlace
        el={el}
        datos={{ url: 'https://docs.rs/ureq', clase: 'documentacion', sitio: 'docs.rs', nombre: 'ureq' }}
      />,
    );
    const enlace = screen.getByRole('link', { name: 'https://docs.rs/ureq' });
    expect(enlace.getAttribute('rel')).toContain('noopener');
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Documentación')).toBeTruthy();
    expect(screen.getByText('https://docs.rs/ureq?utm_source=hn')).toBeTruthy();
  });
});

describe('vista de Log', () => {
  it('cifras, histograma, plantillas que filtran sus líneas y «Ver las N»', async () => {
    const { default: VistaLog } = await import('./log/Vista');
    const { analizar } = await import('./log/analisis');
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const texto = readFileSync(join(process.cwd(), 'fixtures/logs/texto-iso.log'), 'utf8');
    const el = elementoFalso(8, texto, 'log');
    const datos = analizar(texto, { anio: 2026 });
    const { container } = render(<VistaLog el={el} datos={datos} />);
    expect(container.querySelector('.stat .v.bad')?.textContent).toBe('3');
    expect(container.querySelector('.stat .v.warn')?.textContent).toBe('1');
    expect(container.querySelectorAll('.histograma-log .barra-errores').length).toBeGreaterThan(0);
    expect(screen.getByText(/Los errores se concentran entre/).textContent).toBe(
      'Los errores se concentran entre 17:40 y 17:43.',
    );
    const filas = container.querySelectorAll('.tabla-plantillas tr');
    expect(filas).toHaveLength(5);
    // Con 5 plantillas no hace falta «Ver las N»: solo sale cuando hay más.
    expect(screen.queryByRole('button', { name: /Ver las/ })).toBeNull();
    const deError = [...filas].find((f) => f.textContent?.includes('read timeout')) as HTMLElement;
    expect(deError.querySelector('.lv-ERROR')).toBeTruthy();
    expect(deError.querySelector('.ph')?.textContent).toBe('N');
    fireEvent.click(deError.querySelector('button') as HTMLElement);
    expect(deError.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
    const lineas = container.querySelector('pre.lineas-plantilla')?.textContent ?? '';
    expect(lineas.split('\n').filter(Boolean)).toHaveLength(3);
  });
});

describe('vista de Error', () => {
  it('mensaje, «3.ª vez» con la nota, tus marcos, plegados y «Añadir cómo lo resolví»', async () => {
    const { default: VistaError } = await import('./error/Vista');
    const { analizarError } = await import('./error/lector');
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { ProveedorAvisos } = await import('../ui/componentes');
    const texto = readFileSync(join(process.cwd(), 'fixtures/trazas/rust/01.txt'), 'utf8');
    const datos = analizarError(texto);
    const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
    const almacen = new AlmacenMemoria();
    const dependencias = async (): Promise<DependenciasProveedor> => ({
      espacioId: 'vista-error',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
      enMemoria: false,
    });
    const conHuella = (n: number, dia: number, cambios = {}) => {
      const base = elementoFalso(n, `${texto}\n${n}`, 'error');
      return {
        ...base,
        frontmatter: {
          ...base.frontmatter,
          tipo: 'error' as const,
          ref: `ERR-${String(n).padStart(4, '0')}` as const,
          creado: `2026-10-${String(dia).padStart(2, '0')}T10:00:00+02:00`,
          lector: { nombre: 'error', version: 1, resumen: { huella: datos.huella } },
          ...cambios,
        },
      };
    };
    const actual = conHuella(3, 17);
    const abierto: { repo: ReturnType<typeof useEspacioAbierto>['repositorio'] | null } = { repo: null };
    function Montaje() {
      const { repositorio } = useEspacioAbierto();
      abierto.repo = repositorio;
      return <VistaError el={actual} datos={datos} />;
    }
    render(
      <ProveedorEspacio dependencias={dependencias}>
        <ProveedorAvisos>
          <Montaje />
        </ProveedorAvisos>
      </ProveedorEspacio>,
    );
    await waitFor(() => expect(abierto.repo).toBeTruthy());
    await act(async () => {
      await abierto.repo?.guardarElemento({ ...conHuella(1, 2), notas: '' });
      // La nota se fecha cuando se escribió (al resolverlo): su `modificado`.
      await abierto.repo?.guardarElemento({
        ...conHuella(2, 15, { estado: 'resuelto', modificado: '2026-10-15T18:00:00+02:00' }),
        notas: 'Pasa cuando la respuesta no trae content-length',
      });
      await abierto.repo?.guardarElemento(actual);
    });
    expect(await screen.findByText('3.ª vez')).toBeTruthy();
    expect(screen.getByText('Ya te pasó el 2 oct y el 15 oct.')).toBeTruthy();
    expect(screen.getByText('El 15 oct escribiste: «Pasa cuando la respuesta no trae content-length»')).toBeTruthy();
    expect(screen.getByText('struo_gateway::stream::next_chunk')).toBeTruthy();
    expect(screen.getByText('Librerías y sistema (5 marcos)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir cómo lo resolví' }));
    fireEvent.change(screen.getByLabelText('Cómo lo resolviste'), { target: { value: 'Subí el timeout a 60 s' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(abierto.repo?.frontmatter('ERR-0003')?.estado).toBe('resuelto'));
    const leido = await abierto.repo?.leerElemento('ERR-0003');
    expect(leido?.ok && leido.valor.notas.startsWith('Subí el timeout a 60 s')).toBe(true);
  });
});
