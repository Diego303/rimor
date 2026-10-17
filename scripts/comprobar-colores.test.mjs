import { describe, expect, it } from 'vitest';
import { buscarColores } from './comprobar-colores.mjs';

describe('buscarColores', () => {
  it('rechaza un hexadecimal en un componente', () => {
    const r = buscarColores("export const Boton = () => <b style={{ color: '#EE4F1F' }} />;");
    expect(r).toEqual([{ linea: 1, regla: 'hexadecimal', valor: '#EE4F1F' }]);
  });

  it('rechaza rgb(), hsl() y clases de paleta de Tailwind', () => {
    expect(buscarColores('a { color: rgba(0, 0, 0, .1) }')).toHaveLength(1);
    expect(buscarColores('b { color: hsl(10 20% 30%) }')).toHaveLength(1);
    expect(buscarColores('<div className="bg-orange-500 text-red-600" />')).toHaveLength(2);
  });

  it('acepta tokens, anclas, entidades y la exención explícita', () => {
    expect(buscarColores('a { color: var(--key) }')).toEqual([]);
    expect(buscarColores("navegar('#/e/LOG-0042'); const x = '&#123;'; const id = '#fig-1';")).toEqual([]);
    expect(buscarColores('<meta name="theme-color" content="#E8E6E1" /> <!-- rimor-permitir-color -->')).toEqual([]);
  });
});
