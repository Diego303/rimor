import { type Elemento, ok } from '@rimor/formato';
import { describe, expect, it, vi } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { apiIndice } from './indice';
import { empujon, MAX_RESULTADOS, MotorBusqueda, type RepositorioBusqueda } from './motor';

const AHORA = new Date('2026-10-18T12:00:00+02:00');

function el(
  n: number,
  cambios: Partial<Elemento['frontmatter']> = {},
  original = `original ${n}`,
  notas = '',
): Elemento {
  const base = elementoFalso(n, original, 'texto');
  return { ...base, notas, frontmatter: { ...base.frontmatter, ...cambios } };
}

async function espacio(...elementos: Elemento[]) {
  const repositorio = new Repositorio(new AlmacenMemoria());
  for (const e of elementos) await repositorio.guardarElemento(e);
  return repositorio;
}

function cacheFalsa() {
  let datos: Uint8Array | undefined;
  return {
    indice: async () => datos,
    guardarIndice: vi.fn(async (d: Uint8Array) => {
      datos = d;
    }),
    romper: () => {
      datos = new Uint8Array([1, 2, 3]);
    },
  };
}

const refs = async (m: MotorBusqueda, q: string) =>
  (await m.buscar(q, { ahora: AHORA })).resultados.map((r) => r.fm.ref);

describe('motor de búsqueda', () => {
  it('indexa al abrir el título, las notas, el original y lo derivado; busca con filtros', async () => {
    const repositorio = await espacio(
      el(1, { titulo: 'Timeout en streaming', etiquetas: ['ureq'] }),
      el(2, { tipo: 'log', titulo: 'Log del gateway' }, 'ERROR read timeout\nINFO ok', 'visto en staging'),
      el(3, { titulo: 'Receta' }, 'harina y agua'),
    );
    const motor = new MotorBusqueda({
      repositorio,
      api: apiIndice(),
      indexable: async (e) => (e.frontmatter.ref === 'TXT-0003' ? 'panaderia' : ''),
    });
    await motor.sincronizar();
    expect(motor.estado()).toEqual({ fase: 'listo' });
    expect(motor.indexados()).toBe(3);
    expect(await refs(motor, 'timeout')).toEqual(['TXT-0001', 'TXT-0002']);
    expect(await refs(motor, 'staging')).toEqual(['TXT-0002']);
    expect(await refs(motor, 'harina')).toEqual(['TXT-0003']);
    expect(await refs(motor, 'panaderia')).toEqual(['TXT-0003']);
    expect(await refs(motor, 'timeout tipo:log')).toEqual(['TXT-0002']);
    expect(await refs(motor, 'timeout #ureq')).toEqual(['TXT-0001']);
    expect(await refs(motor, 'tipo:nada timeout')).toEqual([]);
    const r = await motor.buscar('staging', { ahora: AHORA });
    expect(r.resultados[0]).toMatchObject({ enContenido: true, terminos: ['staging'] });
    expect((await motor.buscar('timeout', { ahora: AHORA })).facetas).toEqual({
      tipos: [
        ['log', 1],
        ['texto', 1],
      ],
      colecciones: [],
      etiquetas: [['ureq', 1]],
    });
  });

  it('frases exactas y exclusiones (palabra y frase)', async () => {
    const repositorio = await espacio(
      el(1, {}, 'read timeout en el cliente'),
      el(2, {}, 'timeout al read del body'),
      el(3, {}, 'read timeout y read body'),
    );
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    expect((await refs(motor, '"read timeout"')).sort()).toEqual(['TXT-0001', 'TXT-0003']);
    expect((await refs(motor, '"Read Timeout" -body')).sort()).toEqual(['TXT-0001']);
    expect((await refs(motor, 'timeout -"read body"')).sort()).toEqual(['TXT-0001', 'TXT-0002']);
    expect(await refs(motor, '"read timeout" -cliente -"read body"')).toEqual([]);
    expect(await refs(motor, '#')).toEqual([]);
  });

  it('solo filtros: lo filtrado de lo más reciente a lo más antiguo; sin nada que buscar, nada', async () => {
    const repositorio = await espacio(
      el(1, { creado: '2026-10-10T10:00:00+02:00', tipo: 'log' }),
      el(2, { creado: '2026-10-17T10:00:00+02:00', tipo: 'log' }),
      el(3, { creado: '2026-10-18T10:00:00+02:00' }),
    );
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    // Sin índice todavía, los filtros ya funcionan.
    expect(await refs(motor, 'tipo:log')).toEqual(['TXT-0002', 'TXT-0001']);
    await motor.sincronizar();
    expect(await refs(motor, 'tipo:log')).toEqual(['TXT-0002', 'TXT-0001']);
    expect(await refs(motor, 'tipo:log -original')).toEqual([]);
    expect(await refs(motor, 'desde:2026-10-17')).toEqual(['TXT-0003', 'TXT-0002']);
    expect(await refs(motor, '   ')).toEqual([]);
  });

  it('ranking: a igual relevancia, primero lo fijado y lo reciente', async () => {
    const repositorio = await espacio(
      el(1, { titulo: 'timeout', creado: '2026-08-01T10:00:00+02:00' }),
      el(2, { titulo: 'timeout', creado: '2026-10-18T10:00:00+02:00' }),
      el(3, { titulo: 'timeout', creado: '2026-08-01T10:00:00+02:00', fijado: true }),
    );
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    expect(await refs(motor, 'timeout')).toEqual(['TXT-0003', 'TXT-0002', 'TXT-0001']);
    const fm = el(1).frontmatter;
    expect(empujon({ ...fm, creado: AHORA.toISOString() }, AHORA)).toBeCloseTo(1.25);
    expect(empujon({ ...fm, creado: '2026-10-11T12:00:00+02:00' }, AHORA)).toBeCloseTo(1.125);
    expect(empujon({ ...fm, creado: '2020-01-01T00:00:00Z', fijado: true }, AHORA)).toBeCloseTo(1.25);
  });

  it('como mucho 50 resultados, con el total', async () => {
    const repositorio = await espacio(...Array.from({ length: 60 }, (_, i) => el(i + 1, { titulo: `nota ${i}` })));
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    const r = await motor.buscar('nota');
    expect(r.total).toBe(60);
    expect(r.resultados).toHaveLength(MAX_RESULTADOS);
    // Las facetas cuentan los 60, no solo los devueltos.
    expect(r.facetas.tipos).toEqual([['texto', 60]]);
  });

  it('reindexa solo lo que cambió y quita lo borrado o en la papelera', async () => {
    const repositorio = await espacio(el(1, { titulo: 'uno' }), el(2, { titulo: 'dos' }), el(3, { titulo: 'tres' }));
    const indexable = vi.fn(async () => '');
    const motor = new MotorBusqueda({ repositorio, api: apiIndice(), indexable });
    await motor.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(3);
    await motor.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(3);
    const id1 = el(1).frontmatter.id;
    await repositorio.actualizarElemento(id1, (e) => ({ ...e, frontmatter: { ...e.frontmatter, titulo: 'cambiado' } }));
    await repositorio.moverAPapelera(el(2).frontmatter.ref);
    await repositorio.borrarElemento(el(3).frontmatter.id);
    await motor.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(4);
    expect(motor.indexados()).toBe(1);
    expect(await refs(motor, 'cambiado')).toEqual(['TXT-0001']);
    expect(await refs(motor, 'uno')).toEqual([]);
    expect(await refs(motor, 'dos')).toEqual([]);
  });

  it('las sincronizaciones pedidas a la vez se juntan y la última ve lo último', async () => {
    const repositorio = await espacio(el(1, { titulo: 'uno' }));
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    const a = motor.sincronizar();
    await repositorio.guardarElemento(el(2, { titulo: 'dos' }));
    const b = motor.sincronizar();
    const c = motor.sincronizar();
    await Promise.all([a, b, c]);
    expect(await refs(motor, 'dos')).toEqual(['TXT-0002']);
  });

  it('guarda el índice comprimido (agrupado, solo si escribe) y lo carga al abrir; uno ilegible se rehace', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const repositorio = await espacio(el(1, { titulo: 'timeout' }));
      const cache = cacheFalsa();
      let escribe = false;
      const lector = new MotorBusqueda({ repositorio, api: apiIndice(), cache, puedeEscribir: () => escribe });
      await lector.sincronizar();
      await vi.runAllTimersAsync();
      expect(cache.guardarIndice).not.toHaveBeenCalled();

      escribe = true;
      const motor = new MotorBusqueda({ repositorio, api: apiIndice(), cache, puedeEscribir: () => escribe });
      await motor.sincronizar();
      await motor.sincronizar();
      expect(cache.guardarIndice).not.toHaveBeenCalled();
      await vi.runAllTimersAsync();
      // La escritura que lanzó el temporizador; esperarla no escribe otra vez (no hay nada nuevo).
      await motor.guardar();
      expect(cache.guardarIndice).toHaveBeenCalledTimes(1);

      const indexable = vi.fn(async () => '');
      const otro = new MotorBusqueda({ repositorio, api: apiIndice(), cache, indexable });
      expect(await refs(otro, 'timeout')).toEqual(['TXT-0001']);
      await otro.sincronizar();
      expect(indexable).not.toHaveBeenCalled();

      cache.romper();
      const rehecho = new MotorBusqueda({ repositorio, api: apiIndice(), cache, indexable });
      await rehecho.sincronizar();
      expect(indexable).toHaveBeenCalledTimes(1);
      expect(await refs(rehecho, 'timeout')).toEqual(['TXT-0001']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cerrar guarda lo pendiente; un lector que falla indexa igualmente lo demás', async () => {
    const repositorio = await espacio(el(1, { titulo: 'timeout' }));
    const cache = cacheFalsa();
    const motor = new MotorBusqueda({
      repositorio,
      api: apiIndice(),
      cache,
      indexable: async () => {
        throw new Error('lector roto');
      },
    });
    await motor.sincronizar();
    await motor.cerrar();
    expect(cache.guardarIndice).toHaveBeenCalledTimes(1);
    expect(await refs(motor, 'timeout')).toEqual(['TXT-0001']);
  });

  it('el estado pasa por «indexando» con su progreso', async () => {
    const repositorio = await espacio(...Array.from({ length: 30 }, (_, i) => el(i + 1)));
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    const estados: string[] = [];
    motor.alCambiarEstado((e) => estados.push(e.fase === 'indexando' ? `${e.hechos}/${e.total}` : e.fase));
    await motor.sincronizar();
    expect(estados).toEqual(['0/30', '25/30', 'listo']);
  });
});

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
