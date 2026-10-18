import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Elemento, hashOriginal } from '@rimor/formato';
import { render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { type ReactNode, useEffect, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Cerrojos } from '../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../espacio/Espacio';
import { lectorPlantilla } from './_plantilla/lector';
import type { Ejecutor } from './derivados';
import { ejecutorEnHilo } from './ejecutor';
import { ProveedorLectores, TarjetaElemento, VistaElemento } from './Lectores';
import { elementoFalso, lectorFalso } from './pruebas/falsos';
import { crearRegistro, type Registro } from './registro';

const ejemplo = readFileSync(join(process.cwd(), 'src/lectores/_plantilla/fixtures/ejemplo.txt'), 'utf8');
const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };

function dependencias(almacen = new AlmacenMemoria()) {
  return async (): Promise<DependenciasProveedor> => ({
    espacioId: 'lectores',
    almacen,
    fabricaIndexedDb: new IDBFactory(),
    cerrojos,
    canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
    enMemoria: false,
  });
}

/** Ejecutor que espera a que la prueba lo suelte. */
function ejecutorRetenido(registro: Registro) {
  const enHilo = ejecutorEnHilo(registro);
  let soltar: () => void = () => undefined;
  const suelto = new Promise<void>((r) => {
    soltar = r;
  });
  const ejecutar: Ejecutor = async (nombre, el) => {
    await suelto;
    return enHilo(nombre, el);
  };
  return { ejecutar, soltar: () => soltar() };
}

/** Guarda el elemento en el espacio abierto y, después, pinta a sus hijos con él. */
function ConElemento({ el, children }: { el: Elemento; children: (el: Elemento) => ReactNode }) {
  const { repositorio } = useEspacioAbierto();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    void repositorio.guardarElemento(el).then(() => setListo(true));
  }, [repositorio, el]);
  return listo ? children(el) : null;
}

function montar(registro: Registro, ejecutar: Ejecutor, el: Elemento, almacen = new AlmacenMemoria()) {
  return render(
    <ProveedorEspacio dependencias={dependencias(almacen)}>
      <ProveedorLectores registro={registro} ejecutar={ejecutar}>
        <ConElemento el={el}>
          {(e) => (
            <>
              <TarjetaElemento el={e} />
              <VistaElemento el={e} />
            </>
          )}
        </ConElemento>
      </ProveedorLectores>
    </ProveedorEspacio>,
  );
}

/** El elemento que guardaría la captura (IN-014) con el borrador de la plantilla. */
async function elementoDePlantilla(): Promise<Elemento> {
  const b = await lectorPlantilla.leer({ texto: ejemplo });
  return {
    frontmatter: {
      id: '01JAB4C2Q2X8M5N7P0R0000099',
      ref: 'TXT-0099',
      tipo: lectorPlantilla.tipo,
      titulo: b.titulo,
      creado: '2026-10-18T10:00:00+02:00',
      modificado: '2026-10-18T10:00:00+02:00',
      origen: 'pegado',
      hash: hashOriginal(b.original ?? ''),
      ocultados: 0,
      lector: { nombre: lectorPlantilla.nombre, version: lectorPlantilla.version, resumen: b.resumen ?? {} },
    },
    notas: '',
    original: b.original,
  };
}

describe('lector de punta a punta', () => {
  it('la plantilla registrada: resumen y «analizando» mientras deriva, después su vista y su tarjeta', async () => {
    const registro = crearRegistro([lectorPlantilla]);
    const retenido = ejecutorRetenido(registro);
    const almacen = new AlmacenMemoria();
    const el = await elementoDePlantilla();
    montar(registro, retenido.ejecutar, el, almacen);

    // Mientras deriva: el resumen del frontmatter y, pasados 400 ms, la señal con lo que calcula.
    expect((await screen.findAllByText('3 líneas')).length).toBeGreaterThan(0);
    const analizando = await screen.findByRole('status', {}, { timeout: 2000 });
    expect(analizando.className).toContain('senal-analizando');
    expect(analizando.textContent).toBe('Contando líneas y palabras');

    // La tarjeta del lector (diferida) con las primeras líneas, el título y la ref.
    expect(screen.getByText('Primera línea del ejemplo')).toBeTruthy();
    expect(screen.getByText('TXT-0099')).toBeTruthy();
    await waitFor(() =>
      expect(document.querySelector('.tarjeta-elemento pre')?.textContent).toBe(
        'Primera línea del ejemplo\nsegunda línea con más palabras\ntercera',
      ),
    );

    retenido.soltar();
    // Su vista, cargada en diferido, con lo derivado.
    // La señal se queda al menos 600 ms y la vista se carga en diferido: se le da margen.
    expect(await screen.findByText('palabras', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('un derivado nuevo pone al día el resumen del frontmatter', async () => {
    const registro = crearRegistro([lectorPlantilla]);
    const almacen = new AlmacenMemoria();
    const el = await elementoDePlantilla();
    let repositorio: ReturnType<typeof useEspacioAbierto>['repositorio'] | null = null;
    function Espia() {
      repositorio = useEspacioAbierto().repositorio;
      return null;
    }
    render(
      <ProveedorEspacio dependencias={dependencias(almacen)}>
        <Espia />
        <ProveedorLectores registro={registro} ejecutar={ejecutorEnHilo(registro)}>
          <ConElemento el={el}>{(e) => <VistaElemento el={e} />}</ConElemento>
        </ProveedorLectores>
      </ProveedorEspacio>,
    );
    await screen.findByText('palabras', {}, { timeout: 4000 });
    await waitFor(() =>
      expect(repositorio?.frontmatter('TXT-0099')?.lector.resumen).toEqual({ lineas: 3, palabras: 10 }),
    );
  });

  it('un lector sin vista enseña el original; si falla, el error y el original', async () => {
    const sinVista = crearRegistro([lectorFalso()]);
    const { unmount } = montar(sinVista, ejecutorEnHilo(sinVista), elementoFalso(1, 'texto plano'));
    expect(await screen.findByText('texto plano')).toBeTruthy();
    expect(screen.getByText('largo 11')).toBeTruthy();
    unmount();

    const roto = crearRegistro([
      lectorFalso({
        async derivar() {
          throw new Error('roto');
        },
      }),
    ]);
    montar(roto, ejecutorEnHilo(roto), elementoFalso(2, 'otro texto'));
    expect(await screen.findByText('No se pudo analizar')).toBeTruthy();
    expect(screen.getByText('otro texto')).toBeTruthy();
  });

  it('un resumen que el lector no entiende no rompe la vista ni la tarjeta', async () => {
    const raro = crearRegistro([
      lectorFalso({
        resumenLegible: () => {
          throw new Error('resumen de otra forma');
        },
      }),
    ]);
    const retenido = ejecutorRetenido(raro);
    montar(raro, retenido.ejecutar, elementoFalso(4, 'texto raro'));
    expect(await screen.findByText('Elemento 4')).toBeTruthy();
    retenido.soltar();
    expect(await screen.findByText('texto raro')).toBeTruthy();
  });

  it('sin lector para el elemento, el original tal cual', async () => {
    const vacio = crearRegistro([]);
    montar(vacio, ejecutorEnHilo(vacio), elementoFalso(3, 'sin lector'));
    expect(await screen.findByText('sin lector')).toBeTruthy();
  });
});
