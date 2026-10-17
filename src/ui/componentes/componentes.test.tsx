import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardarPreferencia } from '../tema/tema';
import { DURACION_AVISO_MS, ProveedorAvisos, useAvisos } from './Avisos';
import { Detalles } from './Bloques';
import { Boton } from './Boton';
import { Medidor, Tabla, Veredicto } from './Datos';
import { Segmentado } from './Segmentado';
import { SelectorTema } from './SelectorTema';

describe('Boton', () => {
  it('aplica la clase de cada variante y es type="button" por defecto', () => {
    const { rerender } = render(<Boton variante="primario">Guardar</Boton>);
    const b = screen.getByRole('button', { name: 'Guardar' });
    expect(b.className).toBe('btn pri');
    expect(b.getAttribute('type')).toBe('button');
    rerender(
      <Boton variante="senal" pequeno>
        Guardar
      </Boton>,
    );
    expect(b.className).toBe('btn key sm');
    rerender(<Boton variante="icono">Guardar</Boton>);
    expect(b.className).toBe('ibtn');
  });
});

describe('Segmentado', () => {
  it('marca la opción activa y avisa al cambiar', () => {
    const alCambiar = vi.fn();
    render(
      <Segmentado
        etiqueta="Filtro"
        valor="a"
        alCambiar={alCambiar}
        opciones={[
          { valor: 'a', etiqueta: 'Todo' },
          { valor: 'b', etiqueta: 'Sin clasificar' },
        ]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Filtro' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todo' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Sin clasificar' }));
    expect(alCambiar).toHaveBeenCalledWith('b');
  });
});

describe('Detalles', () => {
  it('muestra el recuento en el resumen', () => {
    render(
      <Detalles resumen="Avisos de método" recuento={4}>
        x
      </Detalles>,
    );
    expect(screen.getByText('Avisos de método (4)')).toBeTruthy();
  });
});

describe('Veredicto y Medidor', () => {
  it('aplica el tono y acota el medidor', () => {
    const { container } = render(
      <>
        <Veredicto tono="ok" cifra="−4,5 %" frase="ureq es más rápido" />
        <Medidor fraccion={1.7} etiqueta="Tareas" />
      </>,
    );
    expect(container.querySelector('.verdict.ok .big')?.textContent).toBe('−4,5 %');
    expect(screen.getByRole('meter', { name: 'Tareas' }).getAttribute('aria-valuenow')).toBe('100');
  });
});

describe('Tabla', () => {
  it('pinta columnas numéricas alineadas y responde a la fila pulsada con teclado', () => {
    const alPulsar = vi.fn();
    render(
      <Tabla
        columnas={[
          { id: 's', titulo: 'Serie', celda: (f: { s: string; m: string }) => f.s },
          { id: 'm', titulo: 'Mediana', celda: (f) => f.m, numerica: true },
        ]}
        filas={[{ s: 'ureq', m: '36,80' }]}
        clave={(f) => f.s}
        alPulsarFila={alPulsar}
      />,
    );
    expect(screen.getByText('36,80').className).toBe('n');
    fireEvent.keyDown(screen.getByText('ureq').closest('tr') as HTMLElement, { key: 'Enter' });
    expect(alPulsar).toHaveBeenCalledWith({ s: 'ureq', m: '36,80' });
  });
});

describe('Avisos', () => {
  afterEach(() => vi.useRealTimers());

  it('muestra los avisos de uno en uno y los quita a los 2,6 s', () => {
    vi.useFakeTimers();
    function Disparador() {
      const { avisar } = useAvisos();
      return (
        <button
          type="button"
          onClick={() => {
            avisar('Exportado');
            avisar('Copiado');
          }}
        >
          avisar
        </button>
      );
    }
    render(
      <ProveedorAvisos>
        <Disparador />
      </ProveedorAvisos>,
    );
    fireEvent.click(screen.getByText('avisar'));
    const aviso = screen.getByRole('status');
    expect(aviso.textContent).toBe('Exportado');
    act(() => vi.advanceTimersByTime(DURACION_AVISO_MS));
    expect(aviso.textContent).toBe('Copiado');
    act(() => vi.advanceTimersByTime(DURACION_AVISO_MS));
    expect(aviso.hidden).toBe(true);
  });
});

describe('SelectorTema', () => {
  afterEach(() => guardarPreferencia('sistema'));

  it('aplica data-theme al elegir y lo quita al volver al sistema', () => {
    render(<SelectorTema etiqueta="Tema" textos={{ sistema: 'Sistema', claro: 'Claro', oscuro: 'Oscuro' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Oscuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('rimor:tema')).toBe('oscuro');
    fireEvent.click(screen.getByRole('button', { name: 'Sistema' }));
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
