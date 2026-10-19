import 'fake-indexeddb/auto';
import { type Elemento, hashOriginal, isoConZona } from '@rimor/formato';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import type { Cerrojos } from '../../almacen/pestanas';
import { useCompositor } from '../../captura/compositor';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioOpcional } from '../../espacio/Espacio';
import { useFrescos } from '../../estado/frescos';
import { ejecutorEnHilo } from '../../lectores/ejecutor';
import { ProveedorLectores } from '../../lectores/Lectores';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { REGISTRO } from '../../lectores/registro';
import { crearRouter } from '../rutas';
import { olvidarElementos } from './useElemento';

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
/** La primera pantalla carga en frío sus módulos (con todos los lectores): se mira lo que pinta, no cuánto tarda. */
const PRIMERA_CARGA = { timeout: 15_000 };

/** Un texto capturado hoy, `minutos` antes de ahora. */
function capturado(i: number, titulo: string, minutos: number): Elemento {
  const original = `${titulo}\nSegunda línea del elemento ${i}.`;
  const base = elementoFalso(i, original, 'texto');
  const creado = isoConZona(new Date(Date.now() - minutos * 60_000));
  return {
    ...base,
    frontmatter: { ...base.frontmatter, titulo, creado, modificado: creado, hash: hashOriginal(original) },
  };
}

function montar() {
  const almacen = new AlmacenMemoria();
  const dependencias = async (): Promise<DependenciasProveedor> => ({
    espacioId: `inicio-${Math.random()}`,
    almacen,
    fabricaIndexedDb: new IDBFactory(),
    cerrojos,
    canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
    enMemoria: false,
  });
  const abierto: { e: ReturnType<typeof useEspacioOpcional> } = { e: null };
  function Espia() {
    abierto.e = useEspacioOpcional();
    return null;
  }
  const router = crearRouter(createMemoryHistory({ initialEntries: ['/'] }));
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={REGISTRO} ejecutar={ejecutorEnHilo(REGISTRO)}>
        <Espia />
        <RouterProvider router={router} />
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
  return { abierto, router };
}

const tecla = (key: string) => act(() => void fireEvent.keyDown(window, { key }));
/** Las escrituras van en turno por elemento: bajo carga, alguna tarda más de lo que `waitFor` espera por defecto. */
const ESCRITURA = { timeout: 5000 };
const seleccionado = () => document.querySelector('.msg.sel')?.getAttribute('data-ref') ?? null;

describe('Inicio', () => {
  afterEach(async () => {
    // Desmontar y dar tiempo a lo que sigue en marcha (derivados en la cola, cierre del espacio): que nada termine
    // después de desmontar el entorno de pruebas.
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 500)));
    useCompositor.setState({ texto: '', archivos: [], respondiendoA: null, busquedas: [] });
    useFrescos.setState({ capturados: {} });
    olvidarElementos();
  });

  it('primer uso: ejemplos de qué pegar que llenan el compositor', async () => {
    montar();
    const ejemplo = await screen.findByRole('button', { name: /Un log/ }, PRIMERA_CARGA);
    expect(screen.getByText('Pega lo primero que tengas a mano')).toBeTruthy();
    fireEvent.click(ejemplo);
    expect(useCompositor.getState().texto).toContain('ERROR stream: read timeout');
  }, 30_000);

  it('feed por días y triaje completo con teclado', async () => {
    const { abierto, router } = montar();
    await waitFor(() => expect(abierto.e).toBeTruthy(), PRIMERA_CARGA);
    const repo = abierto.e?.repositorio;
    if (!repo) throw new Error('sin repositorio');
    await act(async () => {
      await repo.guardarElemento(capturado(1, 'Revisar el timeout del gateway', 30));
      await repo.guardarElemento(capturado(2, 'Probar ureq con 64 KB', 20));
      await repo.guardarElemento(capturado(3, 'Notas de la reunión', 10));
    });
    useFrescos.getState().anadir([repo.frontmatter('TXT-0003')?.id ?? '']);

    // Los mensajes, en orden cronológico, bajo «Hoy»; el fresco, con su borde.
    await screen.findByRole('button', { name: 'Notas de la reunión' }, PRIMERA_CARGA);
    expect(screen.getByText('Hoy')).toBeTruthy();
    const refs = () => [...document.querySelectorAll('.msg')].map((m) => m.getAttribute('data-ref'));
    expect(refs()).toEqual(['TXT-0001', 'TXT-0002', 'TXT-0003']);
    expect(document.querySelector('.msg.fresh')?.getAttribute('data-ref')).toBe('TXT-0003');
    expect(screen.getByRole('button', { name: /Sin clasificar · 3/ })).toBeTruthy();
    // Vista previa: la primera línea que no es el título.
    // (Se lee al montarse el mensaje: llega un momento después.)
    expect(await screen.findAllByText('Segunda línea del elemento 1.')).toHaveLength(1);

    // j / k: sin selección, j empieza por lo más reciente; k sube.
    await tecla('j');
    expect(seleccionado()).toBe('TXT-0003');
    await tecla('k');
    expect(seleccionado()).toBe('TXT-0002');
    await tecla('j');
    await tecla('j');
    expect(seleccionado()).toBe('TXT-0003');
    await tecla('k');

    // f: fijar.
    await tecla('f');
    await waitFor(() => expect(repo.frontmatter('TXT-0002')?.fijado).toBe(true), ESCRITURA);

    // x: seleccionar para comparar o agrupar; Esc vacía la selección.
    await tecla('x');
    expect(screen.getByText('1 seleccionado')).toBeTruthy();
    await tecla('Escape');
    expect(screen.queryByText('1 seleccionado')).toBeNull();

    // c: añadir a colección (sale de «Sin clasificar»).
    await tecla('c');
    const campo = await screen.findByLabelText('Colección');
    fireEvent.change(campo, { target: { value: '@Gateway' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir' }));
    await waitFor(() => expect(repo.frontmatter('TXT-0002')?.colecciones).toEqual(['gateway']), ESCRITURA);

    // r: responder (el compositor pasa a modo respuesta).
    await tecla('r');
    expect(useCompositor.getState().respondiendoA).toBe('TXT-0002');

    // Dentro de un campo de texto, las letras son letras: j no mueve la selección.
    const caja = screen.getByRole('textbox', { name: /Capturar|Pega/ });
    caja.focus();
    fireEvent.keyDown(caja, { key: 'j' });
    expect(seleccionado()).toBe('TXT-0002');
    caja.blur();

    // t: cambiar tipo (otra ref, la vieja en alias, y una corrección contada).
    await tecla('t');
    fireEvent.click(await screen.findByRole('button', { name: /Idea/ }));
    await waitFor(() => expect(repo.frontmatter('IDE-0001')?.alias).toEqual(['TXT-0002']), ESCRITURA);
    await waitFor(() => expect(abierto.e?.contadores.total('correccionesDeTipo')).toBe(1), ESCRITURA);
    expect(seleccionado()).toBe('IDE-0001');

    // e: archivar (sale del feed).
    await tecla('e');
    await waitFor(() => expect(repo.frontmatter('IDE-0001')?.estado).toBe('archivado'), ESCRITURA);
    await waitFor(() => expect(refs()).toEqual(['TXT-0001', 'TXT-0003']), ESCRITURA);

    // Lo seleccionado ya no está (archivado): la selección pasa al vecino que ocupa su sitio.
    expect(seleccionado()).toBe('TXT-0003');

    // Enter sobre un botón es del botón: no abre lo seleccionado ni se pierde la tecla.
    const archivarUno = document.querySelector('.msg[data-ref="TXT-0001"] .mact .ibtn:last-child') as HTMLElement;
    archivarUno.focus();
    let siguio = false;
    await act(() => {
      siguio = fireEvent.keyDown(archivarUno, { key: 'Enter' });
    });
    expect(siguio).toBe(true);
    expect(router.state.location.pathname).toBe('/');

    // Enter: abrir (con el foco en el mensaje seleccionado, como lo deja j/k).
    await tecla('j');
    expect(seleccionado()).toBe('TXT-0003');
    expect(document.activeElement?.getAttribute('data-ref')).toBe('TXT-0003');
    await tecla('Enter');
    await waitFor(() => expect(router.state.location.pathname).toBe('/e/TXT-0003'), ESCRITURA);
  }, 30_000);

  it('«Sin clasificar» y las búsquedas del compositor con sus resultados', async () => {
    const { abierto } = montar();
    await waitFor(() => expect(abierto.e).toBeTruthy(), PRIMERA_CARGA);
    const repo = abierto.e?.repositorio;
    if (!repo) throw new Error('sin repositorio');
    await act(async () => {
      await repo.guardarElemento(capturado(1, 'Timeout en el stream', 30));
      const conColeccion = capturado(2, 'Otro timeout', 20);
      await repo.guardarElemento({
        ...conColeccion,
        frontmatter: { ...conColeccion.frontmatter, colecciones: ['gateway'] },
      });
    });
    await screen.findByRole('button', { name: 'Timeout en el stream' }, PRIMERA_CARGA);
    act(() => useCompositor.getState().anotarBusqueda('timeout', isoConZona(new Date())));
    expect(await screen.findByText('2 resultados:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Abrir en Buscar' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Sin clasificar/ }));
    await waitFor(() =>
      expect([...document.querySelectorAll('.msg[data-ref]')].map((m) => m.getAttribute('data-ref'))).toEqual([
        'TXT-0001',
      ]),
    );
  }, 30_000);
});
