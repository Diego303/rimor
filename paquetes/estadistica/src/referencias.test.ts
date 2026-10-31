import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import casos from '../referencias/casos.json';
import {
  avisosDeMetodo,
  comparar,
  describir,
  distribucionU,
  hodgesLehmann,
  icMediana,
  mannWhitney,
  ordenados,
} from './index';

const TOL_ESTADISTICO = 1e-9;
const TOL_P = 1e-6;

/** Estadísticos: tolerancia relativa con un mínimo absoluto igual a ella (valores grandes y cercanos a 0). */
const cerca = (real: number, esperado: number | null, tol: number, nombre: string) => {
  if (esperado === null) return expect(Number.isNaN(real), nombre).toBe(true);
  expect(Math.abs(real - esperado), `${nombre}: ${real} frente a ${esperado}`).toBeLessThanOrEqual(
    tol * Math.max(1, Math.abs(esperado)),
  );
};

/** p: tolerancia relativa pura, para que un p de 1e-8 no pase si sale 0. */
const cercaP = (real: number, esperado: number) =>
  expect(Math.abs(real - esperado), `p: ${real} frente a ${esperado}`).toBeLessThanOrEqual(TOL_P * esperado);

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
        expect([d.icBajo, d.icAlto]).toEqual(ref.ic);
      }
      const mw = mannWhitney(c.a, c.b);
      cerca(mw.u, c.mw.u, TOL_ESTADISTICO, 'U');
      cercaP(mw.p, c.mw.p);
      // Hodges-Lehmann (IN-047): la estimación y su intervalo de Moses, exacto o normal como la referencia.
      const hl = hodgesLehmann(c.a, c.b);
      expect(hl.exacto, 'exacto').toBe(c.hl.exacto);
      cerca(hl.estimacion, c.hl.estimacion, TOL_ESTADISTICO, 'HL');
      cerca(hl.icBajo, c.hl.icBajo, TOL_ESTADISTICO, 'HL bajo');
      cerca(hl.icAlto, c.hl.icAlto, TOL_ESTADISTICO, 'HL alto');
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

describe('casos límite de la revisión', () => {
  it('el sentido sale de la diferencia aunque las medianas sean negativas o cero', () => {
    const neg = comparar(
      Array.from({ length: 20 }, (_, i) => -11 + (i % 3) * 0.1),
      Array.from({ length: 20 }, (_, i) => -6 + (i % 3) * 0.1),
    );
    expect(neg.cambio).toBeGreaterThan(0);
    expect(neg.sentido).toBe('sube');
    const cero = comparar([...Array(11).fill(0), ...Array(10).fill(1)], [...Array(10).fill(-1), ...Array(11).fill(0)]);
    expect(Number.isNaN(cero.cambio)).toBe(true);
    expect(cero.sentido).toBe('baja');
  });

  it('un NaN en la entrada no da resultados engañosos', () => {
    const d = describir([3, Number.NaN, 1, 2]);
    expect(Number.isNaN(d.mediana) && Number.isNaN(d.minimo) && Number.isNaN(d.icBajo)).toBe(true);
    expect(Number.isNaN(mannWhitney([1, 2, Number.NaN, 4, 5], [6, 7, 8, 9, 10]).p)).toBe(true);
    expect(comparar([1, Number.NaN], [2, 3]).significativo).toBe(false);
  });

  it('media 0 con dispersión avisa de ruido', () => {
    expect(avisosDeMetodo(Array.from({ length: 12 }, (_, i) => (i % 2 ? 1 : -1))).map((a) => a.tipo)).toContain(
      'ruido',
    );
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

describe('Hodges-Lehmann (IN-047)', () => {
  it('la distribución exacta de U suma 1 y es simétrica (m = 3, n = 4: los 35 arreglos)', () => {
    const p = distribucionU(3, 4);
    expect(p).toHaveLength(13);
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 12);
    for (let u = 0; u <= 12; u++) expect(p[u]).toBeCloseTo(p[12 - u] ?? Number.NaN, 12);
    expect((p[0] ?? 0) * 35).toBeCloseTo(1, 12);
  });

  it('el ejemplo del plan: ureq es unos 1,8 ms más rápido que reqwest', () => {
    const [plan] = casos.casos;
    const hl = hodgesLehmann(plan?.a ?? [], plan?.b ?? []);
    expect(hl.estimacion).toBeCloseTo(-1.82, 9);
    expect(hl.icBajo).toBeLessThan(hl.estimacion);
    expect(hl.icAlto).toBeGreaterThan(hl.estimacion);
    expect(hl.icAlto).toBeLessThan(0);
  });

  it('casos límite: vacías, con NaN, una sola medición o demasiado pocas para un intervalo', () => {
    expect(Number.isNaN(hodgesLehmann([], [1, 2]).estimacion)).toBe(true);
    expect(Number.isNaN(hodgesLehmann([1, Number.NaN], [2, 3]).estimacion)).toBe(true);
    const uno = hodgesLehmann([7], [8, 9, 10]);
    expect(uno.estimacion).toBe(2);
    expect(Number.isNaN(uno.icBajo) && Number.isNaN(uno.icAlto)).toBe(true);
  });

  it('propiedades: al intercambiar las series cambia de signo; al desplazar una, se desplaza igual', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: -1e3, max: 1e3, noNaN: true }), { minLength: 1, maxLength: 15 }),
        fc.array(fc.double({ min: -1e3, max: 1e3, noNaN: true }), { minLength: 1, maxLength: 15 }),
        fc.double({ min: -100, max: 100, noNaN: true }),
        (a, b, d) => {
          const ab = hodgesLehmann(a, b);
          const ba = hodgesLehmann(b, a);
          expect(ba.estimacion).toBeCloseTo(-ab.estimacion, 6);
          const desplazada = hodgesLehmann(
            a,
            b.map((x) => x + d),
          );
          expect(desplazada.estimacion).toBeCloseTo(ab.estimacion + d, 6);
        },
      ),
    );
  });
});

describe('Hodges-Lehmann sin escribir todas las diferencias (revisión de IN-047)', () => {
  it('da lo mismo que ordenar todas las m·n diferencias, también con empates y repetidos', () => {
    const fuerzaBruta = (a: number[], b: number[]) => {
      const d = b.flatMap((y) => a.map((x) => y - x)).sort((x, y) => x - y);
      const N = d.length;
      return N % 2 ? d[(N - 1) / 2] : ((d[N / 2 - 1] ?? 0) + (d[N / 2] ?? 0)) / 2;
    };
    const entero = fc.integer({ min: -20, max: 20 });
    const real = fc.double({ min: -1e3, max: 1e3, noNaN: true });
    for (const valor of [entero, real])
      fc.assert(
        fc.property(
          fc.array(valor, { minLength: 1, maxLength: 60 }),
          fc.array(valor, { minLength: 1, maxLength: 60 }),
          (a, b) => {
            expect(hodgesLehmann(a, b).estimacion).toBeCloseTo(fuerzaBruta(a, b) ?? Number.NaN, 9);
          },
        ),
      );
  });
});
