import { describe, expect, it, vi } from 'vitest';
import { borrarEspacio, espaciosConocidos, recordarEspacioConocido } from './Espacio';

describe('borrar un espacio', () => {
  it('borra su carpeta, lo quita de la lista; el abierto no se borra', async () => {
    const almacen = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => almacen.get(k) ?? null,
      setItem: (k: string, v: string) => void almacen.set(k, v),
    });
    recordarEspacioConocido('a', 'Trabajo');
    recordarEspacioConocido('b', 'Ejemplo · gateway');
    const borrarCarpeta = vi.fn(async () => undefined);
    await expect(borrarEspacio('a', { abierto: 'a', borrarCarpeta })).rejects.toThrow('espacio.borrarAbierto');
    await borrarEspacio('b', { abierto: 'a', borrarCarpeta });
    expect(borrarCarpeta).toHaveBeenCalledWith('b');
    expect(espaciosConocidos().map((e) => e.id)).toEqual(['a']);
    // Si la carpeta no se puede borrar, sigue en la lista.
    recordarEspacioConocido('c', 'Otro');
    await expect(
      borrarEspacio('c', { abierto: 'a', borrarCarpeta: async () => Promise.reject(new Error('en uso')) }),
    ).rejects.toThrow();
    expect(espaciosConocidos().map((e) => e.id)).toContain('c');
    vi.unstubAllGlobals();
  });
});
