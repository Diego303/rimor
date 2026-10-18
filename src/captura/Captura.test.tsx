import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../espacio/Espacio';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { ProveedorLectores } from '../lectores/Lectores';
import { lectorFalso } from '../lectores/pruebas/falsos';
import { crearRegistro } from '../lectores/registro';
import { ProveedorAvisos } from '../ui/componentes';
import { ProveedorCaptura } from './Captura';
import { useCompositor } from './compositor';
import { LIMITE_ARCHIVO } from './flujo';

const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
const registro = crearRegistro([
  lectorFalso({
    nombre: 'archivo',
    tipo: 'archivo',
    detectar: () => 0,
    leer: async () => ({ titulo: '', original: null }),
  }),
  lectorFalso({ nombre: 'texto', tipo: 'texto', detectar: () => 0.1 }),
]);
const ejecutar = ejecutorEnHilo(registro);

const dependencias = async (): Promise<DependenciasProveedor> => ({
  espacioId: 'captura',
  almacen: new AlmacenMemoria(),
  fabricaIndexedDb: new IDBFactory(),
  cerrojos,
  canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
  enMemoria: false,
});

let repositorio: ReturnType<typeof useEspacioAbierto>['repositorio'] | null = null;
function Espia() {
  repositorio = useEspacioAbierto().repositorio;
  return <textarea aria-label="campo" />;
}

function montar(alRecibir = vi.fn()) {
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={registro} ejecutar={ejecutar}>
        <ProveedorAvisos>
          <ProveedorCaptura alRecibir={alRecibir}>
            <Espia />
          </ProveedorCaptura>
        </ProveedorAvisos>
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
  return alRecibir;
}

function pegar(texto: string, objetivo: EventTarget = document) {
  const e = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => texto, files: [] } });
  act(() => void objetivo.dispatchEvent(e));
  return e;
}

function arrastrar(tipo: 'dragenter' | 'drop', archivos: File[]) {
  const e = new Event(tipo, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: { types: ['Files'], files: archivos, dropEffect: 'none' } });
  act(() => void window.dispatchEvent(e));
}

describe('captura en la interfaz', () => {
  it('pegar fuera de un campo lleva el texto al compositor sin guardar, y va a Inicio', async () => {
    useCompositor.getState().vaciar();
    const alRecibir = montar();
    await screen.findByLabelText('campo');
    const e = pegar('17:40 ERROR algo');
    expect(e.defaultPrevented).toBe(true);
    expect(useCompositor.getState().texto).toBe('17:40 ERROR algo');
    expect(alRecibir).toHaveBeenCalledTimes(1);
    expect(repositorio?.elementos()).toHaveLength(0);
    // Lo siguiente que se pega va detrás, en otra línea.
    pegar('otra línea');
    expect(useCompositor.getState().texto).toBe('17:40 ERROR algo\notra línea');
  });

  it('pegar dentro de un campo de texto no se toca', async () => {
    useCompositor.getState().vaciar();
    montar();
    const campo = await screen.findByLabelText('campo');
    campo.focus();
    const e = pegar('dentro', campo);
    expect(e.defaultPrevented).toBe(false);
    expect(useCompositor.getState().texto).toBe('');
  });

  it('soltar archivos los guarda uno a uno y «Deshacer» los borra', async () => {
    montar();
    await screen.findByLabelText('campo');
    arrastrar('dragenter', []);
    expect(document.querySelector('.capa-soltar')?.textContent).toBe('Suelta para guardar');
    arrastrar('drop', [
      new File(['primero'], 'a.txt', { type: 'text/plain' }),
      new File([new Uint8Array([0, 1])], 'b.bin'),
    ]);
    expect(document.querySelector('.capa-soltar')).toBeNull();
    const deshacer = await screen.findByRole('button', { name: 'Deshacer' });
    expect(document.querySelector('.toast')?.textContent).toContain('Guardados 2');
    expect(
      repositorio
        ?.elementos()
        .map((f) => f.tipo)
        .sort(),
    ).toEqual(['archivo', 'texto']);
    fireEvent.click(deshacer);
    await waitFor(() => expect(repositorio?.elementos()).toHaveLength(0));
  });

  it('un archivo de más de 50 MB se rechaza con un aviso que lo explica', async () => {
    montar();
    await screen.findByLabelText('campo');
    const enorme = {
      name: 'video.mov',
      type: 'video/quicktime',
      size: LIMITE_ARCHIVO + 1,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    arrastrar('drop', [enorme as unknown as File]);
    await waitFor(() =>
      expect(document.querySelector('.toast')?.textContent).toMatch(/«video\.mov» pesa 50\sMB: el límite es 50\sMB/),
    );
    expect(repositorio?.elementos()).toHaveLength(0);
  });
});
