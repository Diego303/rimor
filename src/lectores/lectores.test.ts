import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CacheEspacio } from '../almacen/cache/cache';
import { lectorPlantilla } from './_plantilla/lector';
import { ColaDerivados, type Ejecutor, esCancelado } from './derivados';
import { crearEjecutor, ejecutorEnHilo } from './ejecutor';
import { elementoFalso, lectorFalso } from './pruebas/falsos';
import { crearRegistro, LECTORES, ORDEN_DETECCION, puestoDe } from './registro';
import { definirTextos } from './textos';
import { carpetaDe } from './vistas';

/** Ejecutor que no termina hasta que se suelta cada trabajo, y anota el orden en que empiezan. */
function ejecutorManual() {
  const empezados: string[] = [];
  const soltar: (() => void)[] = [];
  const ejecutar: Ejecutor = (_nombre, el) =>
    new Promise((ok) => {
      empezados.push(el.frontmatter.ref);
      soltar.push(() => ok({ largo: (el.original ?? '').length }));
    });
  return { ejecutar, empezados, soltarSiguiente: () => soltar.shift()?.() };
}

const esperarVuelta = () => new Promise((r) => setTimeout(r, 0));

describe('registro', () => {
  it('busca por nombre y, si el lector ya no existe, por tipo', () => {
    const r = crearRegistro([lectorFalso()]);
    expect(r.porNombre('falso')?.nombre).toBe('falso');
    expect(r.paraElemento(elementoFalso(1))?.nombre).toBe('falso');
    expect(r.paraElemento(elementoFalso(1, 'x', 'desaparecido'))?.nombre).toBe('falso');
    const otroTipo = elementoFalso(2, 'x', 'desaparecido');
    otroTipo.frontmatter.tipo = 'log';
    expect(r.paraElemento(otroTipo)).toBeUndefined();
  });

  it('rechaza nombres repetidos o no válidos y versiones no enteras', () => {
    expect(() => crearRegistro([lectorFalso(), lectorFalso()])).toThrow('repetido');
    expect(() => crearRegistro([lectorFalso({ nombre: 'Con Espacios' })])).toThrow('Nombre');
    expect(() => crearRegistro([lectorFalso({ version: 0 })])).toThrow('Versión');
    expect(() => crearRegistro([lectorFalso({ version: 1.5 })])).toThrow('Versión');
  });

  it('el Anexo D tiene 17 puestos sin nombres repetidos y LECTORES respeta su orden', () => {
    expect(ORDEN_DETECCION).toHaveLength(17);
    const nombres = ORDEN_DETECCION.flat();
    expect(new Set(nombres).size).toBe(nombres.length);
    const puestos = LECTORES.map((l) => puestoDe(l.nombre));
    expect(puestos.every((p) => p >= 0)).toBe(true);
    expect([...puestos].sort((a, b) => a - b)).toEqual(puestos);
    expect(() => crearRegistro(LECTORES)).not.toThrow();
  });

  it('las vistas se encuentran por carpeta, la plantilla sin su guion bajo', () => {
    expect(carpetaDe('./log/Vista.tsx')).toBe('log');
    expect(carpetaDe('./_plantilla/Tarjeta.tsx')).toBe('plantilla');
  });
});

describe('textos de un lector', () => {
  it('interpolan, eligen plural, formatean números y caen al español', () => {
    const textos = definirTextos(
      { analizando: 'Analizando', n: { one: '{n} cosa', other: '{n} cosas' }, solo: 'solo en español' },
      { analizando: 'Analysing', n: { one: '{n} thing', other: '{n} things' } },
    );
    expect(textos.t('es', 'n', { n: 10000 })).toBe('10.000 cosas');
    expect(textos.t('en', 'n', { n: 1 })).toBe('1 thing');
    expect(textos.t('en', 'solo')).toBe('solo en español');
  });
});

describe('ColaDerivados', () => {
  it('deriva una vez y después lo saca de la caché', async () => {
    const lector = lectorFalso();
    const registro = crearRegistro([lector]);
    const cache = await CacheEspacio.abrir('d1', new IDBFactory());
    const cola = new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro), cache });
    expect(await cola.pedir(elementoFalso(1, 'abc'))).toEqual({ largo: 3 });
    const otra = new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro), cache });
    expect(await otra.pedir(elementoFalso(1, 'abc'))).toEqual({ largo: 3 });
    expect(lector.derivados).toBe(1);
    cache.cerrar();
  });

  it('comparte el trabajo entre peticiones iguales', async () => {
    const lector = lectorFalso();
    const registro = crearRegistro([lector]);
    const cola = new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro) });
    const el = elementoFalso(1);
    const [a, b] = await Promise.all([cola.pedir(el), cola.pedir(el, { prioridad: 'visible' })]);
    expect(a).toEqual(b);
    expect(lector.derivados).toBe(1);
    expect(cola.pendientes).toBe(0);
  });

  it('atiende primero lo visible y, dentro de cada prioridad, por orden de llegada', async () => {
    const m = ejecutorManual();
    const cola = new ColaDerivados({ registro: crearRegistro([lectorFalso()]), ejecutar: m.ejecutar });
    const peticiones = [
      cola.pedir(elementoFalso(1)),
      cola.pedir(elementoFalso(2)),
      cola.pedir(elementoFalso(3), { prioridad: 'visible' }),
      cola.pedir(elementoFalso(4)),
      cola.pedir(elementoFalso(5), { prioridad: 'visible' }),
    ];
    // Una petición visible de un trabajo de fondo ya en cola lo adelanta.
    peticiones.push(cola.pedir(elementoFalso(4), { prioridad: 'visible' }));
    for (let i = 0; i < 5; i++) {
      await esperarVuelta();
      m.soltarSiguiente();
    }
    await Promise.all(peticiones);
    expect(m.empezados).toEqual(['TXT-0001', 'TXT-0003', 'TXT-0004', 'TXT-0005', 'TXT-0002']);
  });

  it('cancelar en cola lo quita; cancelar en marcha rechaza la petición y guarda igual el resultado', async () => {
    const m = ejecutorManual();
    const cache = await CacheEspacio.abrir('d2', new IDBFactory());
    const cola = new ColaDerivados({ registro: crearRegistro([lectorFalso()]), ejecutar: m.ejecutar, cache });
    const enMarcha = new AbortController();
    const enCola = new AbortController();
    const a = cola.pedir(elementoFalso(1, 'abcd'), { senal: enMarcha.signal });
    const b = cola.pedir(elementoFalso(2), { senal: enCola.signal });
    // La consulta a la caché es asíncrona: se espera a que el primero esté de verdad en marcha.
    await vi.waitFor(() => expect(m.empezados).toEqual(['TXT-0001']));
    enCola.abort();
    enMarcha.abort();
    await expect(b).rejects.toSatisfy(esCancelado);
    await expect(a).rejects.toSatisfy(esCancelado);
    m.soltarSiguiente();
    // Lo cancelado en marcha termina y se guarda en la caché (asíncrona): se espera a que la cola quede vacía.
    await vi.waitFor(() => expect(cola.pendientes).toBe(0));
    expect(m.empezados).toEqual(['TXT-0001']);
    const fm = elementoFalso(1, 'abcd').frontmatter;
    await vi.waitFor(async () => expect(await cache.derivado(fm.id, 'falso', 1, fm.hash)).toEqual({ largo: 4 }));
    // Una señal ya cancelada ni siquiera entra.
    await expect(cola.pedir(elementoFalso(3), { senal: AbortSignal.abort() })).rejects.toSatisfy(esCancelado);
    cache.cerrar();
  });

  it('los errores llegan a quien espera y no se guardan', async () => {
    let fallar = true;
    const lector = lectorFalso({
      async derivar(el) {
        if (fallar) throw new Error('roto');
        return { largo: (el.original ?? '').length };
      },
    });
    const registro = crearRegistro([lector]);
    const cache = await CacheEspacio.abrir('d3', new IDBFactory());
    const cola = new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro), cache });
    await expect(cola.pedir(elementoFalso(1, 'ab'))).rejects.toThrow('roto');
    fallar = false;
    expect(await cola.pedir(elementoFalso(1, 'ab'))).toEqual({ largo: 2 });
    cache.cerrar();
  });

  it('subir la versión de un lector recalcula y borra lo de la versión vieja', async () => {
    const cache = await CacheEspacio.abrir('d4', new IDBFactory());
    const v1 = lectorFalso();
    const r1 = crearRegistro([v1]);
    const derivados: { version: number; datos: unknown }[] = [];
    await new ColaDerivados({ registro: r1, ejecutar: ejecutorEnHilo(r1), cache }).pedir(elementoFalso(1, 'abc'));

    const v2 = lectorFalso({
      version: 2,
      async derivar(el) {
        return { largo: (el.original ?? '').length * 10 };
      },
    });
    const r2 = crearRegistro([v2]);
    const cola2 = new ColaDerivados({
      registro: r2,
      ejecutar: ejecutorEnHilo(r2),
      cache,
      alDerivar: (_el, lector, datos) => derivados.push({ version: lector.version, datos }),
    });
    expect(await cola2.pedir(elementoFalso(1, 'abc'))).toEqual({ largo: 30 });
    expect(derivados).toEqual([{ version: 2, datos: { largo: 30 } }]);
    const fm = elementoFalso(1, 'abc').frontmatter;
    expect(await cache.derivado(fm.id, 'falso', 1, fm.hash)).toBeUndefined();
    expect(await cache.derivado(fm.id, 'falso', 2, fm.hash)).toEqual({ largo: 30 });
    cache.cerrar();
  });

  it('avisa también con los datos sacados de la caché (para poner al día el frontmatter)', async () => {
    const registro = crearRegistro([lectorFalso()]);
    const cache = await CacheEspacio.abrir('d5', new IDBFactory());
    await new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro), cache }).pedir(elementoFalso(1, 'abc'));
    const avisos: unknown[] = [];
    const cola = new ColaDerivados({
      registro,
      ejecutar: ejecutorEnHilo(registro),
      cache,
      alDerivar: (_e, _l, d) => avisos.push(d),
    });
    await cola.pedir(elementoFalso(1, 'abc'));
    expect(avisos).toEqual([{ largo: 3 }]);
    cache.cerrar();
  });

  it('un cálculo que no termina agota su plazo y la cola sigue', async () => {
    const registro = crearRegistro([lectorFalso()]);
    const enHilo = ejecutorEnHilo(registro);
    let agotados = 0;
    const cola = new ColaDerivados({
      registro,
      ejecutar: (n, el) => (el.frontmatter.ref === 'TXT-0001' ? new Promise(() => undefined) : enHilo(n, el)),
      plazoMs: 20,
      alAgotarPlazo: () => agotados++,
    });
    const colgado = cola.pedir(elementoFalso(1));
    const siguiente = cola.pedir(elementoFalso(2, 'ab'));
    await expect(colgado).rejects.toThrow('derivados.tiempoAgotado');
    expect(await siguiente).toEqual({ largo: 2 });
    expect(agotados).toBe(1);
  });

  it('si se cancela la única petición visible, el trabajo vuelve a ser de fondo', async () => {
    const m = ejecutorManual();
    const cola = new ColaDerivados({ registro: crearRegistro([lectorFalso()]), ejecutar: m.ejecutar });
    const ocupando = cola.pedir(elementoFalso(1));
    const fondo = cola.pedir(elementoFalso(2));
    const parar = new AbortController();
    const visibleCancelada = cola.pedir(elementoFalso(2), { prioridad: 'visible', senal: parar.signal });
    const visible = cola.pedir(elementoFalso(3), { prioridad: 'visible' });
    await esperarVuelta();
    parar.abort();
    await expect(visibleCancelada).rejects.toSatisfy(esCancelado);
    for (let i = 0; i < 3; i++) {
      m.soltarSiguiente();
      await esperarVuelta();
    }
    await Promise.all([ocupando, fondo, visible]);
    expect(m.empezados).toEqual(['TXT-0001', 'TXT-0003', 'TXT-0002']);
  });

  it('reenvía el progreso a quien espera, también al que llega a mitad', async () => {
    let avanzar: (h: number, t: number) => void = () => undefined;
    let terminar: () => void = () => undefined;
    const lector = lectorFalso({
      informaProgreso: true,
      derivar: (_el, opciones) =>
        new Promise((ok) => {
          avanzar = (h, t) => opciones?.alProgreso?.(h, t);
          terminar = () => ok({ largo: 1 });
        }),
    });
    const registro = crearRegistro([lector]);
    const cola = new ColaDerivados({ registro, ejecutar: ejecutorEnHilo(registro) });
    const vistos: string[] = [];
    const a = cola.pedir(elementoFalso(1), { alProgreso: (p) => vistos.push(`a ${p.hechas}/${p.total}`) });
    await vi.waitFor(() => expect(lector).toBeTruthy());
    await esperarVuelta();
    avanzar(50, 120);
    const b = cola.pedir(elementoFalso(1), { alProgreso: (p) => vistos.push(`b ${p.hechas}/${p.total}`) });
    avanzar(100, 120);
    terminar();
    await Promise.all([a, b]);
    expect(vistos).toEqual(['a 50/120', 'b 50/120', 'a 100/120', 'b 100/120']);
  });

  it('carga el original de un adjunto antes de derivar', async () => {
    const lector = lectorFalso();
    const registro = crearRegistro([lector]);
    const cola = new ColaDerivados({
      registro,
      ejecutar: ejecutorEnHilo(registro),
      cargarOriginal: async () => 'texto del adjunto',
    });
    const el = { ...elementoFalso(1), original: null };
    expect(await cola.pedir(el)).toEqual({ largo: 17 });
  });

  it('si el adjunto no se puede cargar, el trabajo falla y no se guarda nada en la caché', async () => {
    const registro = crearRegistro([lectorFalso()]);
    const cache = await CacheEspacio.abrir('d6', new IDBFactory());
    const cola = new ColaDerivados({
      registro,
      ejecutar: ejecutorEnHilo(registro),
      cache,
      cargarOriginal: async () => {
        throw new Error('almacen.adjuntoNoEncontrado');
      },
    });
    const el = { ...elementoFalso(1), original: null };
    await expect(cola.pedir(el)).rejects.toThrow('almacen.adjuntoNoEncontrado');
    expect(await cache.derivado(el.frontmatter.id, 'falso', 1, el.frontmatter.hash)).toBeUndefined();
    cache.cerrar();
  });

  it('sin lector para el elemento, rechaza', async () => {
    const cola = new ColaDerivados({ registro: crearRegistro([]), ejecutar: async () => 0 });
    await expect(cola.pedir(elementoFalso(1))).rejects.toThrow('lector.desconocido');
  });

  it('la plantilla es un lector válido para el registro', () => {
    expect(() => crearRegistro([lectorPlantilla])).not.toThrow();
  });
});

/** Worker falso que nunca contesta y puede emitir `error`, como uno cuyo módulo no carga. */
class WorkerMudo {
  static ultimo: WorkerMudo | null = null;
  readonly oyentes: ((e: unknown) => void)[] = [];
  terminate = vi.fn();
  constructor() {
    WorkerMudo.ultimo = this;
  }
  addEventListener(tipo: string, fn: (e: unknown) => void) {
    if (tipo === 'error') this.oyentes.push(fn);
  }
  removeEventListener() {}
  postMessage() {}
  start() {}
}

describe('ejecutor', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('si el Worker no carga, rechaza lo pendiente y deriva lo siguiente en el hilo principal', async () => {
    vi.stubGlobal('Worker', WorkerMudo);
    const registro = crearRegistro([lectorFalso()]);
    const ejecutor = crearEjecutor(registro);
    const pendiente = ejecutor.ejecutar('falso', elementoFalso(1));
    for (const fn of WorkerMudo.ultimo?.oyentes ?? []) fn({});
    await expect(pendiente).rejects.toThrow('derivados.workerNoCarga');
    expect(await ejecutor.ejecutar('falso', elementoFalso(2, 'abc'))).toEqual({ largo: 3 });
  });

  it('con el Worker averiado, la vista previa en el hilo usa las opciones de los ajustes', async () => {
    vi.stubGlobal('Worker', WorkerMudo);
    const ejecutor = crearEjecutor(crearRegistro([lectorFalso()]));
    const pendiente = ejecutor.ejecutar('falso', elementoFalso(1));
    for (const fn of WorkerMudo.ultimo?.oyentes ?? []) fn({});
    await expect(pendiente).rejects.toThrow('derivados.workerNoCarga');
    const token = `ghp_${'a'.repeat(36)}`;
    const opciones = { secretosDesactivados: ['github'], umbral: 0.6, margen: 0.15 };
    expect((await ejecutor.previsualizar(`token ${token}`, opciones)).secretos).toBe(0);
    expect((await ejecutor.previsualizar(`token ${token}`)).secretos).toBe(1);
  });

  it('reiniciar rechaza lo que esperaba del Worker y lo siguiente abre otro', async () => {
    vi.stubGlobal('Worker', WorkerMudo);
    const ejecutor = crearEjecutor(crearRegistro([lectorFalso()]));
    const colgada = ejecutor.ejecutar('falso', elementoFalso(1));
    const previa = ejecutor.previsualizar('texto');
    const primero = WorkerMudo.ultimo;
    ejecutor.reiniciar();
    await expect(colgada).rejects.toThrow('derivados.reiniciado');
    await expect(previa).rejects.toThrow('derivados.reiniciado');
    void ejecutor.ejecutar('falso', elementoFalso(2)).catch(() => undefined);
    expect(WorkerMudo.ultimo).not.toBe(primero);
    ejecutor.cerrar();
  });

  it('cerrado, termina el Worker y no abre otro', async () => {
    vi.stubGlobal('Worker', WorkerMudo);
    const ejecutor = crearEjecutor(crearRegistro([lectorFalso()]));
    const pendiente = ejecutor.ejecutar('falso', elementoFalso(1));
    const primero = WorkerMudo.ultimo;
    ejecutor.cerrar();
    // Lo que esperaba del Worker cerrado se rechaza (Comlink lo dejaría colgado).
    await expect(pendiente).rejects.toThrow('derivados.cerrado');
    expect(primero?.terminate).toHaveBeenCalled();
    await expect(ejecutor.ejecutar('falso', elementoFalso(2))).rejects.toThrow('derivados.cerrado');
    expect(WorkerMudo.ultimo).toBe(primero);
  });
});

describe('cargar el texto de un adjunto', () => {
  it('por su contenido: un .jsonl sin MIME de texto sí; un binario, no; si falta, lanza', async () => {
    const { AlmacenMemoria } = await import('../almacen/memoria');
    const { Repositorio } = await import('../almacen/repositorio');
    const { cargarTextoAdjunto } = await import('./adjuntos');
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    await almacen.escribir('adjuntos/aa/x.jsonl', new TextEncoder().encode('{"level":"info"}\n'));
    await almacen.escribir('adjuntos/bb/x.bin', new Uint8Array([0, 1, 2, 255]));
    const con = (ruta: string, mime: string) => ({
      ...elementoFalso(1),
      original: null,
      frontmatter: { ...elementoFalso(1).frontmatter, adjunto: { hash: 'a'.repeat(64), ruta, mime, tam: 1 } },
    });
    expect(await cargarTextoAdjunto(repo, con('adjuntos/aa/x.jsonl', 'application/x-ndjson'))).toBe(
      '{"level":"info"}\n',
    );
    expect(await cargarTextoAdjunto(repo, con('adjuntos/bb/x.bin', ''))).toBeNull();
    await expect(cargarTextoAdjunto(repo, con('adjuntos/cc/no.txt', 'text/plain'))).rejects.toThrow(
      'adjuntoNoEncontrado',
    );
  });
});
