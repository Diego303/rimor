import { describe, expect, it } from 'vitest';
import { type Canal, type Cerrojos, coordinarPestanas } from './pestanas';

/** Cerrojos con la semántica de Web Locks para un solo nombre. */
function cerrojosFalsos(): Cerrojos {
  let ocupado = false;
  const espera: (() => void)[] = [];
  return {
    async request(_n, opciones, fn) {
      if (ocupado && opciones.ifAvailable) return fn(null);
      while (ocupado) await new Promise<void>((r) => espera.push(r));
      if (opciones.signal?.aborted) return undefined;
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

function canalFalso(bus: Set<(d: unknown) => void>): Canal {
  let oyente: ((e: { data: unknown }) => void) | null = null;
  const propio = (d: unknown) => oyente?.({ data: d });
  bus.add(propio);
  return {
    postMessage: (m) => {
      for (const fn of bus) if (fn !== propio) fn(m);
    },
    addEventListener: (_t, fn) => {
      oyente = fn;
    },
    close: () => bus.delete(propio),
  };
}

describe('coordinarPestanas', () => {
  it('la primera escribe, la segunda lee y pasa a escribir cuando la primera se cierra', async () => {
    const cerrojos = cerrojosFalsos();
    const bus = new Set<(d: unknown) => void>();
    const a = await coordinarPestanas('e1', cerrojos, canalFalso(bus));
    const b = await coordinarPestanas('e1', cerrojos, canalFalso(bus));
    expect(a.modo()).toBe('escritor');
    expect(b.modo()).toBe('lector');
    const cambios: string[][] = [];
    b.alCambiarEnOtra((r) => cambios.push(r));
    a.avisarCambio(['elementos/x.md']);
    expect(cambios).toEqual([['elementos/x.md']]);
    const pasa = new Promise<string>((r) => b.alCambiarModo(r));
    a.cerrar();
    expect(await pasa).toBe('escritor');
    expect(b.modo()).toBe('escritor');
    b.cerrar();
  });
});
