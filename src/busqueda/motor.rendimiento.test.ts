/**
 * Presupuesto de tiempo de la búsqueda (F0-8): 50 ms con 10.000 elementos. Es un `.rendimiento.test.ts`: corre en
 * su propio proyecto, después del resto y sin otras pruebas a la vez (`pnpm test`), porque mide tiempo de reloj y
 * con todos los workers ocupados mediría la máquina, no la búsqueda.
 */
import { type Elemento, ok } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { apiIndice } from './indice';
import { MotorBusqueda, type RepositorioBusqueda } from './motor';

function el(n: number, cambios: Partial<Elemento['frontmatter']>, original: string): Elemento {
  const base = elementoFalso(n, original, 'texto');
  return { ...base, frontmatter: { ...base.frontmatter, ...cambios } };
}

/**
 * Un repositorio de mentira con muchos elementos (sin escribir archivos): textos de 30 a 150 palabras de un
 * vocabulario de 20.000 con la frecuencia de un idioma (ley de Zipf), el caso realista de F0-8.
 */
function repositorioGrande(n: number): { repositorio: RepositorioBusqueda; vocabulario: string[] } {
  // mulberry32: el mismo corpus en cada ejecución.
  let semilla = 7;
  const azar = () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const silabas =
    'ba be bi bo bu ca ce ci co cu da de di do du fa fe fi fo ga ge go la le li lo lu ma me mi mo na ne ni no pa pe pi po ra re ri ro sa se si so ta te ti to va ve vi tra tre pro sen ten mar'.split(
      ' ',
    );
  const vocabulario = [
    ...new Set(
      Array.from({ length: 30_000 }, () =>
        Array.from({ length: 2 + Math.floor(azar() * 3) }, () => silabas[Math.floor(azar() * silabas.length)]).join(''),
      ),
    ),
  ].slice(0, 20_000);
  const acumulado: number[] = [];
  const total = vocabulario.reduce((s, _, r) => s + 1 / (r + 1), 0);
  vocabulario.reduce((s, _, r) => {
    acumulado.push(s + 1 / (r + 1) / total);
    return s + 1 / (r + 1) / total;
  }, 0);
  const palabra = () => {
    const x = azar();
    let [lo, hi] = [0, acumulado.length - 1];
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if ((acumulado[m] ?? 1) < x) lo = m + 1;
      else hi = m;
    }
    return vocabulario[lo] ?? '';
  };
  const elementos = new Map<string, Elemento>();
  for (let i = 0; i < n; i++) {
    const texto = Array.from({ length: 30 + Math.floor(azar() * 120) }, palabra).join(' ');
    const e = el(i + 1, { titulo: `${palabra()} ${palabra()} ${palabra()}`, tipo: i % 3 ? 'texto' : 'log' }, texto);
    elementos.set(e.frontmatter.id, e);
  }
  const fms = [...elementos.values()].map((e) => e.frontmatter);
  return {
    vocabulario,
    repositorio: { elementos: () => fms, leerElemento: async (id) => ok(elementos.get(id) as Elemento) },
  };
}

describe('rendimiento', () => {
  it('busca en menos de 50 ms con 10.000 elementos', { timeout: 120_000 }, async () => {
    const { repositorio, vocabulario: v } = repositorioGrande(10_000);
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    expect(motor.indexados()).toBe(10_000);
    expect(v).toHaveLength(20_000);
    const consultas = [
      v[10], // muy común: en la mitad
      v[49],
      v[499],
      v[4999],
      'ba', // prefijo de dos letras
      `${v[20]}x`, // con errata
      `${v[9]} ${v[30]}`,
      `tipo:log ${v[3]}`,
      `${v[2]} -${v[5]}`,
    ] as string[];
    for (const q of consultas) await motor.buscar(q); // en caliente, como en la app
    (globalThis as { __perf?: boolean }).__perf = true;
    await motor.buscar(consultas[0] as string);
    await motor.buscar(consultas[0] as string);
    (globalThis as { __perf?: boolean }).__perf = false;
    for (const q of consultas) {
      const tiempos: number[] = [];
      for (let i = 0; i < 5; i++) {
        const t0 = performance.now();
        await motor.buscar(q);
        tiempos.push(performance.now() - t0);
      }
      tiempos.sort((a, b) => a - b);
      expect(tiempos[2], q).toBeLessThan(50);
    }
  });
});
