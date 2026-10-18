import 'fake-indexeddb/auto';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import type { Cerrojos } from '../../almacen/pestanas';
import { ProveedorCaptura } from '../../captura/Captura';
import { CLAVE_BORRADOR, useCompositor } from '../../captura/compositor';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../../espacio/Espacio';
import { ejecutorEnHilo } from '../../lectores/ejecutor';
import { ProveedorLectores } from '../../lectores/Lectores';
import { elementoFalso, lectorFalso } from '../../lectores/pruebas/falsos';
import { crearRegistro } from '../../lectores/registro';
import { ProveedorAvisos } from './Avisos';
import { ALTO_MAXIMO, Compositor } from './Compositor';

const CLAVE_AWS = `AKIA${'IOSFODNN7'}EXAMPLE`;
const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
const registro = crearRegistro([
  lectorFalso({
    nombre: 'archivo',
    tipo: 'archivo',
    detectar: () => 0,
    leer: async () => ({ titulo: '', original: null }),
  }),
  lectorFalso({ nombre: 'error', tipo: 'error', detectar: (e) => (e.texto?.includes('panic') ? 0.7 : 0) }),
  lectorFalso({ nombre: 'log', tipo: 'log', detectar: (e) => (e.texto?.includes('ERROR') ? 0.8 : 0) }),
  lectorFalso({ nombre: 'texto', tipo: 'texto', detectar: () => 0.1 }),
]);

let repositorio: ReturnType<typeof useEspacioAbierto>['repositorio'] | null = null;
function Espia() {
  repositorio = useEspacioAbierto().repositorio;
  return null;
}

async function montar() {
  const almacen = new AlmacenMemoria();
  const dependencias = async (): Promise<DependenciasProveedor> => ({
    espacioId: 'compositor',
    almacen,
    fabricaIndexedDb: new IDBFactory(),
    cerrojos,
    canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
    enMemoria: false,
  });
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorLectores registro={registro} ejecutar={ejecutorEnHilo(registro)}>
        <ProveedorAvisos>
          <ProveedorCaptura>
            <Espia />
            <Compositor />
          </ProveedorCaptura>
        </ProveedorAvisos>
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
  const area = (await screen.findByLabelText('Capturar')) as HTMLTextAreaElement;
  await act(async () => undefined);
  return area;
}

function escribir(area: HTMLTextAreaElement, texto: string) {
  fireEvent.change(area, { target: { value: texto, selectionStart: texto.length } });
}

const vistaPrevia = () => document.querySelector('.cprev')?.textContent ?? '';

beforeEach(() => {
  useCompositor.setState({ texto: '', archivos: [], respondiendoA: null, busquedas: [], llegadas: 0, atendidas: 0 });
});

describe('Compositor', () => {
  it('crece con el texto hasta 220 px', async () => {
    const area = await montar();
    let alto = 60;
    Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => alto });
    escribir(area, 'una línea');
    expect(area.style.height).toBe('60px');
    alto = 900;
    escribir(area, 'muchas\nlíneas\n…');
    expect(area.style.height).toBe(`${ALTO_MAXIMO}px`);
  });

  it('Enter guarda con las indicaciones y vacía; Mayús+Enter y Enter durante un IME no', async () => {
    const area = await montar();
    escribir(area, 'nota rápida\n@gateway #rust');
    fireEvent.keyDown(area, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(area, { key: 'Enter', isComposing: true });
    expect(repositorio?.elementos()).toHaveLength(0);
    fireEvent.keyDown(area, { key: 'Enter' });
    await waitFor(() => expect(repositorio?.elementos()).toHaveLength(1));
    expect(repositorio?.elementos()[0]).toMatchObject({ tipo: 'texto', colecciones: ['gateway'], etiquetas: ['rust'] });
    expect(useCompositor.getState().texto).toBe('');
    expect(await screen.findByRole('button', { name: 'Deshacer' })).toBeTruthy();
  });

  it('la vista previa dice tipo, confianza, indicaciones, secretos y la duda', async () => {
    const area = await montar();
    escribir(area, `17:40 ERROR panic AWS=${CLAVE_AWS} @gateway #rust`);
    await waitFor(() => expect(vistaPrevia()).toContain('Se guardará como'));
    expect(vistaPrevia()).toContain('Log');
    expect(vistaPrevia()).toContain('0,80');
    expect(vistaPrevia()).toContain('@gateway');
    expect(vistaPrevia()).toContain('#rust');
    expect(vistaPrevia()).toContain('1 secreto se ocultará');
    expect(vistaPrevia()).toContain('¿o Error? Escribe /error al principio');
    escribir(area, '/mediciones 38 ms');
    await waitFor(() => expect(vistaPrevia()).toContain('elegido con /'));
    expect(vistaPrevia()).toContain('Mediciones');
  });

  it('autocompleta colecciones con el teclado', async () => {
    const area = await montar();
    await act(async () => {
      await repositorio?.guardarElemento(elementoFalso(1, 'uno', 'texto'));
      const el = elementoFalso(2, 'dos', 'texto');
      await repositorio?.guardarElemento({
        ...el,
        frontmatter: { ...el.frontmatter, colecciones: ['gateway', 'gastos'] },
      });
    });
    escribir(area, 'nota @ga');
    const lista = await waitFor(() => {
      const l = document.querySelector('.sugerencias');
      if (!l) throw new Error('sin lista');
      return l;
    });
    expect(lista.textContent).toContain('@gastos');
    expect(lista.textContent).toContain('@gateway');
    fireEvent.keyDown(area, { key: 'ArrowDown' });
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(useCompositor.getState().texto).toBe('nota @gateway ');
    expect(document.querySelector('.sugerencias')).toBeNull();
    expect(repositorio?.elementos()).toHaveLength(2);
  });

  it('adjunta con el selector y al soltar sobre el compositor (sin guardar hasta Enter)', async () => {
    const area = await montar();
    const selector = document.querySelector('input[type=file]') as HTMLInputElement;
    const a = new File(['a'], 'a.txt', { type: 'text/plain' });
    fireEvent.change(selector, { target: { files: [a] } });
    const composer = document.querySelector('.composer') as HTMLElement;
    const b = new File([new Uint8Array([0, 1])], 'b.bin');
    fireEvent.drop(composer, { dataTransfer: { files: [b], types: ['Files'] } });
    expect(useCompositor.getState().archivos.map((f) => f.name)).toEqual(['a.txt', 'b.bin']);
    expect(vistaPrevia()).toContain('a.txt');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar a.txt' }));
    expect(useCompositor.getState().archivos.map((f) => f.name)).toEqual(['b.bin']);
    fireEvent.keyDown(area, { key: 'Enter' });
    await waitFor(() => expect(repositorio?.elementos()).toHaveLength(1));
    expect(repositorio?.elementos()[0]?.tipo).toBe('archivo');
  });

  it('modo respuesta: «Respondiendo a REF» y × para cancelar', async () => {
    await montar();
    act(() => useCompositor.getState().responderA('LOG-0042'));
    expect(document.querySelector('.replying')?.textContent).toContain('Respondiendo a LOG-0042: irá a su hilo');
    expect((screen.getByLabelText('Capturar') as HTMLTextAreaElement).placeholder).toContain('Responder en este hilo');
    fireEvent.click(screen.getByRole('button', { name: 'No responder' }));
    expect(document.querySelector('.replying')).toBeNull();
  });

  it('?texto + Enter deja la búsqueda para el feed y no guarda nada', async () => {
    const area = await montar();
    escribir(area, '?timeout gateway');
    await waitFor(() => expect(vistaPrevia()).toContain('Buscar «timeout gateway»'));
    fireEvent.keyDown(area, { key: 'Enter' });
    expect(useCompositor.getState().busquedas.map((b) => b.texto)).toEqual(['timeout gateway']);
    expect(useCompositor.getState().texto).toBe('');
    expect(repositorio?.elementos()).toHaveLength(0);
  });

  it('el borrador se guarda en sessionStorage y lo que llega de fuera enfoca la caja', async () => {
    const area = await montar();
    escribir(area, 'a medias');
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBe('a medias');
    area.blur();
    act(() => useCompositor.getState().enfocar());
    expect(document.activeElement).toBe(area);
    escribir(area, '');
    expect(sessionStorage.getItem(CLAVE_BORRADOR)).toBeNull();
  });
});
