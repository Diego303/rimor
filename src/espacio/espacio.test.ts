import 'fake-indexeddb/auto';
import { type Elemento, esUlid, hashOriginal, leerManifest } from '@rimor/formato';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';
import { escribirTexto, leerTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import type { Canal, Cerrojos } from '../almacen/pestanas';
import { RUTA_DIARIO } from '../almacen/repositorio';
import { RUTA_REGLAS } from '../captura/reglas';
import { abrirEspacio } from './abrir';
import { conCopia, conPersistencia, ESTADO_INICIAL, leerEstado, RUTA_ESTADO } from './estado';
import { crearManifest, RUTA_MANIFEST } from './manifest';
import {
  CUOTA_VENTANA_PRIVADA,
  espacioUsado,
  esVentanaPrivada,
  pedirPersistencia,
  umbralVentanaPrivada,
} from './persistencia';
import { copiaAlDia, resumenParaCarcasa, sinClasificar } from './resumen';

function cerrojosFalsos(): Cerrojos {
  let ocupado = false;
  const espera: (() => void)[] = [];
  return {
    async request(_n, opciones, fn) {
      if (ocupado && opciones.ifAvailable) return fn(null);
      while (ocupado) await new Promise<void>((r) => espera.push(r));
      ocupado = true;
      try {
        return await fn({});
      } finally {
        ocupado = false;
        espera.shift()?.();
      }
    },
  };
}
const canal = (): Canal => ({
  postMessage: () => undefined,
  addEventListener: () => undefined,
  close: () => undefined,
});

function elemento(i: number, cambios: Partial<Elemento['frontmatter']> = {}): Elemento {
  return {
    frontmatter: {
      id: `01JAB4C2Q2X8M5N7P0R${String(i).padStart(7, '0')}`,
      ref: `LOG-${String(i).padStart(4, '0')}`,
      tipo: 'log',
      titulo: `Log ${i}`,
      creado: '2026-10-16T18:44:03+02:00',
      modificado: '2026-10-16T18:44:03+02:00',
      origen: 'pegado',
      hash: hashOriginal(`o${i}`),
      ocultados: 0,
      lector: { nombre: 'log', version: 1, resumen: {} },
      ...cambios,
    },
    notas: '',
    original: `o${i}`,
  };
}

describe('abrirEspacio', () => {
  it('crea el espacio la primera vez y lo reabre sin recrearlo', async () => {
    const almacen = new AlmacenMemoria();
    const fabrica = new IDBFactory();
    const fases: string[] = [];
    const r = await abrirEspacio(
      { espacioId: 'e1', almacen, fabricaIndexedDb: fabrica, cerrojos: cerrojosFalsos(), canal: canal() },
      (f) => fases.push(f.fase),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const manifest = leerManifest((await leerTexto(almacen, RUTA_MANIFEST)) ?? '');
    expect(manifest).toMatchObject({ formato: 'rimor', esquema: 1, espacio: { nombre: 'Trabajo' } });
    expect(esUlid(manifest?.espacio.id ?? '')).toBe(true);
    expect(fases[0]).toBe('abriendo');
    await r.valor.repositorio.guardarElemento(elemento(1));
    // Las entidades (comparaciones) también se guardan y cuentan como cambio.
    const cambiosAntes = r.valor.estado().cambiosDesdeCopia;
    await r.valor.entidades.guardar({
      frontmatter: {
        id: '01JAB4C2Q2X8M5N7P0R4S6T8V9',
        ref: 'CMP-0001',
        tipo: 'comparacion',
        titulo: 'a frente a b',
        creado: '2026-10-16T18:21:00+02:00',
        clase: 'logs',
        fuentes: ['LOG-0001', 'LOG-0002'],
        resultado: {},
      },
      cuerpo: '',
    });
    expect(r.valor.estado().cambiosDesdeCopia).toBe(cambiosAntes + 1);
    r.valor.cerrar();

    const otra = await abrirEspacio({
      espacioId: 'e1',
      almacen,
      fabricaIndexedDb: fabrica,
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    expect(otra.ok && otra.valor.manifest.espacio.id).toBe(manifest?.espacio.id);
    expect(otra.ok && otra.valor.manifest.creado).toBe(manifest?.creado);
    expect(otra.ok && otra.valor.repositorio.buscar('LOG-0001')).toBeTruthy();
    expect(otra.ok && otra.valor.entidades.frontmatter('CMP-0001')?.titulo).toBe('a frente a b');
    if (otra.ok) otra.valor.cerrar();
  });

  it('cada cambio del repositorio suma uno a los cambios desde la última copia y se guarda', async () => {
    const almacen = new AlmacenMemoria();
    const r = await abrirEspacio({
      espacioId: 'e2',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    if (!r.ok) throw new Error(r.error.codigo);
    const vistos: number[] = [];
    r.valor.alCambiar((e) => vistos.push(e.cambiosDesdeCopia));
    await r.valor.repositorio.guardarElemento(elemento(1));
    await r.valor.repositorio.guardarElemento(elemento(2));
    await r.valor.guardarEstado((e) => e);
    expect(vistos).toEqual([1, 2, 2]);
    expect(leerEstado(await leerTexto(almacen, RUTA_ESTADO)).cambiosDesdeCopia).toBe(2);
    r.valor.cerrar();
  });

  it('una segunda pestaña queda en solo lectura y no crea ni escribe nada', async () => {
    const almacen = new AlmacenMemoria();
    const cerrojos = cerrojosFalsos();
    const a = await abrirEspacio({
      espacioId: 'e3',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: canal(),
    });
    const vacio = new AlmacenMemoria();
    const b = await abrirEspacio({
      espacioId: 'e3',
      almacen: vacio,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos,
      canal: canal(),
    });
    expect(a.ok && a.valor.coordinacion.modo()).toBe('escritor');
    expect(b.ok && b.valor.coordinacion.modo()).toBe('lector');
    expect(await leerTexto(vacio, RUTA_MANIFEST)).toBeNull();
    if (a.ok) a.valor.cerrar();
    if (b.ok) b.valor.cerrar();
  });

  it('un manifest ilegible no se sobrescribe', async () => {
    const almacen = new AlmacenMemoria();
    await escribirTexto(almacen, RUTA_MANIFEST, '{ roto');
    const r = await abrirEspacio({
      espacioId: 'e4',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    expect(r.ok).toBe(false);
    expect(await leerTexto(almacen, RUTA_MANIFEST)).toBe('{ roto');
  });

  it('al crear el espacio escribe también el estado inicial', async () => {
    const almacen = new AlmacenMemoria();
    const r = await abrirEspacio({
      espacioId: 'e6',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    expect(leerEstado(await leerTexto(almacen, RUTA_ESTADO))).toEqual(ESTADO_INICIAL);
    if (r.ok) await r.valor.cerrar();
  });

  it('un manifest de un esquema más nuevo no se abre ni se toca', async () => {
    const almacen = new AlmacenMemoria();
    const texto = JSON.stringify({ ...crearManifest('Trabajo', new Date()), esquema: 99 });
    await escribirTexto(almacen, RUTA_MANIFEST, texto);
    const r = await abrirEspacio({
      espacioId: 'e7',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    expect(!r.ok && r.error.codigo).toBe('espacio.esquemaNuevo');
    expect(await leerTexto(almacen, RUTA_MANIFEST)).toBe(texto);
  });

  it('una pestaña lectora no termina el diario de la otra ni puede escribir', async () => {
    const almacen = new AlmacenMemoria();
    const cerrojos = cerrojosFalsos();
    const fabrica = new IDBFactory();
    const a = await abrirEspacio({ espacioId: 'e8', almacen, fabricaIndexedDb: fabrica, cerrojos, canal: canal() });
    if (!a.ok) throw new Error('no abre');
    await escribirTexto(almacen, 'elementos/x.md', 'x');
    await escribirTexto(almacen, 'elementos/y.md', 'y');
    await escribirTexto(almacen, RUTA_DIARIO, JSON.stringify({ de: 'elementos/x.md', a: 'elementos/y.md' }));
    const b = await abrirEspacio({ espacioId: 'e8', almacen, fabricaIndexedDb: fabrica, cerrojos, canal: canal() });
    if (!b.ok) throw new Error('no abre');
    expect(b.valor.coordinacion.modo()).toBe('lector');
    expect(await leerTexto(almacen, 'elementos/x.md')).toBe('x');
    expect(await leerTexto(almacen, RUTA_DIARIO)).not.toBeNull();
    await expect(b.valor.repositorio.guardarElemento(elemento(1))).rejects.toThrow('almacen.soloLectura');
    await a.valor.cerrar();
    await b.valor.cerrar();
  });

  it('al pasar a escribir, la lectora relee estado y elementos antes de escribir', async () => {
    const almacen = new AlmacenMemoria();
    const cerrojos = cerrojosFalsos();
    const fabrica = new IDBFactory();
    const a = await abrirEspacio({ espacioId: 'e9', almacen, fabricaIndexedDb: fabrica, cerrojos, canal: canal() });
    const b = await abrirEspacio({ espacioId: 'e9', almacen, fabricaIndexedDb: fabrica, cerrojos, canal: canal() });
    if (!a.ok || !b.ok) throw new Error('no abre');
    await a.valor.guardarEstado((e) => conPersistencia(e, 'concedida', '2026-10-18T10:00:00+02:00'));
    for (let i = 1; i <= 3; i++) await a.valor.repositorio.guardarElemento(elemento(i));
    expect(b.valor.repositorio.elementos()).toHaveLength(0);
    await a.valor.cerrar();
    await vi.waitFor(() => expect(b.valor.repositorio.elementos()).toHaveLength(3));
    expect(b.valor.coordinacion.modo()).toBe('escritor');
    await b.valor.repositorio.guardarElemento(elemento(4));
    await b.valor.guardarEstado((e) => e);
    expect(leerEstado(await leerTexto(almacen, RUTA_ESTADO))).toMatchObject({
      persistencia: 'concedida',
      cambiosDesdeCopia: 4,
    });
    await b.valor.cerrar();
  });

  it('una lectora relee lo que cambia la otra pestaña', async () => {
    const almacen = new AlmacenMemoria();
    const cerrojos = cerrojosFalsos();
    const fabrica = new IDBFactory();
    // Un canal compartido en memoria, como BroadcastChannel entre pestañas.
    const oyentes = new Set<(e: { data: unknown }) => void>();
    const canalCompartido = (): Canal => {
      let propio: ((e: { data: unknown }) => void) | null = null;
      return {
        postMessage: (data) => {
          for (const fn of oyentes) if (fn !== propio) fn({ data });
        },
        addEventListener: (_t, fn) => {
          propio = fn;
          oyentes.add(fn);
        },
        close: () => {
          if (propio) oyentes.delete(propio);
        },
      };
    };
    const a = await abrirEspacio({
      espacioId: 'e10',
      almacen,
      fabricaIndexedDb: fabrica,
      cerrojos,
      canal: canalCompartido(),
    });
    const b = await abrirEspacio({
      espacioId: 'e10',
      almacen,
      fabricaIndexedDb: fabrica,
      cerrojos,
      canal: canalCompartido(),
    });
    if (!a.ok || !b.ok) throw new Error('no abre');
    await a.valor.repositorio.guardarElemento(elemento(1));
    await vi.waitFor(() => expect(b.valor.repositorio.buscar('LOG-0001')).toBeTruthy());
    await a.valor.cerrar();
    await b.valor.cerrar();
  });

  it('si la caché no se deja abrir, la rehace', async () => {
    const fabrica = new IDBFactory();
    const abrir = fabrica.open.bind(fabrica);
    let fallos = 1;
    fabrica.open = (...args: Parameters<IDBFactory['open']>) => {
      if (fallos-- > 0) throw new Error('rota');
      return abrir(...args);
    };
    const r = await abrirEspacio({
      espacioId: 'e11',
      almacen: new AlmacenMemoria(),
      fabricaIndexedDb: fabrica,
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    expect(r.ok).toBe(true);
    if (r.ok) await r.valor.cerrar();
  });

  it('avisa del progreso al indexar', async () => {
    const almacen = new AlmacenMemoria();
    const primera = await abrirEspacio({
      espacioId: 'e5',
      almacen,
      fabricaIndexedDb: new IDBFactory(),
      cerrojos: cerrojosFalsos(),
      canal: canal(),
    });
    if (!primera.ok) throw new Error('no abre');
    for (let i = 1; i <= 3; i++) await primera.valor.repositorio.guardarElemento(elemento(i));
    primera.valor.cerrar();
    const fases: string[] = [];
    await abrirEspacio(
      { espacioId: 'e5', almacen, fabricaIndexedDb: new IDBFactory(), cerrojos: cerrojosFalsos(), canal: canal() },
      (f) => fases.push(f.fase === 'indexando' ? `${f.hechos}/${f.total}` : f.fase),
    );
    expect(fases).toContain('3/3');
  });
});

describe('estado de cuidado', () => {
  it('lee con valores por defecto, cuenta cambios y registra copias y persistencia', () => {
    expect(leerEstado(null)).toEqual(ESTADO_INICIAL);
    expect(leerEstado('{"persistencia":"rara","cambiosDesdeCopia":-3}')).toEqual(ESTADO_INICIAL);
    const e = conPersistencia(
      conCopia({ ...ESTADO_INICIAL, cambiosDesdeCopia: 9 }, '2026-10-18T10:00:00+02:00'),
      'concedida',
      'x',
    );
    expect(e).toMatchObject({
      cambiosDesdeCopia: 0,
      ultimaCopia: '2026-10-18T10:00:00+02:00',
      persistencia: 'concedida',
    });
  });

  it('la copia está al día con menos de 50 cambios y 7 días', () => {
    const ahora = new Date('2026-10-18T12:00:00+02:00');
    const e = { ...ESTADO_INICIAL, ultimaCopia: '2026-10-15T12:00:00+02:00' };
    expect(copiaAlDia(e, ahora)).toBe(true);
    expect(copiaAlDia({ ...e, cambiosDesdeCopia: 50 }, ahora)).toBe(false);
    expect(copiaAlDia({ ...e, ultimaCopia: '2026-10-10T12:00:00+02:00' }, ahora)).toBe(false);
    expect(copiaAlDia(ESTADO_INICIAL, ahora)).toBe(false);
  });
});

describe('resumen para la carcasa', () => {
  it('cuenta lo sin clasificar y las colecciones', () => {
    const fms = [
      elemento(1).frontmatter,
      elemento(2, { colecciones: ['gateway'] }).frontmatter,
      elemento(3, { colecciones: ['gateway', 'lecturas'] }).frontmatter,
      elemento(4, { estado: 'archivado' }).frontmatter,
      elemento(5, { hilo: 'HIL-0001' }).frontmatter,
    ];
    expect(fms.filter(sinClasificar).map((f) => f.ref)).toEqual(['LOG-0001']);
    const manifest = {
      formato: 'rimor' as const,
      esquema: 1,
      espacio: { id: 'x', nombre: 'Trabajo' },
      app: { version: '0' },
    };
    const r = resumenParaCarcasa(manifest, fms, ESTADO_INICIAL);
    expect(r).toMatchObject({ nombre: 'Trabajo', sinClasificar: 1, copiaAlDia: false });
    expect(r.colecciones).toEqual([
      { id: 'gateway', nombre: 'gateway', recuento: 2 },
      { id: 'lecturas', nombre: 'lecturas', recuento: 1 },
    ]);
  });
});

describe('persistencia', () => {
  it('concedida, denegada o no disponible', async () => {
    expect(await pedirPersistencia({ persist: async () => true })).toBe('concedida');
    expect(await pedirPersistencia({ persist: async () => false })).toBe('denegada');
    expect(await pedirPersistencia({})).toBe('no-disponible');
    expect(await pedirPersistencia(undefined)).toBe('no-disponible');
  });

  it('espacio usado y ventana privada', async () => {
    expect(await espacioUsado({ estimate: async () => ({ usage: 10, quota: 100 }) })).toEqual({
      usado: 10,
      cuota: 100,
    });
    expect(await espacioUsado({})).toBeNull();
    const grande = { getDirectory: async () => ({}), estimate: async () => ({ usage: 0, quota: 50e9 }) };
    expect(umbralVentanaPrivada(undefined)).toBe(CUOTA_VENTANA_PRIVADA);
    expect(umbralVentanaPrivada(4 * 1024 ** 3)).toBe(8 * 1024 ** 3);
    expect(await esVentanaPrivada(grande)).toBe(false);
    expect(
      await esVentanaPrivada({ ...grande, estimate: async () => ({ usage: 0, quota: CUOTA_VENTANA_PRIVADA - 1 }) }),
    ).toBe(true);
    expect(
      await esVentanaPrivada({
        getDirectory: async () => {
          throw new Error('SecurityError');
        },
      }),
    ).toBe(true);
  });
});

describe('reglas de detección del espacio (IN-049)', () => {
  const abrir = (almacen: AlmacenMemoria, espacioId: string, cerrojos = cerrojosFalsos(), fabrica = new IDBFactory()) =>
    abrirEspacio({ espacioId, almacen, fabricaIndexedDb: fabrica, cerrojos, canal: canal() });
  const regla = { prefijo: '[app]', tipo: 'log' as const, creada: '2026-10-31T18:00:00+01:00' };

  it('se guardan en .rimor/reglas-deteccion.json y se leen al volver a abrir', async () => {
    const almacen = new AlmacenMemoria();
    const a = await abrir(almacen, 'r1');
    if (!a.ok) throw new Error('no abre');
    expect(a.valor.reglas().reglas).toEqual([]);
    await a.valor.guardarReglas((d) => ({ ...d, reglas: [regla] }));
    expect(a.valor.reglas().reglas).toEqual([regla]);
    expect(JSON.parse((await leerTexto(almacen, RUTA_REGLAS)) ?? '{}').reglas).toEqual([regla]);
    await a.valor.cerrar();
    const b = await abrir(almacen, 'r1');
    if (!b.ok) throw new Error('no abre');
    expect(b.valor.reglas().reglas).toEqual([regla]);
    await b.valor.cerrar();
  });

  it('una pestaña que solo lee no las escribe; un archivo que no se entiende no se sobrescribe', async () => {
    const almacen = new AlmacenMemoria();
    const cerrojos = cerrojosFalsos();
    const fabrica = new IDBFactory();
    const a = await abrir(almacen, 'r2', cerrojos, fabrica);
    const b = await abrir(almacen, 'r2', cerrojos, fabrica);
    if (!a.ok || !b.ok) throw new Error('no abre');
    await b.valor.guardarReglas((d) => ({ ...d, reglas: [regla] }));
    expect(await leerTexto(almacen, RUTA_REGLAS)).toBeNull();
    await a.valor.cerrar();
    await b.valor.cerrar();

    const roto = new AlmacenMemoria();
    await escribirTexto(roto, RUTA_REGLAS, '{roto');
    const c = await abrir(roto, 'r3');
    if (!c.ok) throw new Error('no abre');
    expect(c.valor.reglas().reglas).toEqual([]);
    await expect(c.valor.guardarReglas((d) => ({ ...d, reglas: [regla] }))).rejects.toThrow();
    expect(await leerTexto(roto, RUTA_REGLAS)).toBe('{roto');
    await c.valor.cerrar();
  });
});
