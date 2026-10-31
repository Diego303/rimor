import { describe, expect, it } from 'vitest';
import { type CacheMinima, esDuckdb, guardarCompartido, recogerCompartido, textoCompartido } from './compartir';

/** Una `Cache` en memoria (en Node no hay `caches`). */
const absoluta = (k: string) => new URL(k, 'https://rimor.local').href;

function cacheFalsa(): CacheMinima & { claves: () => string[] } {
  const m = new Map<string, Response>();
  return {
    claves: () => [...m.keys()].map((k) => new URL(k).pathname),
    // Como la de verdad: las claves relativas se resuelven contra el origen.
    match: async (k) => m.get(absoluta(k))?.clone(),
    put: async (k, r) => void m.set(absoluta(k), r),
    delete: async (k) => m.delete(absoluta(k)),
    keys: async () => [...m.keys()].map((k) => new Request(k)),
  };
}

function formulario(campos: Record<string, string>, archivos: File[] = []) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  for (const a of archivos) f.append('archivos', a);
  return f;
}

describe('lo compartido desde otra app', () => {
  it('se guarda (texto y archivos con su nombre y su tipo) y se recoge una sola vez', async () => {
    const cache = cacheFalsa();
    const log = new File(['17:40 ERROR caída\n'], 'gateway.log', { type: 'text/plain' });
    await guardarCompartido(
      formulario({ titulo: 'Fallo', texto: 'Mira esto', url: 'https://a.es/x' }, [log]),
      cache,
      '/',
    );
    const r = await recogerCompartido(cache, '/');
    expect(r?.texto).toBe('Fallo\nMira esto\nhttps://a.es/x');
    expect(r?.archivos.map((a) => [a.name, a.type])).toEqual([['gateway.log', 'text/plain']]);
    expect(await r?.archivos[0]?.text()).toBe('17:40 ERROR caída\n');
    expect(cache.claves()).toEqual([]);
    expect(await recogerCompartido(cache, '/')).toBeNull();
  });

  it('un nuevo compartir sustituye a uno que nunca se recogió; un campo de archivos vacío no cuenta', async () => {
    const cache = cacheFalsa();
    await guardarCompartido(formulario({ texto: 'viejo' }, [new File(['x'], 'a.txt')]), cache, '/rimor/');
    await guardarCompartido(formulario({ texto: 'nuevo' }, [new File([], '')]), cache, '/rimor/');
    expect(await recogerCompartido(cache, '/rimor/')).toEqual({ texto: 'nuevo', archivos: [] });
  });

  it('sin nada (o con lo guardado roto), null', async () => {
    const cache = cacheFalsa();
    await guardarCompartido(formulario({}), cache, '/');
    expect(await recogerCompartido(cache, '/')).toBeNull();
    await cache.put('/compartido/datos', new Response('{roto'));
    expect(await recogerCompartido(cache, '/')).toBeNull();
    expect(cache.claves()).toEqual([]);
  });

  it('el texto, sin repetir lo que Android pone dos veces', () => {
    expect(textoCompartido({ titulo: 'Artículo', texto: 'Léelo https://a.es/x', url: 'https://a.es/x' })).toBe(
      'Artículo\nLéelo https://a.es/x',
    );
    expect(textoCompartido({ titulo: 'Léelo', texto: 'Léelo ya', url: '' })).toBe('Léelo ya');
    expect(textoCompartido({ titulo: 'https://a.es', texto: '', url: 'https://a.es' })).toBe('https://a.es');
    expect(textoCompartido({ titulo: '', texto: '', url: '' })).toBe('');
  });

  it('DuckDB (sus wasm, sus workers y sus extensiones) no se precarga', () => {
    expect(esDuckdb('/_astro/duckdb-eh.CfdE9-rk.wasm')).toBe(true);
    expect(esDuckdb('/rimor/_astro/duckdb-browser-eh.worker.CwdVMcbT.js')).toBe(true);
    expect(esDuckdb('/duckdb/v1.5.4/wasm_eh/parquet.duckdb_extension.wasm')).toBe(true);
    expect(esDuckdb('/_astro/App.esAsUUzr.js')).toBe(false);
  });
});
