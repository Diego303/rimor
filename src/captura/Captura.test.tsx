import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../espacio/Espacio';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { ProveedorLectores } from '../lectores/Lectores';
import { elementoFalso, lectorFalso } from '../lectores/pruebas/falsos';
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
let contadores: ReturnType<typeof useEspacioAbierto>['contadores'] | null = null;
function Espia() {
  repositorio = useEspacioAbierto().repositorio;
  contadores = useEspacioAbierto().contadores;
  return <textarea aria-label="campo" />;
}

function montar(alRecibir = vi.fn(), alAbrir = vi.fn(), conRegistro = registro) {
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores
        registro={conRegistro}
        ejecutar={conRegistro === registro ? ejecutar : ejecutorEnHilo(conRegistro)}
      >
        <ProveedorAvisos>
          <ProveedorCaptura alRecibir={alRecibir} alAbrir={alAbrir}>
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
    // Que terminen los efectos pendientes (los oyentes de pegar y soltar).
    await act(async () => undefined);
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
    // Que terminen los efectos pendientes (los oyentes de pegar y soltar).
    await act(async () => undefined);
    campo.focus();
    const e = pegar('dentro', campo);
    expect(e.defaultPrevented).toBe(false);
    expect(useCompositor.getState().texto).toBe('');
  });

  it('soltar archivos los guarda uno a uno y «Deshacer» los borra', async () => {
    montar();
    await screen.findByLabelText('campo');
    // Que terminen los efectos pendientes (los oyentes de pegar y soltar).
    await act(async () => undefined);
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

  it('soltar un duplicado avisa con su ref y «Ver» lleva al existente', async () => {
    const alAbrir = vi.fn();
    montar(vi.fn(), alAbrir);
    await screen.findByLabelText('campo');
    await act(async () => undefined);
    const existente = elementoFalso(7, 'igual');
    await repositorio?.guardarElemento(existente);
    arrastrar('drop', [new File(['igual'], 'b.txt', { type: 'text/plain' })]);
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    expect(document.querySelector('.toast')).toBeNull();
    expect(alAbrir).toHaveBeenCalledWith(existente.frontmatter.ref);
    expect(repositorio?.elementos()).toHaveLength(1);
    // Cuenta como duplicado evitado (MET-06).
    expect(contadores?.total('duplicadosEvitados')).toBe(1);
  });

  it('dos errores iguales soltados a la vez cuentan un solo «error reconocido»', async () => {
    const { lectorError } = await import('../lectores/error/lector');
    const conError = crearRegistro([...registro.lectores.slice(0, 1), lectorError, ...registro.lectores.slice(1)]);
    montar(vi.fn(), vi.fn(), conError);
    await screen.findByLabelText('campo');
    await act(async () => undefined);
    // La misma traza con otro número de línea: no es un duplicado, pero sí el mismo error.
    const traza = (linea: number) =>
      `TypeError: x is not a function\n    at cargar (/app/src/carga.js:${linea}:3)\n    at main (/app/src/index.js:4:3)`;
    arrastrar('drop', [
      new File([traza(10)], 'a.txt', { type: 'text/plain' }),
      new File([traza(11)], 'b.txt', { type: 'text/plain' }),
    ]);
    await waitFor(() => expect(repositorio?.elementos().filter((f) => f.tipo === 'error')).toHaveLength(2));
    await waitFor(() => expect(contadores?.total('erroresReconocidos')).toBe(1));
    // Y no pasa a 2 cuando el otro termina de derivar.
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    expect(contadores?.total('erroresReconocidos')).toBe(1);
  });

  it('un archivo de más de 50 MB se rechaza con un aviso que lo explica', async () => {
    montar();
    await screen.findByLabelText('campo');
    // Que terminen los efectos pendientes (los oyentes de pegar y soltar).
    await act(async () => undefined);
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
