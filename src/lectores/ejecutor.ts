/**
 * Dónde se ejecuta `derivar` (IN-012): en el Worker de derivados si se puede; si no hay Worker (pruebas, navegadores
 * raros) o deja de funcionar, en el hilo principal con el mismo registro.
 */

import type { Elemento } from '@rimor/formato';
import { type Remote, wrap } from 'comlink';
import type { ApiDerivados } from '../workers/derivados.worker';
import type { Ejecutor } from './derivados';
import type { Registro } from './registro';

/** Deriva en este mismo hilo. */
export function ejecutorEnHilo(registro: Registro): Ejecutor {
  return async (nombre, el) => {
    const lector = registro.porNombre(nombre);
    if (!lector) throw new Error(`lector.desconocido: ${nombre}`);
    return lector.derivar(el);
  };
}

export interface EjecutorCerrable {
  ejecutar: Ejecutor;
  /** Termina el Worker; si después se vuelve a pedir algo, se crea otro. */
  cerrar(): void;
}

/**
 * Ejecutor sobre el Worker, que se crea con la primera petición. Si el Worker falla al cargar (evento `error`,
 * que Comlink no convierte en rechazo), lo pendiente se rechaza y lo siguiente se deriva en el hilo principal.
 */
export function crearEjecutor(registro: Registro): EjecutorCerrable {
  const enHilo = ejecutorEnHilo(registro);
  if (typeof Worker !== 'function') return { ejecutar: enHilo, cerrar: () => undefined };

  let actual: { worker: Worker; api: Remote<ApiDerivados>; roto: Promise<never> } | null = null;
  let averiado = false;
  const abrir = () => {
    const worker = new Worker(new URL('../workers/derivados.worker.ts', import.meta.url), { type: 'module' });
    const roto = new Promise<never>((_, ko) =>
      worker.addEventListener('error', () => {
        averiado = true;
        worker.terminate();
        actual = null;
        ko(new Error('derivados.workerNoCarga'));
      }),
    );
    roto.catch(() => undefined);
    actual = { worker, api: wrap<ApiDerivados>(worker), roto };
    return actual;
  };

  return {
    ejecutar: (nombre: string, el: Elemento) => {
      if (averiado) return enHilo(nombre, el);
      const w = actual ?? abrir();
      return Promise.race([w.api.derivar(nombre, el), w.roto]);
    },
    cerrar: () => {
      actual?.worker.terminate();
      actual = null;
    },
  };
}
