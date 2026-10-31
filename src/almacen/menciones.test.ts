import 'fake-indexeddb/auto';
import { type Elemento, escribirElemento, hashOriginal } from '@rimor/formato';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { CacheEspacio } from './cache/cache';
import { reconciliar } from './cache/reconciliar';
import { escribirTexto } from './contrato';
import { AlmacenMemoria } from './memoria';
import { MAX_REFS, paqueteDe, reescribirRefs, refsEn, terminosDe } from './menciones';
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
  it('las refs de sus notas y de su original de prosa (sin las suyas), los paquetes de sus enlaces y las huellas', () => {
    const e = el(
      1,
      { alias: ['IDE-0007'] as never },
      'Mira LOG-0042 y TXT-0001, y IDE-0007. Huella 3f9a0c1d2e3b4a59.',
      'Con ERR-0003 y https://crates.io/crates/ureq. Y DOC-MD-0004, y LOG-0042 otra vez; no XX-1234 ni LOG-42.',
    );
    expect(terminosDe(e)).toEqual([
      'LOG-0042',
      'ERR-0003',
      'DOC-MD-0004',
      'paquete:crates.io/ureq',
      'huella:3f9a0c1d2e3b4a59',
    ]);
  });

  it('no cuenta lo de dentro de URLs o de código, las refs de entidades ni el original de un log', () => {
    const notas =
      'Ver https://x.org/pages/TXT-0003.html, `grep TXT-0004 build.log`,\n```\nTXT-0005\n```\nHIL-0001, INV-0002 y TXT-0006.';
    expect(terminosDe(el(1, {}, notas))).toEqual(['TXT-0006']);
    const log = el(2, { tipo: 'log', ref: 'LOG-0002' as never }, '', 'ERR-1001: connection refused');
    expect(terminosDe(log)).toEqual([]);
    // Fronteras: ni pegadas a letras, cifras, guiones o subrayados.
    expect(refsEn('TXT-0001-bis, X-TXT-0001, ÁTXT-0001, TXT-0001_v2 y (TXT-0002).')).toEqual(['TXT-0002']);
    expect(paqueteDe('https://www.npmjs.com/package/react')).toBe('npm/react');
    expect(paqueteDe('https://example.com/x')).toBeUndefined();
  });

  it('como mucho 150 refs, y aparte los paquetes (no se quedan fuera por muchas refs)', () => {
    const refs = Array.from({ length: MAX_REFS + 50 }, (_, i) => `LOG-${1000 + i}`).join(' ');
    const t = terminosDe(el(2, {}, '', `${refs} https://crates.io/crates/ureq`));
    expect(t.filter((x) => !x.startsWith('paquete:'))).toHaveLength(MAX_REFS);
    expect(t).toContain('paquete:crates.io/ureq');
  });

  it('reescribir refs: palabras enteras, de una pasada; con «soloCorriente», no en URLs ni en código', () => {
    const cambios = new Map([['TXT-0001', 'IDE-0001']]);
    expect(reescribirRefs('TXT-0001, XTXT-0001, TXT-00011, TXT-0001_v2', cambios)).toBe(
      'IDE-0001, XTXT-0001, TXT-00011, TXT-0001_v2',
    );
    expect(
      reescribirRefs('Ver TXT-0001 en https://x.org/TXT-0001.html y `grep TXT-0001`.', cambios, {
        soloCorriente: true,
      }),
    ).toBe('Ver IDE-0001 en https://x.org/TXT-0001.html y `grep TXT-0001`.');
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
    // Un enlace no se menciona a sí mismo por su paquete (su original no se mira: no es prosa).
    expect(repo.mencionadoPor('TXT-0003').map((f) => f.ref)).toEqual([]);
    // Deja de mencionarlo: fuera.
    await repo.actualizarElemento('TXT-0002', (e) => ({ ...e, notas: 'Nada.' }));
    expect(repo.mencionadoPor('TXT-0001').map((f) => f.ref)).toEqual(['TXT-0003']);
    // A la papelera: fuera; y de vuelta, dentro.
    await repo.moverAPapelera('TXT-0003');
    expect(repo.mencionadoPor('TXT-0001')).toEqual([]);
    await repo.restaurar('TXT-0003');
    expect(repo.mencionadoPor('TXT-0001').map((f) => f.ref)).toEqual(['TXT-0003']);
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

  it('un alias que ya es la ref de otro (tras importar) no se lleva sus menciones; las huellas de un error, sí', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    await repo.guardarElemento(el(5));
    await repo.guardarElemento(el(9, { alias: ['TXT-0005'] as never }));
    await repo.guardarElemento(el(3, {}, 'Ver TXT-0005.'));
    expect(repo.buscar('TXT-0005')?.id).toBe(el(5).frontmatter.id);
    expect(repo.mencionadoPor('TXT-0005').map((f) => f.ref)).toEqual(['TXT-0003']);
    expect(repo.mencionadoPor('TXT-0009')).toEqual([]);
    const error = el(7, {
      tipo: 'error',
      ref: 'ERR-0007' as never,
      lector: { nombre: 'error', version: 1, resumen: { huella: '3f9a0c1d2e3b4a59' } },
    });
    await repo.guardarElemento(error);
    await repo.guardarElemento(el(8, {}, 'Lo mismo que 3f9a0c1d2e3b4a59, otra vez.'));
    expect(repo.mencionadoPor('ERR-0007').map((f) => f.ref)).toEqual(['TXT-0008']);
  });

  it('al guardar, la caché lleva sus menciones; una entrada sin ellas (de antes) se vuelve a leer', async () => {
    const almacen = new AlmacenMemoria();
    const cache = await CacheEspacio.abrir('menciones-2', new IDBFactory());
    const repo = new Repositorio(almacen, cache);
    await repo.guardarElemento(el(1));
    await repo.guardarElemento(el(2, {}, 'Ver TXT-0001.'));
    const guardadas = await cache.frontmatters();
    expect(guardadas.find((e) => e.ref === 'TXT-0002')?.menciones).toEqual(['TXT-0001']);
    expect(guardadas.find((e) => e.ref === 'TXT-0001')?.menciones).toEqual([]);
    // Sin `menciones` (una pestaña con el código de antes): al reconciliar se relee.
    await cache.guardarFrontmatters(guardadas.map(({ menciones: _, ...resto }) => resto));
    const r = await reconciliar(almacen, cache);
    expect(r.entradas.find((e) => e.ref === 'TXT-0002')?.menciones).toEqual(['TXT-0001']);
    cache.cerrar();
  });
});
