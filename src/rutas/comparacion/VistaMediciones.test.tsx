import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { compararMediciones } from '../../comparaciones/mediciones';
import { lectorMediciones } from '../../lectores/mediciones/lector';
import VistaMediciones from '../../lectores/mediciones/Vista';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { VistaComparacionMediciones } from './VistaMediciones';

const leer = (archivo: string) => readFileSync(join(process.cwd(), 'fixtures/mediciones', archivo), 'utf8');
const sinNbsp = (s: string | null | undefined) => (s ?? '').replaceAll(' ', ' ');

describe('mediciones de v0.2 en pantalla (IN-047)', () => {
  afterEach(() => cleanup());

  it('la comparación dice cuánto cambia según Hodges-Lehmann, con su intervalo', async () => {
    const a = await lectorMediciones.derivar(elementoFalso(1, leer('reqwest.txt'), 'mediciones'));
    const b = await lectorMediciones.derivar(elementoFalso(2, leer('ureq.txt'), 'mediciones'));
    const c = compararMediciones(a, b);
    if (!c) throw new Error('sin comparación');
    render(<VistaComparacionMediciones c={c} nombres={['reqwest', 'ureq']} />);
    const linea = screen.getByText(/según Hodges-Lehmann/);
    expect(sinNbsp(linea.textContent)).toMatch(
      /^ureq frente a reqwest: −1,82 ms según Hodges-Lehmann \(IC 95 %: −2,\d\d a −1,\d\d\)\.$/,
    );
  });

  it('un resumen de criterion: su mediana e intervalo, y por qué no hay gráfico', async () => {
    const texto = leer('criterion-estimates.json');
    const el = elementoFalso(3, texto, 'mediciones');
    const datos = await lectorMediciones.derivar(el);
    const { container } = render(<VistaMediciones el={el} datos={datos} editable />);
    expect(sinNbsp(container.querySelector('.verdict .big')?.textContent)).toBe('38,48 µs');
    expect(screen.getByText('Mediana según criterion')).toBeTruthy();
    expect(sinNbsp(screen.getByText(/^IC 95 %/).textContent)).toBe('IC 95 %: 38,39 – 38,58');
    expect(screen.getByText(/^Sin las mediciones sueltas no hay gráfico/)).toBeTruthy();
    expect(container.querySelector('svg.grafico-puntos, .grafico-puntos')).toBeNull();
  });
});
