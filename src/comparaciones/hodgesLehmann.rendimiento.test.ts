/**
 * Presupuesto de tiempo de Hodges-Lehmann (IN-047): dos series de 10.000 (un pytest-benchmark de una función
 * rápida) sin escribir las 10⁸ diferencias. Corre en el proyecto `rendimiento`, solo y después del resto.
 */
import { hodgesLehmann } from '@rimor/estadistica';
import { describe, expect, it } from 'vitest';

describe('Hodges-Lehmann: rendimiento', () => {
  it('10.000 × 10.000 en menos de 2 s, sin escribir las 10⁸ diferencias', () => {
    let semilla = 7;
    const azar = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    const a = Array.from({ length: 10_000 }, () => 38 + azar() * 2);
    const b = Array.from({ length: 10_000 }, () => 36.5 + azar() * 2);
    const inicio = performance.now();
    const r = hodgesLehmann(a, b);
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(r.estimacion).toBeCloseTo(-1.5, 1);
    expect(r.icBajo).toBeLessThan(r.estimacion);
    expect(r.icAlto).toBeGreaterThan(r.estimacion);
  });
});
