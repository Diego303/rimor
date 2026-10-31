import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlantillaPintada } from './PlantillaPintada';

describe('PlantillaPintada', () => {
  it('el campo variable de Drain (<*>) es un marcador como <N>, que se ve como «*» y se lee como lo que es', () => {
    const { container } = render(<PlantillaPintada plantilla="ERROR payment declined for <*> after <N> ms" />);
    const marcadores = [...container.querySelectorAll('.ph')];
    expect(marcadores.map((e) => e.textContent)).toEqual(['*campo variable', 'N']);
    expect(marcadores[0]?.querySelector('[aria-hidden="true"]')?.textContent).toBe('*');
    expect(marcadores[0]?.querySelector('.solo-lector')?.textContent).toBe('campo variable');
    expect(container.querySelector('.lv-ERROR')?.textContent).toBe('ERROR');
  });
});
