import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import casos from '../referencias/casos.json';
import { avisosDeMetodo, comparar, describir, icMediana, mannWhitney, ordenados } from './index';

const TOL_ESTADISTICO = 1e-9;
const TOL_P = 1e-6;

const cerca = (real: number, esperado: number | null, tol: number, nombre: string) => {
  if (esperado === null) return expect(Number.isNaN(real), nombre).toBe(true);
  expect(Math.abs(real - esperado), `${nombre}: ${real} frente a ${esperado}`).toBeLessThanOrEqual(
    tol * Math.max(1, Math.abs(esperado)),
  );
};

describe('referencias de NumPy y SciPy', () => {
  it('hay al menos 30 casos', () => {
    expect(casos.casos.length).toBeGreaterThanOrEqual(30);
  });

  for (const c of casos.casos) {
    it(c.nombre, () => {
      for (const [serie, ref] of [
        [c.a, c.da],
        [c.b, c.db],
      ] as const) {
        const d = describir(serie);
        expect(d.n).toBe(ref.n);
        for (const campo of [
          'mediana',
          'media',
          'desviacion',
          'cv',
          'minimo',
          'maximo',
          'p5',
          'q1',
          'q3',
          'p95',
        ] as const)
          cerca(d[campo], ref[campo], TOL_ESTADISTICO, campo);
      }
      const mw = mannWhitney(c.a, c.b);
      cerca(mw.u, c.mw.u, TOL_ESTADISTICO, 'U');
      cerca(mw.p, c.mw.p, TOL_P, 'p');
    });
  }
});

describe('el ejemplo del plan', () => {
  const [plan] = casos.casos;
  it('da medianas 38,535 y 36,795, cambio −4,5 % y p < 0,001', () => {
    const r = comparar(plan?.a ?? [], plan?.b ?? []);
    expect(r.a.mediana).toBeCloseTo(38.535, 9);
    expect(r.b.mediana).toBeCloseTo(36.795, 9);
    expect(r.cambio).toBeCloseTo(-4.5154, 3);
    expect(r.p).toBeLessThan(0.001);
    expect(r).toMatchObject({ significativo: true, sentido: 'baja' });
  });

  it('IC 95 % de la mediana de reqwest: 38,11 – 39,02 (pantallas de referencia)', () => {
    expect(icMediana(ordenados(plan?.a ?? []))).toEqual([38.11, 39.02]);
  });
});

describe('avisos de método', () => {
  it('pocas repeticiones, ruido y atípicos', () => {
    expect(avisosDeMetodo([1, 2, 3]).map((a) => a.tipo)).toContain('pocas');
    expect(avisosDeMetodo([10, 12, 9, 11, 15, 8, 13, 10, 9, 14]).map((a) => a.tipo)).toContain('ruido');
    const conAtipico = [38.4, 39.0, 37.9, 38.8, 38.2, 37.9, 38.6, 39.3, 38.0, 38.9, 55.0];
    expect(avisosDeMetodo(conAtipico).find((a) => a.tipo === 'atipicos')).toEqual({ tipo: 'atipicos', valores: [55] });
    expect(avisosDeMetodo(casos.casos[0]?.a ?? []).map((a) => a.tipo)).toEqual(['atipicos']);
  });
});

describe('propiedades', () => {
  const serie = fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 2, maxLength: 60 });

  it('mediana, percentiles e IC quedan dentro de [mínimo, máximo] y ordenados', () => {
    fc.assert(
      fc.property(serie, (v) => {
        const d = describir(v);
        for (const x of [d.mediana, d.p5, d.q1, d.q3, d.p95, d.icBajo, d.icAlto]) {
          expect(x).toBeGreaterThanOrEqual(d.minimo);
          expect(x).toBeLessThanOrEqual(d.maximo);
        }
        expect(d.p5).toBeLessThanOrEqual(d.q1);
        expect(d.q1).toBeLessThanOrEqual(d.mediana);
        expect(d.mediana).toBeLessThanOrEqual(d.q3);
        expect(d.icBajo).toBeLessThanOrEqual(d.icAlto);
      }),
    );
  });

  it('Mann-Whitney: p en [0, 1], U₁ + U₂ = n₁·n₂ y simétrica al cambiar el orden', () => {
    fc.assert(
      fc.property(serie, serie, (a, b) => {
        const ab = mannWhitney(a, b);
        const ba = mannWhitney(b, a);
        expect(ab.p).toBeGreaterThanOrEqual(0);
        expect(ab.p).toBeLessThanOrEqual(1);
        expect(ab.u + ba.u).toBeCloseTo(a.length * b.length, 6);
        expect(ab.p).toBeCloseTo(ba.p, 12);
      }),
    );
  });
});
