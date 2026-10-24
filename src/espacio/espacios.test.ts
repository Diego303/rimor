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

describe('borrar un espacio: casos de la revisión', () => {
  const lista = new Map<string, string>();
  const almacenLocal = {
    getItem: (k: string) => lista.get(k) ?? null,
    setItem: (k: string, v: string) => void lista.set(k, v),
    removeItem: (k: string) => void lista.delete(k),
  };

  it('con el espacio abierto en otra pestaña (su cerrojo cogido) no se borra', async () => {
    vi.stubGlobal('localStorage', almacenLocal);
    recordarEspacioConocido('b', 'Ejemplo · gateway');
    const borrarCarpeta = vi.fn(async () => undefined);
    const ocupado = { request: (_n: string, _o: unknown, fn: (l: unknown) => Promise<unknown>) => fn(null) };
    await expect(borrarEspacio('b', { abierto: 'a', borrarCarpeta, cerrojos: ocupado })).rejects.toThrow(
      'espacio.enUso',
    );
    expect(borrarCarpeta).not.toHaveBeenCalled();
    expect(espaciosConocidos().map((e) => e.id)).toContain('b');
    vi.unstubAllGlobals();
  });

  it('primero la copia: si falla, no se borra; después, deja de ser el que se abre por defecto', async () => {
    vi.stubGlobal('localStorage', almacenLocal);
    recordarEspacioConocido('b', 'Ejemplo · gateway');
    const borrarCarpeta = vi.fn(async () => undefined);
    const libre = { request: (_n: string, _o: unknown, fn: (l: unknown) => Promise<unknown>) => fn({}) };
    await expect(
      borrarEspacio('b', {
        abierto: 'a',
        borrarCarpeta,
        cerrojos: libre,
        copiaPrevia: async () => Promise.reject(new Error('sin copia')),
      }),
    ).rejects.toThrow('sin copia');
    expect(borrarCarpeta).not.toHaveBeenCalled();
    lista.set('rimor:espacio', 'b');
    const copia = vi.fn(async () => undefined);
    await borrarEspacio('b', { abierto: 'a', borrarCarpeta, cerrojos: libre, copiaPrevia: copia });
    expect(copia).toHaveBeenCalledWith('b');
    expect(lista.has('rimor:espacio')).toBe(false);
    vi.unstubAllGlobals();
  });
});
