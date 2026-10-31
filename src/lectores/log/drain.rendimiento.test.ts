/**
 * Presupuesto de tiempo de las plantillas con Drain (IN-048, plan §15: 50.000 líneas en menos de 2 s): con muchos
 * campos variables sin forma conocida, y con muchas plantillas distintas (un log de accesos con una ruta por línea).
 * Corre en el proyecto `rendimiento`, solo y después del resto.
 */
import { describe, expect, it } from 'vitest';
import { analizar } from './analisis';
import { agrupar } from './drain';

const letras = 'abcdefghijklmnopqrstuvwxyz';
/** Un nombre de solo letras, distinto para cada `i`. */
const nombre = (i: number) => {
  let s = '';
  for (let k = i; s.length < 4 || k > 0; k = Math.floor(k / 26)) s += letras[k % 26];
  return s;
};

describe('Drain: rendimiento', () => {
  it('50.000 líneas con 5.000 usuarios y 300 colas distintas en menos de 2 s', () => {
    const lineas = Array.from({ length: 50_000 }, (_, i) =>
      i % 3
        ? `2026-10-17T17:40:${String(i % 60).padStart(2, '0')}Z INFO user ${nombre(i % 5000)} logged in from web`
        : `2026-10-17T17:40:${String(i % 60).padStart(2, '0')}Z WARN cola cola-${'xyz'[i % 3]}${i % 300} llena tras reintentos`,
    );
    const inicio = performance.now();
    const d = analizar(lineas.join('\n'));
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(d.plantillas.map((p) => p.plantilla)).toEqual([
      'INFO user <*> logged in from web',
      'WARN cola <*> llena tras reintentos',
    ]);
  });

  it('50.000 líneas de accesos con una ruta distinta cada una en menos de 2 s', () => {
    const lineas = Array.from(
      { length: 50_000 },
      (_, i) =>
        `10.0.0.${i % 250} - - [17/Oct/2026:17:40:${String(i % 60).padStart(2, '0')} +0000] "GET /users/${nombre(i)}/profile HTTP/1.1" 200 512`,
    );
    const inicio = performance.now();
    const d = analizar(lineas.join('\n'));
    expect(performance.now() - inicio).toBeLessThan(2000);
    // Las rutas se comparan enteras: una plantilla por ruta.
    expect(d.plantillas).toHaveLength(50_000);
  });

  it('20.000 plantillas distintas de 40 palabras en menos de 2 s', () => {
    const p = Array.from({ length: 20_000 }, (_, i) =>
      ['INFO', ...Array.from({ length: 39 }, (_, k) => (k % 7 === i % 7 ? nombre(i) : `p${k % 3 ? '' : k}x`))].join(
        ' ',
      ),
    );
    const inicio = performance.now();
    agrupar(p);
    expect(performance.now() - inicio).toBeLessThan(2000);
  });
});
