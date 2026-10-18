import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearAlmacenOpfs } from './cliente';

/** Worker falso que nunca contesta; puede emitir `error` como uno cuyo módulo no carga. */
class WorkerMudo {
  static ultimo: WorkerMudo | null = null;
  readonly oyentes = new Map<string, ((e: unknown) => void)[]>();
  terminate = vi.fn();
  constructor() {
    WorkerMudo.ultimo = this;
  }
  addEventListener(tipo: string, fn: (e: unknown) => void) {
    this.oyentes.set(tipo, [...(this.oyentes.get(tipo) ?? []), fn]);
  }
  removeEventListener() {}
  postMessage() {}
  start() {}
  emitir(tipo: string) {
    for (const fn of this.oyentes.get(tipo) ?? []) fn({});
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('crearAlmacenOpfs', () => {
  it('falla y termina el Worker si su módulo no llega a cargar', async () => {
    vi.stubGlobal('Worker', WorkerMudo);
    const apertura = crearAlmacenOpfs('e', 60_000);
    WorkerMudo.ultimo?.emitir('error');
    await expect(apertura).rejects.toThrow('opfs.workerNoCarga');
    expect(WorkerMudo.ultimo?.terminate).toHaveBeenCalled();
  });

  it('falla y termina el Worker si no abre a tiempo', async () => {
    vi.stubGlobal('Worker', WorkerMudo);
    await expect(crearAlmacenOpfs('e', 10)).rejects.toThrow('opfs.tiempoAgotado');
    expect(WorkerMudo.ultimo?.terminate).toHaveBeenCalled();
  });
});
