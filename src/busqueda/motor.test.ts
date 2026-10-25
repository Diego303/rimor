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

describe('motor de búsqueda: casos de la revisión', () => {
  const conAdjunto = (n: number, titulo: string): Elemento => {
    const e = el(n, {
      titulo,
      adjunto: { ruta: `adjuntos/${n}.log`, hash: 'aa', tam: 3_000_000, mime: 'text/plain' } as never,
    });
    return { ...e, original: null };
  };

  it('un adjunto de texto se busca por su contenido, también con frases', async () => {
    const e = conAdjunto(1, 'Log grande');
    const repositorio: RepositorioBusqueda = { elementos: () => [e.frontmatter], leerElemento: async () => ok(e) };
    const motor = new MotorBusqueda({
      repositorio,
      api: apiIndice(),
      cargarOriginal: async () => 'INFO arranque\nERROR read timeout en el cliente',
    });
    await motor.sincronizar();
    expect(await refs(motor, 'arranque')).toEqual(['TXT-0001']);
    expect(await refs(motor, '"read timeout"')).toEqual(['TXT-0001']);
    expect(await refs(motor, 'log -"read timeout"')).toEqual([]);
  });

  it('un lector nuevo reindexa aunque el frontmatter aún diga la versión anterior', async () => {
    const repositorio = await espacio(el(1, { titulo: 'uno' }));
    const indexable = vi.fn(async () => '');
    let version = 1;
    const opciones = { repositorio, api: apiIndice(), indexable, lectorVigente: () => `texto@${version}` };
    const motor = new MotorBusqueda(opciones);
    await motor.sincronizar();
    await motor.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(1);
    version = 2;
    await motor.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(2);
  });

  it('lo que falla al indexar queda incompleto: no se reintenta en la sesión, sí al abrir otra vez', async () => {
    const repositorio = await espacio(el(1, { titulo: 'uno' }));
    const cache = cacheFalsa();
    let falla = true;
    const indexable = vi.fn(async () => {
      if (falla) throw new Error('plazo agotado');
      return 'plantilla';
    });
    const motor = new MotorBusqueda({ repositorio, api: apiIndice(), cache, indexable });
    await motor.sincronizar();
    // Lo demás sí se encuentra.
    expect(await refs(motor, 'uno')).toEqual(['TXT-0001']);
    await motor.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(1);
    await motor.cerrar();

    falla = false;
    const otro = new MotorBusqueda({ repositorio, api: apiIndice(), cache, indexable });
    await otro.sincronizar();
    expect(indexable).toHaveBeenCalledTimes(2);
    expect(await refs(otro, 'plantilla')).toEqual(['TXT-0001']);
  });

  it('rehacer vuelve a indexar todo; un índice que falla deja el estado en «listo»', async () => {
    const repositorio = await espacio(el(1, { titulo: 'uno' }), el(2, { titulo: 'dos' }));
    const indexable = vi.fn(async () => '');
    const motor = new MotorBusqueda({ repositorio, api: apiIndice(), indexable });
    await motor.sincronizar();
    await motor.rehacer();
    expect(indexable).toHaveBeenCalledTimes(4);

    const roto = { ...apiIndice(), poner: async () => Promise.reject(new Error('busqueda.workerNoCarga')) };
    const averiado = new MotorBusqueda({ repositorio, api: roto });
    await expect(averiado.sincronizar()).resolves.toBeUndefined();
    expect(averiado.estado()).toEqual({ fase: 'listo' });
  });

  it('frases por palabras completas; una palabra entre comillas va tal cual', async () => {
    const repositorio = await espacio(
      el(1, {}, 'thread timeouts here'),
      el(2, {}, 'a read-timeout happened'),
      el(3, {}, 'timeout del timer'),
      el(4, {}, 'el time pasa'),
    );
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    expect(await refs(motor, '"read timeout"')).toEqual(['TXT-0002']);
    expect(await refs(motor, '"time"')).toEqual(['TXT-0004']);
  });

  it('con más de 200 candidatos el total de una frase es aproximado; excluir una frase mira todos', async () => {
    const repositorio = await espacio(
      ...Array.from({ length: 230 }, (_, i) => el(i + 1, { titulo: `log ${i}` }, 'ERROR read timeout')),
    );
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    const r = await motor.buscar('"read timeout"');
    expect(r.aproximado).toBe(true);
    expect(r.total).toBe(200);
    expect((await motor.buscar('log -"read timeout"')).total).toBe(0);
    expect((await motor.buscar('log')).aproximado).toBe(false);
  });

  it('una búsqueda cortada se rechaza; los textos de frase se leen una vez por versión', async () => {
    const repositorio = await espacio(el(1, {}, 'read timeout'));
    const leer = vi.spyOn(repositorio, 'leerElemento');
    const motor = new MotorBusqueda({ repositorio, api: apiIndice() });
    await motor.sincronizar();
    leer.mockClear();
    const corte = new AbortController();
    corte.abort();
    await expect(motor.buscar('"read timeout"', { senal: corte.signal })).rejects.toThrow('Cortada');
    await motor.buscar('"read timeout"');
    await motor.buscar('"read timeout" -"nada aqui"');
    expect(leer).toHaveBeenCalledTimes(1);
  });
});
