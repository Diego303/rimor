import { describe, expect, it, vi } from 'vitest';

describe('borrador del compositor', () => {
  it('se restaura de sessionStorage al recargar', async () => {
    const guardado = new Map<string, string>([['rimor:borrador', 'texto a medias']]);
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => guardado.get(k) ?? null,
      setItem: (k: string, v: string) => void guardado.set(k, v),
      removeItem: (k: string) => void guardado.delete(k),
    });
    vi.resetModules();
    const { useCompositor } = await import('./compositor');
    expect(useCompositor.getState().texto).toBe('texto a medias');
    useCompositor.getState().vaciar();
    expect(guardado.has('rimor:borrador')).toBe(false);
    vi.unstubAllGlobals();
  });

  it('sin sessionStorage sigue funcionando en memoria', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    });
    vi.resetModules();
    const { useCompositor } = await import('./compositor');
    expect(useCompositor.getState().texto).toBe('');
    useCompositor.getState().setTexto('hola');
    expect(useCompositor.getState().texto).toBe('hola');
    vi.unstubAllGlobals();
  });
});
