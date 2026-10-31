/**
 * Presupuesto de tiempo de las plantillas con Drain (IN-048, plan §15: 50.000 líneas en menos de 2 s): con muchos
 * campos variables sin forma conocida. Corre en el proyecto `rendimiento`, solo y después del resto.
 */
import { describe, expect, it } from 'vitest';
import { analizar } from './analisis';

describe('Drain: rendimiento', () => {
  it('50.000 líneas con 5.000 usuarios y 300 colas distintas en menos de 2 s', () => {
    const lineas = Array.from({ length: 50_000 }, (_, i) =>
      i % 3
        ? `2026-10-17T17:40:${String(i % 60).padStart(2, '0')}Z INFO user usuario${'abcdefghij'[i % 10]}${'klmnopqrst'[(i >> 3) % 10]}x${i % 5000} logged in from web`
        : `2026-10-17T17:40:${String(i % 60).padStart(2, '0')}Z WARN cola cola-${'xyz'[i % 3]}${i % 300} llena tras reintentos`,
    );
    const inicio = performance.now();
    const d = analizar(lineas.join('\n'));
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(d.plantillas.length).toBeLessThanOrEqual(3);
  });
});
