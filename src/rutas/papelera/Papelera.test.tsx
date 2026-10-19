import 'fake-indexeddb/auto';
import { type Elemento, hashOriginal } from '@rimor/formato';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { unzipSync } from 'fflate';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import type { Cerrojos } from '../../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioOpcional } from '../../espacio/Espacio';
import { ejecutorEnHilo } from '../../lectores/ejecutor';
import { ProveedorLectores } from '../../lectores/Lectores';
import { REGISTRO } from '../../lectores/registro';
import { crearRouter } from '../rutas';

const descargas = vi.hoisted(() => ({ hechas: [] as { bytes: Uint8Array; nombre: string }[], fallar: false }));
vi.mock('../../lectores/descargar', () => ({
  descargar: (bytes: Uint8Array, nombre: string) => {
    if (descargas.fallar) throw new Error('el navegador no deja descargar');
    descargas.hechas.push({ bytes, nombre });
  },
}));

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
const PRIMERA_CARGA = { timeout: 15_000 };
const ESCRITURA = { timeout: 5000 };

const elemento = (n: number, titulo: string): Elemento => ({
  frontmatter: {
    id: `01JAB4C2Q2X8M5N7P0R4S6T8V${n}`,
    ref: `TXT-000${n}` as Elemento['frontmatter']['ref'],
    tipo: 'texto',
    titulo,
    creado: `2026-10-1${n}T18:44:03+02:00`,
    modificado: `2026-10-1${n}T18:44:03+02:00`,
    origen: 'pegado',
    hash: hashOriginal(`texto ${n}`),
    ocultados: 0,
    lector: { nombre: 'texto', version: 1, resumen: {} },
  },
  notas: '',
  original: `texto ${n}`,
});

async function montar(ruta: string) {
  const dependencias = async (): Promise<DependenciasProveedor> => ({
    espacioId: `papelera-${Math.random()}`,
    almacen: new AlmacenMemoria(),
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
  const router = crearRouter(createMemoryHistory({ initialEntries: ['/ajustes'] }));
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={REGISTRO} ejecutar={ejecutorEnHilo(REGISTRO)}>
        <Espia />
        <RouterProvider router={router} />
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
  await waitFor(() => expect(abierto.e).toBeTruthy(), PRIMERA_CARGA);
  const repo = abierto.e?.repositorio;
  if (!repo) throw new Error('sin repositorio');
  await act(async () => {
    for (const [n, titulo] of [
      [1, 'Primero'],
      [2, 'Segundo'],
      [3, 'Se queda'],
    ] as const)
      await repo.guardarElemento(elemento(n, titulo));
    await repo.moverAPapelera('TXT-0001');
    await repo.moverAPapelera('TXT-0002');
  });
  await act(() => router.navigate({ to: ruta }));
  return { repo, router };
}

describe('Papelera', () => {
  beforeAll(async () => {
    await import('./Papelera');
    await import('../datos/Datos');
  }, 120_000);

  beforeEach(() => {
    descargas.hechas = [];
    descargas.fallar = false;
  });

  afterEach(async () => {
    cleanup();
    await act(async () => new Promise((r) => setTimeout(r, 200)));
  });

  it('se llega desde Datos y copias, con el recuento', async () => {
    const { router } = await montar('/datos');
    expect(await screen.findByText('2 elementos, se pueden restaurar', {}, PRIMERA_CARGA)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ver la papelera' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/papelera'));
  }, 30_000);

  it('lista lo que hay (lo más reciente arriba) y restaura uno', async () => {
    const { repo } = await montar('/papelera');
    await screen.findByRole('heading', { name: 'Papelera' }, PRIMERA_CARGA);
    await waitFor(() =>
      expect([...document.querySelectorAll('.fila-papelera .tt')].map((e) => e.textContent)).toEqual([
        'Segundo',
        'Primero',
      ]),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar TXT-0002' }));
    await waitFor(() => expect(repo.buscar('TXT-0002')?.enPapelera).toBe(false), ESCRITURA);
    await waitFor(() => expect(document.querySelectorAll('.fila-papelera')).toHaveLength(1));
  }, 30_000);

  it('vaciar en dos pasos: primero se descarga el ZIP con lo que había; después se borra lo que entró', async () => {
    const { repo } = await montar('/papelera');
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar la papelera' }, PRIMERA_CARGA));
    const dialogo = within(document.querySelector('dialog') as HTMLElement);
    expect(
      dialogo.getByText(
        'Se borrarán para siempre 2 elementos. Primero descarga el ZIP con todos; después podrás vaciarla.',
      ),
    ).toBeTruthy();
    // Sin el ZIP descargado no se puede vaciar.
    const vaciar = dialogo.getByRole('button', { name: 'Vaciar la papelera' }) as HTMLButtonElement;
    expect(vaciar.disabled).toBe(true);
    // Mientras tanto, nada se restaura (lo copiado se va a borrar).
    expect((screen.getByRole('button', { name: 'Restaurar TXT-0001' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(await dialogo.findByRole('button', { name: 'Descargar el ZIP' }));
    expect(descargas.hechas).toHaveLength(1);
    expect(descargas.hechas[0]?.nombre).toMatch(/^rimor-.+-papelera-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(Object.keys(unzipSync(descargas.hechas[0]?.bytes ?? new Uint8Array())).sort()).toEqual([
      'papelera/elementos/2026/10/TXT-0001--primero.md',
      'papelera/elementos/2026/10/TXT-0002--segundo.md',
    ]);
    expect(repo.enPapelera()).toHaveLength(2);
    expect(vaciar.disabled).toBe(false);
    fireEvent.click(vaciar);
    await waitFor(() => expect(repo.enPapelera()).toEqual([]), ESCRITURA);
    expect(repo.elementos().map((fm) => fm.ref)).toEqual(['TXT-0003']);
    expect(await screen.findByText('La papelera está vacía')).toBeTruthy();
  }, 30_000);

  it('si el ZIP no se puede descargar, no se puede vaciar ni se borra nada', async () => {
    descargas.fallar = true;
    const { repo } = await montar('/papelera');
    fireEvent.click(await screen.findByRole('button', { name: 'Vaciar la papelera' }, PRIMERA_CARGA));
    const dialogo = within(document.querySelector('dialog') as HTMLElement);
    fireEvent.click(await dialogo.findByRole('button', { name: 'Descargar el ZIP' }));
    expect((await screen.findAllByText('No se pudo descargar el ZIP: no se ha borrado nada.')).length).toBeGreaterThan(
      0,
    );
    expect((dialogo.getByRole('button', { name: 'Vaciar la papelera' }) as HTMLButtonElement).disabled).toBe(true);
    // Cancelar deja todo como estaba y se vuelve a poder restaurar.
    fireEvent.click(dialogo.getByRole('button', { name: 'Cancelar' }));
    expect(repo.enPapelera()).toHaveLength(2);
    expect((screen.getByRole('button', { name: 'Restaurar TXT-0001' }) as HTMLButtonElement).disabled).toBe(false);
  }, 30_000);
});
