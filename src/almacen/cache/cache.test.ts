// Las clases globales de IndexedDB (las usa idb); cada prueba usa además su propia fábrica, aislada.
import 'fake-indexeddb/auto';
import { type Elemento, escribirElemento, hashOriginal, rutaElemento } from '@rimor/formato';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { escribirTexto } from '../contrato';
import { AlmacenMemoria } from '../memoria';
import { Repositorio } from '../repositorio';
import { CacheEspacio, VERSION_CACHE } from './cache';
import { comprimir, descomprimir } from './comprimir';
import { reconciliar } from './reconciliar';

let n = 0;
const nuevaFabrica = () => new IDBFactory();

function elemento(i: number, titulo = `Elemento ${i}`): Elemento {
  const id = `01JAB4C2Q2X8M5N7P0R${String(i).padStart(7, '0')}`;
  return {
    frontmatter: {
      id,
      ref: `LOG-${String(i).padStart(4, '0')}`,
      tipo: 'log',
      titulo,
      creado: '2026-10-16T18:44:03+02:00',
      modificado: '2026-10-16T18:44:03+02:00',
      origen: 'pegado',
      hash: hashOriginal(`o${i}`),
      ocultados: 0,
      lector: { nombre: 'log', version: 1, resumen: {} },
    },
    notas: '',
    original: `o${i}`,
  };
}

async function espacio(cuantos: number) {
  let t = 1000;
  const almacen = new AlmacenMemoria(() => t++);
  for (let i = 1; i <= cuantos; i++)
    await escribirTexto(almacen, `elementos/2026/10/LOG-${i}.md`, escribirElemento(elemento(i)));
  return almacen;
}

describe('CacheEspacio y reconciliar', () => {
  it('reconstruye desde cero y, si nada cambia, no relee nada', async () => {
    const almacen = await espacio(30);
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    const progreso: number[] = [];
    const r1 = await reconciliar(almacen, cache, (p) => progreso.push(p.hechos));
    expect(r1).toMatchObject({ nuevos: 30, cambiados: 0, borrados: 0, total: 30, fallidos: [] });
    expect(progreso.at(-1)).toBe(30);
    const r2 = await reconciliar(almacen, cache);
    expect(r2).toMatchObject({ nuevos: 0, cambiados: 0, borrados: 0, total: 30 });
  });

  it('borrar IndexedDB y reconciliar da el mismo estado', async () => {
    const almacen = await espacio(10);
    const fabrica = nuevaFabrica();
    const a = await CacheEspacio.abrir('mismo', fabrica);
    await reconciliar(almacen, a);
    const antes = (await a.frontmatters()).sort((x, y) => x.id.localeCompare(y.id));
    a.cerrar();
    const otra = await CacheEspacio.abrir('mismo', nuevaFabrica());
    await reconciliar(almacen, otra);
    expect((await otra.frontmatters()).sort((x, y) => x.id.localeCompare(y.id))).toEqual(antes);
  });

  it('solo relee lo cambiado y lo nuevo, y borra lo que desaparece', async () => {
    const almacen = await espacio(5);
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    await reconciliar(almacen, cache);
    await cache.guardarDerivado(elemento(5).frontmatter.id, 'log', 1, 'h', { x: 1 });
    await escribirTexto(almacen, 'elementos/2026/10/LOG-1.md', escribirElemento(elemento(1, 'Cambiado')));
    await escribirTexto(almacen, 'elementos/2026/10/LOG-6.md', escribirElemento(elemento(6)));
    await almacen.borrar('elementos/2026/10/LOG-5.md');
    const r = await reconciliar(almacen, cache);
    expect(r).toMatchObject({ nuevos: 1, cambiados: 1, borrados: 1, total: 5 });
    const titulos = (await cache.frontmatters()).map((e) => e.frontmatter.titulo).sort();
    expect(titulos).toContain('Cambiado');
    expect(await cache.derivado(elemento(5).frontmatter.id, 'log', 1, 'h')).toBeUndefined();
  });

  it('un renombrado conserva el elemento (mismo id, otra ruta)', async () => {
    const almacen = await espacio(2);
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    await reconciliar(almacen, cache);
    await almacen.mover('elementos/2026/10/LOG-1.md', 'elementos/2026/10/LOG-1--otro.md');
    const r = await reconciliar(almacen, cache);
    expect(r.borrados).toBe(0);
    expect((await cache.frontmatters()).find((e) => e.ref === 'LOG-0001')?.ruta).toBe(
      'elementos/2026/10/LOG-1--otro.md',
    );
  });

  it('los derivados caducan con la versión del lector o el hash, y guardar uno nuevo borra el viejo', async () => {
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    await cache.guardarDerivado('A', 'log', 1, 'h1', { v: 1 });
    expect(await cache.derivado('A', 'log', 1, 'h1')).toEqual({ v: 1 });
    expect(await cache.derivado('A', 'log', 2, 'h1')).toBeUndefined();
    expect(await cache.derivado('A', 'log', 1, 'h2')).toBeUndefined();
    await cache.guardarDerivado('A', 'otro', 1, 'h1', { o: 1 });
    await cache.guardarDerivado('A', 'log', 2, 'h1', { v: 2 });
    expect(await cache.derivado('A', 'log', 1, 'h1')).toBeUndefined();
    expect(await cache.derivado('A', 'log', 2, 'h1')).toEqual({ v: 2 });
    // Subir la versión de un lector solo afecta a sus derivados.
    expect(await cache.derivado('A', 'otro', 1, 'h1')).toEqual({ o: 1 });
  });

  it('una versión de caché distinta la vacía', async () => {
    const fabrica = nuevaFabrica();
    const a = await CacheEspacio.abrir('v', fabrica);
    await a.guardarIndice(new Uint8Array([1, 2, 3]));
    a.cerrar();
    // Se simula una caché escrita por otra versión.
    const db = await new Promise<IDBDatabase>((ok) => {
      const r = fabrica.open('rimor-cache-v', 1);
      r.onsuccess = () => ok(r.result);
    });
    await new Promise((ok) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put(VERSION_CACHE + 1, 'version');
      tx.oncomplete = ok;
    });
    db.close();
    const b = await CacheEspacio.abrir('v', fabrica);
    expect(await b.indice()).toBeUndefined();
  });

  it('el índice comprimido vuelve idéntico', async () => {
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    const indice = new TextEncoder().encode(
      JSON.stringify({ terminos: Array.from({ length: 2000 }, (_, i) => `t${i}`) }),
    );
    await cache.guardarIndice(await comprimir(indice));
    const leido = await cache.indice();
    expect(leido && (await descomprimir(leido))).toEqual(indice);
  });

  it('dos archivos con el mismo id: gana siempre el que está en su sitio y el otro se avisa', async () => {
    const almacen = await espacio(1);
    const texto = escribirElemento(elemento(1));
    const enSuSitio = rutaElemento('LOG-0001', 'Elemento 1', '2026-10-16T18:44:03+02:00');
    await almacen.borrar('elementos/2026/10/LOG-1.md');
    await escribirTexto(almacen, enSuSitio, texto);
    await escribirTexto(almacen, 'elementos/2026/10/zz-copia.md', texto);
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    for (let pasada = 0; pasada < 3; pasada++) {
      const r = await reconciliar(almacen, cache);
      expect(r.total).toBe(1);
      expect(r.nuevos).toBe(pasada === 0 ? 1 : 0);
      expect(r.fallidos).toEqual([{ ruta: 'elementos/2026/10/zz-copia.md', codigo: 'almacen.duplicado' }]);
      expect(r.entradas[0]?.ruta).toBe(enSuSitio);
    }
  });

  it('termina antes la operación del diario que se cortó', async () => {
    const almacen = await espacio(1);
    await escribirTexto(almacen, 'elementos/2026/10/LOG-1--nuevo.md', escribirElemento(elemento(1)));
    await escribirTexto(
      almacen,
      '.rimor/operacion.json',
      JSON.stringify({ de: 'elementos/2026/10/LOG-1.md', a: 'elementos/2026/10/LOG-1--nuevo.md' }),
    );
    const r = await reconciliar(almacen, await CacheEspacio.abrir(`e${n++}`, nuevaFabrica()));
    expect(r.fallidos).toEqual([]);
    expect(r.entradas.map((e) => e.ruta)).toEqual(['elementos/2026/10/LOG-1--nuevo.md']);
  });

  it('el repositorio con caché la actualiza al guardar, mover a la papelera y vaciarla', async () => {
    const almacen = await espacio(0);
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    const repo = new Repositorio(almacen, cache);
    const ruta = await repo.guardarElemento(elemento(7));
    expect((await cache.frontmatters()).map((e) => e.ruta)).toEqual([ruta]);
    await repo.moverAPapelera('LOG-0007');
    expect((await cache.frontmatters()).map((e) => e.ruta)).toEqual([`papelera/${ruta}`]);
    // La reconciliación ve la caché al día: no relee nada.
    expect(await reconciliar(almacen, cache)).toMatchObject({ nuevos: 0, cambiados: 0, total: 1 });
    await repo.vaciarPapelera();
    expect(await cache.frontmatters()).toEqual([]);
  });

  it('cambiar el original poda todos los derivados hechos sobre el original viejo', async () => {
    const cache = await CacheEspacio.abrir(`e${n++}`, nuevaFabrica());
    await cache.guardarDerivado('X', 'log', 1, 'h1', { log: 1 });
    await cache.guardarDerivado('X', 'otro', 1, 'h1', { otro: 1 });
    expect(await cache.derivado('X', 'log', 1, 'h1')).toEqual({ log: 1 });
    await cache.podarDerivados('X', 'h2');
    expect(await cache.derivado('X', 'otro', 1, 'h1')).toBeUndefined();
  });

  it('10.000 elementos: abrir con caché caliente (abrir, reconciliar y llenar el repositorio) en menos de 2 s', async () => {
    const almacen = await espacio(10_000);
    const fabrica = nuevaFabrica();
    const primera = await CacheEspacio.abrir('grande', fabrica);
    await reconciliar(almacen, primera);
    primera.cerrar();
    const t0 = performance.now();
    const cache = await CacheEspacio.abrir('grande', fabrica);
    const r = await reconciliar(almacen, cache);
    new Repositorio(almacen, cache).cargarDesde(r.entradas);
    const ms = performance.now() - t0;
    expect(r.total).toBe(10_000);
    expect(r.nuevos + r.cambiados).toBe(0);
    expect(ms).toBeLessThan(2000);
  }, 120_000);
});
