import 'fake-indexeddb/auto';
import { type Elemento, isoConZona } from '@rimor/formato';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import type { Cerrojos } from '../../almacen/pestanas';
import { type DependenciasProveedor, ProveedorEspacio, useEspacioAbierto } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { ProveedorAvisos } from '../../ui/componentes';
import { elementoFalso } from '../pruebas/falsos';
import { IdeasQueVuelven } from './IdeasQueVuelven';
import VistaIdea from './Vista';

const DIA = 86_400_000;
const cerrojos: Cerrojos = { request: (_n, _o, fn) => fn({}) };
const dependencias = async (): Promise<DependenciasProveedor> => ({
  espacioId: 'ideas',
  almacen: new AlmacenMemoria(),
  fabricaIndexedDb: new IDBFactory(),
  cerrojos,
  canal: { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined },
  enMemoria: false,
});

const dia0 = new Date(2026, 9, 1, 10);
function idea(): Elemento {
  const base = elementoFalso(1, 'Exportar minipapers con Typst', 'idea');
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      tipo: 'idea',
      ref: 'IDE-0001',
      titulo: 'Exportar minipapers con Typst',
      estado: 'semilla',
      creado: isoConZona(dia0),
      lector: { nombre: 'idea', version: 1, resumen: {} },
    },
  };
}

let repositorio: ReturnType<typeof useEspacioAbierto>['repositorio'] | null = null;
function Espia() {
  repositorio = useEspacioAbierto().repositorio;
  return null;
}

async function montar(dia: number) {
  repositorio = null;
  const reloj = () => new Date(dia0.getTime() + dia * DIA);
  render(
    <ProveedorEspacio dependencias={dependencias}>
      <ProveedorAvisos>
        <Espia />
        <IdeasQueVuelven reloj={reloj} />
      </ProveedorAvisos>
    </ProveedorEspacio>,
  );
  await waitFor(() => expect(repositorio).toBeTruthy());
  await act(async () => {
    await repositorio?.guardarElemento(idea());
  });
}

describe('ideas que vuelven', () => {
  it('el día 7 vuelve con su mensaje; «Más adelante» la aparta 30 días', async () => {
    await montar(7);
    const mensaje = await screen.findByText(/Hace 7 días guardaste una idea/);
    expect(mensaje.closest('.rimor')?.textContent).toBe(
      'Hace 7 días guardaste una idea: Exportar minipapers con Typst. ¿Sigue en pie?',
    );
    expect(screen.queryByText('Convertir en investigación')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Más adelante' }));
    await waitFor(() => expect(document.querySelector('article.msg')).toBeNull());
    expect(repositorio?.frontmatter('IDE-0001')?.vuelve).toBe(
      isoConZona(new Date(dia0.getFullYear(), dia0.getMonth(), dia0.getDate() + 37)),
    );
  });

  it('«Descartar» la deja descartada', async () => {
    await montar(8);
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(repositorio?.frontmatter('IDE-0001')?.estado).toBe('descartada'));
    expect(document.querySelector('article.msg')).toBeNull();
  });

  it('en una pestaña que solo lee, el mensaje sale sin botones', async () => {
    await montar(9);
    expect(await screen.findByText(/Hace 9 días guardaste una idea/)).toBeTruthy();
    // El espacio pinta el modo de la pestaña al abrir; aquí pasa a solo lectura (otra pestaña cogió el cerrojo).
    act(() => useEspacio.setState({ soloLectura: true }));
    expect(screen.queryByRole('button', { name: 'Más adelante' })).toBeNull();
    useEspacio.setState({ soloLectura: false });
  });

  it('antes del día 7, nada', async () => {
    await montar(6);
    await act(async () => undefined);
    expect(document.querySelector('article.msg')).toBeNull();
  });

  it('en la vista, cambiar el estado lo guarda', async () => {
    repositorio = null;
    const el = idea();
    render(
      <ProveedorEspacio dependencias={dependencias}>
        <Espia />
        <VistaIdea el={el} datos={{ palabras: 4, lineas: 1 }} />
      </ProveedorEspacio>,
    );
    await waitFor(() => expect(repositorio).toBeTruthy());
    await act(async () => {
      await repositorio?.guardarElemento(el);
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Explorando' }));
    await waitFor(() => expect(repositorio?.frontmatter('IDE-0001')?.estado).toBe('explorando'));
  });
});
