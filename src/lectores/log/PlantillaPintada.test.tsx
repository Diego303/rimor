import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlantillaPintada } from './PlantillaPintada';

describe('PlantillaPintada', () => {
  it('el campo variable de Drain (<*>) es un marcador como <N>', () => {
    const { container } = render(<PlantillaPintada plantilla="ERROR payment declined for <*> after <N> ms" />);
    expect([...container.querySelectorAll('.ph')].map((e) => e.textContent)).toEqual(['*', 'N']);
    expect(container.querySelector('.lv-ERROR')?.textContent).toBe('ERROR');
  });
});
