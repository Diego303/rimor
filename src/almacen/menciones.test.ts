import 'fake-indexeddb/auto';
import { type Elemento, escribirElemento, hashOriginal } from '@rimor/formato';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CacheEspacio } from './cache/cache';
import { reconciliar } from './cache/reconciliar';
import { escribirTexto } from './contrato';
import { AlmacenMemoria } from './memoria';
import { MAX_TERMINOS, paqueteDe, reescribirRefs, refsEn, terminosDe } from './menciones';
import { Repositorio } from './repositorio';

function el(i: number, cambios: Partial<Elemento['frontmatter']> = {}, notas = '', original = `texto ${i}`): Elemento {
  return {
    frontmatter: {
      id: `01JAB4C2Q2X8M5N7P0R${String(i).padStart(7, '0')}`,
      ref: `TXT-${String(i).padStart(4, '0')}`,
      tipo: 'texto',
      titulo: `Elemento ${i}`,
      creado: `2026-10-1${i % 10}T10:00:00+02:00`,
      modificado: `2026-10-1${i % 10}T10:00:00+02:00`,
      origen: 'pegado',
      hash: hashOriginal(original),
      ocultados: 0,
      lector: { nombre: 'texto', version: 1, resumen: {} },
      ...cambios,
    } as Elemento['frontmatter'],
    notas,
    original,
  };
}

describe('lo que menciona un elemento', () => {
  it('las refs de sus notas y su original (sin la suya ni sus alias) y los paquetes de sus enlaces', () => {
    const e = el(
      1,
      { alias: ['IDE-0007'] as never },
      'Mira LOG-0042 y TXT-0001, y IDE-0007.',
      'Con ERR-0003 y https://crates.io/crates/ureq. Y DOC-MD-0004, y LOG-0042 otra vez; no XX-1234 ni LOG-42.',
    );
    expect(terminosDe(e)).toEqual(['LOG-0042', 'ERR-0003', 'DOC-MD-0004', 'paquete:crates.io/ureq']);
    expect(refsEn('LOG-0042, LOG-00421 y AB-1234')).toEqual(['LOG-0042', 'LOG-00421']);
    expect(paqueteDe('https://www.npmjs.com/package/react')).toBe('npm/react');
    expect(paqueteDe('https://example.com/x')).toBeUndefined();
    const muchas = el(2, {}, '', Array.from({ length: MAX_TERMINOS + 50 }, (_, i) => `LOG-${1000 + i}`).join(' '));
    expect(terminosDe(muchas)).toHaveLength(MAX_TERMINOS);
  });

  it('reescribir refs: palabras enteras, de una pasada', () => {
    expect(reescribirRefs('TXT-0001, XTXT-0001, TXT-00011', new Map([['TXT-0001', 'IDE-0001']]))).toBe(
      'IDE-0001, XTXT-0001, TXT-00011',
    );
  });
});

describe('el índice inverso del repositorio', () => {
  it('quién menciona a quién, al día al guardar, sin la papelera; también por alias y por paquete', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    const paquete = el(5, {
      tipo: 'enlace',
      ref: 'URL-0005' as never,
      lector: { nombre: 'enlace', version: 1, resumen: { url: 'https://crates.io/crates/ureq' } },
    });
    await repo.guardarElemento(el(1, { alias: ['IDE-0009'] as never }));
    await repo.guardarElemento(el(2, {}, 'Ver TXT-0001.'));
    await repo.guardarElemento(el(3, {}, '', 'Como en IDE-0009 y https://crates.io/crates/ureq'));
    await repo.guardarElemento(paquete);
    expect(repo.mencionadoPor('TXT-0001').map((f) => f.ref)).toEqual(['TXT-0003', 'TXT-0002']);
    expect(repo.mencionadoPor('URL-0005').map((f) => f.ref)).toEqual(['TXT-0003']);
    // Deja de mencionarlo: fuera.
    await repo.actualizarElemento('TXT-0002', (e) => ({ ...e, notas: 'Nada.' }));
    expect(repo.mencionadoPor('TXT-0001').map((f) => f.ref)).toEqual(['TXT-0003']);
    // A la papelera: fuera; y de vuelta, dentro.
    await repo.moverAPapelera('TXT-0003');
    expect(repo.mencionadoPor('TXT-0001')).toEqual([]);
    expect(repo.mencionanRef('IDE-0009')).toEqual([el(3).frontmatter.id]);
  });

  it('se rehace desde la caché (sin abrir los archivos), con las menciones de cada uno', async () => {
    const almacen = new AlmacenMemoria();
    await escribirTexto(almacen, 'elementos/2026/10/TXT-0001--uno.md', escribirElemento(el(1)));
    await escribirTexto(almacen, 'elementos/2026/10/TXT-0002--dos.md', escribirElemento(el(2, {}, 'Ver TXT-0001.')));
    const cache = await CacheEspacio.abrir('menciones', new IDBFactory());
    const r = await reconciliar(almacen, cache);
    expect(r.entradas.find((e) => e.ref === 'TXT-0002')?.menciones).toEqual(['TXT-0001']);
    const repo = new Repositorio(almacen);
    repo.cargarDesde(await cache.frontmatters());
    expect(repo.mencionadoPor('TXT-0001').map((f) => f.ref)).toEqual(['TXT-0002']);
    cache.cerrar();
  });
});
