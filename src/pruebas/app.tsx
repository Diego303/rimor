/**
 * Para las pruebas de pantalla: la app entera (espacio en memoria, lectores con su ejecutor en el hilo y el router
 * en memoria) con unos elementos guardados, en la ruta pedida. Solo para pruebas.
 */
import 'fake-indexeddb/auto';
import type { Elemento } from '@rimor/formato';
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { act, render, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { expect } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { ProveedorBusqueda } from '../busqueda/Busqueda';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioOpcional } from '../espacio/Espacio';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { ProveedorLectores } from '../lectores/Lectores';
import { REGISTRO } from '../lectores/registro';
import { crearRouter } from '../rutas/rutas';

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
/** La primera pantalla carga en frío sus módulos y la vista del lector: se mira lo que pinta, no cuánto tarda. */
export const PRIMERA_CARGA = { timeout: 15_000 };
/** Las escrituras van en turno: bajo carga, alguna tarda más de lo que `waitFor` espera por defecto. */
export const ESCRITURA = { timeout: 5000 };

export async function montarApp(ruta: string, elementos: readonly Elemento[] = []) {
  const almacen = new AlmacenMemoria();
  const dependencias = async (): Promise<DependenciasProveedor> => ({
    espacioId: `app-${Math.random()}`,
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
  // Primero una pantalla ligera: los elementos se guardan antes de ir a la pedida.
  const router = crearRouter(createMemoryHistory({ initialEntries: ['/ajustes'] }));
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={REGISTRO} ejecutar={ejecutorEnHilo(REGISTRO)}>
        <ProveedorBusqueda enHilo>
          <Espia />
          <RouterProvider router={router} />
        </ProveedorBusqueda>
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
  await waitFor(() => expect(abierto.e).toBeTruthy(), PRIMERA_CARGA);
  const espacio = abierto.e;
  if (!espacio) throw new Error('sin espacio');
  await act(async () => {
    for (const el of elementos) await espacio.repositorio.guardarElemento(el);
  });
  await act(() => router.navigate({ to: ruta }));
  return { espacio, router, almacen };
}
