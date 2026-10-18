import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { escribirTexto, leerTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Canal, Cerrojos } from '../almacen/pestanas';
import { useEspacio } from '../estado/espacio';
import { ESTADOS_SENAL, UMBRAL_ESPERA_MS } from '../ui/marca/estadosSenal';
import { AvisoAlmacenamiento, TarjetaCuidado, TarjetaPersistencia } from './Avisos';
import { type DependenciasProveedor, ProveedorEspacio } from './Espacio';
import { leerEstado, RUTA_ESTADO } from './estado';
import { RUTA_MANIFEST } from './manifest';

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
const canal = (): Canal => ({
  postMessage: () => undefined,
  addEventListener: () => undefined,
  close: () => undefined,
});

function dependencias(almacen = new AlmacenMemoria(), extra: Partial<DependenciasProveedor> = {}) {
  return async (): Promise<DependenciasProveedor> => ({
    espacioId: 'prueba',
    almacen,
    fabricaIndexedDb: new IDBFactory(),
    cerrojos,
    canal: canal(),
    enMemoria: false,
    ...extra,
  });
}

/** Sustituye `navigator.storage` mientras dura una prueba. */
function conStorage(storage: object) {
  const previo = Object.getOwnPropertyDescriptor(globalThis.navigator, 'storage');
  Object.defineProperty(globalThis.navigator, 'storage', { value: storage, configurable: true });
  return () => {
    if (previo) Object.defineProperty(globalThis.navigator, 'storage', previo);
    else Reflect.deleteProperty(globalThis.navigator, 'storage');
  };
}

let restaurar: (() => void) | null = null;
afterEach(() => {
  vi.useRealTimers();
  restaurar?.();
  restaurar = null;
});

describe('ProveedorEspacio', () => {
  it('abre el espacio, llena la carcasa y pinta a sus hijos', async () => {
    const almacen = new AlmacenMemoria();
    render(
      <ProveedorEspacio dependencias={dependencias(almacen)}>
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('dentro')).toBeTruthy();
    expect(useEspacio.getState()).toMatchObject({ nombre: 'Trabajo', sinClasificar: 0, soloLectura: false });
    expect(await leerTexto(almacen, RUTA_MANIFEST)).toContain('"formato": "rimor"');
  });

  it('no enseña nada antes de 400 ms; luego «arranque» una vez y, si sigue, «cargando» con el texto', async () => {
    vi.useFakeTimers();
    // Unas dependencias que no terminan nunca: la apertura se queda en «abriendo».
    render(
      <ProveedorEspacio dependencias={() => new Promise(() => undefined)}>
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    expect(screen.queryByRole('status')).toBeNull();
    act(() => vi.advanceTimersByTime(UMBRAL_ESPERA_MS));
    const arranque = screen.getByRole('status');
    expect(arranque.className).toContain('senal-arranque');
    expect(screen.getByText('Abriendo el espacio').className).toBe('solo-lector');
    act(() => vi.advanceTimersByTime(ESTADOS_SENAL.arranque.duracionS * 1000));
    expect(screen.getByRole('status').className).toContain('senal-cargando');
    expect(screen.getByRole('status').textContent).toBe('Abriendo el espacio');
    expect(screen.queryByText('dentro')).toBeNull();
  });

  it('un manifest que no se entiende enseña el error y no toca nada', async () => {
    const almacen = new AlmacenMemoria();
    await escribirTexto(almacen, RUTA_MANIFEST, '{ roto');
    render(
      <ProveedorEspacio dependencias={dependencias(almacen)}>
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('No se pudo abrir el espacio')).toBeTruthy();
    expect(screen.getByText(/manifest\.json no se entiende/)).toBeTruthy();
    expect(await leerTexto(almacen, RUTA_MANIFEST)).toBe('{ roto');
  });

  it('tras un fallo, «Reintentar» vuelve a abrir', async () => {
    const almacen = new AlmacenMemoria();
    await escribirTexto(almacen, RUTA_MANIFEST, '{ roto');
    render(
      <ProveedorEspacio dependencias={dependencias(almacen)}>
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    const boton = await screen.findByRole('button', { name: 'Reintentar' });
    await almacen.borrar(RUTA_MANIFEST);
    fireEvent.click(boton);
    expect(await screen.findByText('dentro')).toBeTruthy();
  });

  it('suelta las dependencias al desmontarse, también si aún estaba abriendo', async () => {
    const liberar = vi.fn();
    const lentas = dependencias(new AlmacenMemoria(), { liberar });
    const apertura: { soltar: () => void } = { soltar: () => undefined };
    const { unmount } = render(
      <ProveedorEspacio
        dependencias={() =>
          new Promise((r) => {
            apertura.soltar = () => r(lentas());
          })
        }
      >
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    unmount();
    expect(liberar).not.toHaveBeenCalled();
    apertura.soltar();
    await waitFor(() => expect(liberar).toHaveBeenCalledTimes(1));

    const otra = vi.fn();
    const segundo = render(
      <ProveedorEspacio dependencias={dependencias(new AlmacenMemoria(), { liberar: otra })}>
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    await screen.findByText('dentro');
    segundo.unmount();
    // Primero se escribe lo pendiente y se suelta el cerrojo; después se libera el Worker.
    await waitFor(() => expect(otra).toHaveBeenCalledTimes(1));
  });

  it('anota la persistencia que el navegador ya concedió', async () => {
    restaurar = conStorage({ persisted: async () => true });
    const almacen = new AlmacenMemoria();
    render(
      <ProveedorEspacio dependencias={dependencias(almacen)}>
        <TarjetaPersistencia />
        <p>dentro</p>
      </ProveedorEspacio>,
    );
    await screen.findByText('dentro');
    expect(leerEstado(await leerTexto(almacen, RUTA_ESTADO)).persistencia).toBe('concedida');
    expect(screen.queryByText('Protege tus datos')).toBeNull();
  });
});

describe('avisos del almacenamiento', () => {
  it('la tarjeta pide la persistencia con el botón, guarda el resultado y se va', async () => {
    const persist = vi.fn(async () => true);
    restaurar = conStorage({ persist, persisted: async () => false });
    const almacen = new AlmacenMemoria();
    render(
      <ProveedorEspacio dependencias={dependencias(almacen)}>
        <TarjetaPersistencia />
      </ProveedorEspacio>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Proteger los datos' }));
    await waitFor(() => expect(screen.queryByText('Protege tus datos')).toBeNull());
    expect(persist).toHaveBeenCalledTimes(1);
    expect(leerEstado(await leerTexto(almacen, RUTA_ESTADO))).toMatchObject({ persistencia: 'concedida' });
  });

  it('si el navegador la deniega, lo dice y recomienda copias', async () => {
    restaurar = conStorage({ persist: async () => false, persisted: async () => false });
    render(
      <ProveedorEspacio dependencias={dependencias()}>
        <TarjetaPersistencia />
      </ProveedorEspacio>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Proteger los datos' }));
    expect(await screen.findByText(/no lo ha concedido/)).toBeTruthy();
  });

  it('en memoria, avisa de que se perderá todo y no ofrece proteger nada', async () => {
    render(
      <ProveedorEspacio dependencias={dependencias(new AlmacenMemoria(), { enMemoria: true })}>
        <AvisoAlmacenamiento />
        <TarjetaPersistencia />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText(/se perderá al cerrar la pestaña/)).toBeTruthy();
    expect(screen.queryByText('Protege tus datos')).toBeNull();
  });

  it('con una cuota pequeña, avisa de ventana privada', async () => {
    restaurar = conStorage({
      getDirectory: async () => ({}),
      estimate: async () => ({ usage: 0, quota: 100 * 1024 * 1024 }),
    });
    render(
      <ProveedorEspacio dependencias={dependencias()}>
        <AvisoAlmacenamiento />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText(/ventana privada/)).toBeTruthy();
  });

  it('Datos y copias enseña el espacio usado, la persistencia y la última copia', async () => {
    restaurar = conStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 148 * 1024 * 1024, quota: 1e12 }),
    });
    render(
      <ProveedorEspacio dependencias={dependencias()}>
        <TarjetaCuidado />
      </ProveedorEspacio>,
    );
    expect(await screen.findByText('Protegido')).toBeTruthy();
    expect(screen.getByText('Protegido').className).toBe('v ok');
    expect(await screen.findByText(/^148\sMB$/)).toBeTruthy();
    expect(screen.getByText('0 elementos')).toBeTruthy();
    expect(screen.getByText('Nunca')).toBeTruthy();
    expect(screen.getByText('última copia · 0 cambios desde entonces')).toBeTruthy();
  });

  it('fuera del proveedor no pintan nada', () => {
    const { container } = render(
      <>
        <AvisoAlmacenamiento />
        <TarjetaPersistencia />
        <TarjetaCuidado />
      </>,
    );
    expect(container.innerHTML).toBe('');
  });
});
