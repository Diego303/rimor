import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompositor } from '../captura/compositor';
import { type CacheMinima, guardarCompartido } from './compartir';
import { recibirCompartido } from './recibir';

const absoluta = (k: string) => new URL(k, 'https://rimor.local').href;

function cacheFalsa(): CacheMinima {
  const m = new Map<string, Response>();
  return {
    // Como la de verdad: las claves relativas se resuelven contra el origen.
    match: async (k) => m.get(absoluta(k))?.clone(),
    put: async (k, r) => void m.set(absoluta(k), r),
    delete: async (k) => m.delete(absoluta(k)),
    keys: async () => [...m.keys()].map((k) => new Request(k)),
  };
}

beforeEach(() => useCompositor.setState({ texto: '', archivos: [] }));

describe('abrir la app desde «Compartir»', () => {
  it('con ?compartido: lo compartido al compositor y la URL limpia', async () => {
    const cache = cacheFalsa();
    const f = new FormData();
    f.append('texto', 'Mira esto');
    f.append('archivos', new File(['a,b\n1,2\n'], 'datos.csv', { type: 'text/csv' }));
    await guardarCompartido(f, cache, '/rimor/');
    const replaceState = vi.fn();
    const estado = { __TSR_index: 0 };
    const entorno = {
      location: { search: '?compartido&otra=1', pathname: '/rimor/', hash: '#/' },
      history: { replaceState, state: estado },
      caches: { open: async () => cache },
    };
    // En una pestaña que solo lee no se recoge: se queda para cuando pueda guardar.
    expect(await recibirCompartido('/rimor/', { soloLectura: true }, entorno)).toBe('soloLectura');
    expect(replaceState).not.toHaveBeenCalled();
    expect(await recibirCompartido('/rimor/', {}, entorno)).toBe('recogido');
    // Sin perder el estado del historial (el del enrutado por hash).
    expect(replaceState).toHaveBeenCalledWith(estado, '', '/rimor/?otra=1#/');
    expect(useCompositor.getState().texto).toBe('Mira esto');
    expect(useCompositor.getState().archivos.map((a) => a.name)).toEqual(['datos.csv']);
  });

  it('sin ?compartido no toca nada; sin caches, limpia la URL; con ?compartido=error, lo dice', async () => {
    const replaceState = vi.fn();
    const sin = { location: { search: '', pathname: '/', hash: '' }, history: { replaceState, state: null } };
    expect(await recibirCompartido('/', {}, sin)).toBe('nada');
    expect(replaceState).not.toHaveBeenCalled();
    expect(await recibirCompartido('/', {}, { ...sin, location: { ...sin.location, search: '?compartido' } })).toBe(
      'vacio',
    );
    expect(replaceState).toHaveBeenLastCalledWith(null, '', '/');
    const conError = { ...sin, location: { ...sin.location, search: '?compartido=error' } };
    expect(await recibirCompartido('/', { soloLectura: true }, conError)).toBe('error');
  });
});
