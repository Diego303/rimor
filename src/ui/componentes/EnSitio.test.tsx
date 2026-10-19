import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { sugerir } from '../../rutas/elemento/Comunes';
import { completarUltima, EnSitio } from './EnSitio';

function Prueba({ alTerminar, sugerencias }: { alTerminar: (t: string | null) => void; sugerencias?: string[] }) {
  const [editando, setEditando] = useState(false);
  return (
    <>
      <EnSitio
        valor="Título"
        editando={editando}
        etiqueta="Editar"
        alEmpezar={() => setEditando(true)}
        alTerminar={(t) => {
          setEditando(false);
          alTerminar(t);
        }}
        {...(sugerencias ? { sugerencias: () => sugerencias } : {})}
      >
        Título
      </EnSitio>
      <button type="button">fuera</button>
    </>
  );
}

const editar = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Título' }));
  return screen.getByRole('textbox', { name: 'Editar' }) as HTMLInputElement;
};

describe('EnSitio', () => {
  afterEach(cleanup);

  it('Enter guarda y devuelve el foco al texto', () => {
    const hechos: (string | null)[] = [];
    render(<Prueba alTerminar={(t) => hechos.push(t)} />);
    const campo = editar();
    expect(campo.value).toBe('Título');
    expect(document.activeElement).toBe(campo);
    fireEvent.change(campo, { target: { value: 'Otro' } });
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(hechos).toEqual(['Otro']);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Título' }));
  });

  it('Esc cancela sin llegar a los atajos de la pantalla', () => {
    const hechos: (string | null)[] = [];
    let llego = false;
    const alTeclear = () => {
      llego = true;
    };
    window.addEventListener('keydown', alTeclear);
    render(<Prueba alTerminar={(t) => hechos.push(t)} />);
    const campo = editar();
    fireEvent.change(campo, { target: { value: 'Otro' } });
    fireEvent.keyDown(campo, { key: 'Escape' });
    window.removeEventListener('keydown', alTeclear);
    expect(hechos).toEqual([null]);
    expect(llego).toBe(false);
  });

  it('Esc durante una composición de IME es del IME: no cancela la edición', () => {
    const hechos: (string | null)[] = [];
    render(<Prueba alTerminar={(t) => hechos.push(t)} />);
    const campo = editar();
    fireEvent.keyDown(campo, { key: 'Escape', isComposing: true });
    expect(hechos).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Editar' })).toBeTruthy();
  });

  it('salir del campo guarda una sola vez', () => {
    const hechos: (string | null)[] = [];
    render(<Prueba alTerminar={(t) => hechos.push(t)} />);
    const campo = editar();
    fireEvent.change(campo, { target: { value: 'Por fuera' } });
    act(() => {
      fireEvent.blur(campo, { relatedTarget: screen.getByRole('button', { name: 'fuera' }) });
    });
    expect(hechos).toEqual(['Por fuera']);
  });

  it('una sugerencia completa la última palabra sin terminar la edición', () => {
    const hechos: (string | null)[] = [];
    render(<Prueba alTerminar={(t) => hechos.push(t)} sugerencias={['gateway']} />);
    const campo = editar();
    fireEvent.change(campo, { target: { value: 'prompts gat' } });
    const sugerencia = screen.getByRole('button', { name: 'gateway' });
    // Pasar el foco del campo a la sugerencia no es salir.
    fireEvent.blur(campo, { relatedTarget: sugerencia });
    fireEvent.click(sugerencia);
    expect(hechos).toEqual([]);
    expect(campo.value).toBe('prompts gateway ');
  });

  it('solo lectura: el texto, sin botón', () => {
    render(
      <EnSitio valor="x" editando={false} soloLectura etiqueta="Editar" alEmpezar={() => {}} alTerminar={() => {}}>
        Texto
      </EnSitio>,
    );
    expect(screen.getByText('Texto')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('completar y sugerir', () => {
  it('completa la palabra en curso o añade una nueva', () => {
    expect(completarUltima('prompts gat', 'gateway')).toBe('prompts gateway ');
    expect(completarUltima('prompts ', 'gateway')).toBe('prompts gateway ');
    expect(completarUltima('', 'gateway')).toBe('gateway ');
    // Separadas por comas, como al guardar: no se pierde lo de antes de la coma.
    expect(completarUltima('gateway,ges', 'gestion')).toBe('gateway,gestion ');
    expect(completarUltima('gateway,', 'prompts')).toBe('gateway,prompts ');
  });

  it('sugiere las existentes que empiezan por lo escrito y no están ya', () => {
    const existentes = ['gateway', 'gestion', 'prompts'];
    const limpiar = (s: string) => s.replace(/^@/, '').toLowerCase();
    expect(sugerir('g', existentes, limpiar)).toEqual(['gateway', 'gestion']);
    expect(sugerir('@GA', existentes, limpiar)).toEqual(['gateway']);
    expect(sugerir('gateway ', existentes, limpiar)).toEqual(['gestion', 'prompts']);
    expect(sugerir('gateway', existentes, limpiar)).toEqual([]);
    expect(sugerir('', existentes, limpiar, 2)).toEqual(['gateway', 'gestion']);
  });
});
