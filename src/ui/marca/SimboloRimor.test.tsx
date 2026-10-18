import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logotipo } from './Logotipo';
import { SimboloRimor } from './SimboloRimor';

describe('SimboloRimor', () => {
  it('es decorativo sin título y una imagen con nombre con él', () => {
    const { container, rerender } = render(<SimboloRimor />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    rerender(<SimboloRimor titulo="Rimor" />);
    expect(screen.getByRole('img', { name: 'Rimor' })).toBeTruthy();
  });

  it('usa trazo de 3,6 por debajo de 20 px y de 3 a partir de ahí', () => {
    const { container, rerender } = render(<SimboloRimor tamano={16} />);
    expect(container.querySelector('.onda')?.getAttribute('stroke-width')).toBe('3.6');
    rerender(<SimboloRimor tamano={20} />);
    expect(container.querySelector('.onda')?.getAttribute('stroke-width')).toBe('3');
  });

  it('la variante mono marca la clase que pinta el punto en tinta', () => {
    const { container } = render(<SimboloRimor variante="mono" />);
    expect(container.querySelector('svg')?.getAttribute('class')).toBe('simbolo mono');
  });
});

describe('Logotipo', () => {
  it('muestra el nombre como texto vivo', () => {
    render(<Logotipo />);
    expect(screen.getByText('Rimor').tagName).toBe('B');
  });
});
