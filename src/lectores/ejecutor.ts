/**
 * Dónde se ejecuta `derivar` (IN-012): en el Worker de derivados si se puede; si no hay Worker (pruebas, navegadores
 * raros) o deja de funcionar, en el hilo principal con el mismo registro.
 */

import type { Elemento } from '@rimor/formato';
import { proxy, type Remote, wrap } from 'comlink';
import { type Previa, previsualizar } from '../captura/previa';
import type { ApiDerivados } from '../workers/derivados.worker';
import type { Ejecutor } from './derivados';
import type { Registro } from './registro';

/** Deriva en este mismo hilo. */
export function ejecutorEnHilo(registro: Registro): Ejecutor {
  return async (nombre, el, alProgreso) => {
    const lector = registro.porNombre(nombre);
    if (!lector) throw new Error(`lector.desconocido: ${nombre}`);
    return lector.derivar(el, alProgreso ? { alProgreso } : {});
  };
}

export interface EjecutorCerrable {
  ejecutar: Ejecutor;
  /** Vista previa del compositor: en el Worker si lo hay (textos grandes, IN-015). */
  previsualizar(texto: string): Promise<Previa>;
  /** Termina el Worker atascado; lo siguiente que se pida abre otro. */
  reiniciar(): void;
  /** Termina el Worker para siempre: lo que se pida después se rechaza. */
  cerrar(): void;
}

/**
 * Ejecutor sobre el Worker, que se crea con la primera petición. Si el Worker falla al cargar (evento `error`,
 * que Comlink no convierte en rechazo), lo pendiente se rechaza y lo siguiente se deriva en el hilo principal.
 */
export function crearEjecutor(registro: Registro): EjecutorCerrable {
  const enHilo = ejecutorEnHilo(registro);
  const previaEnHilo = async (texto: string) => previsualizar(texto, registro);
  if (typeof Worker !== 'function')
    return { ejecutar: enHilo, previsualizar: previaEnHilo, reiniciar: () => undefined, cerrar: () => undefined };

  interface Abierto {
    worker: Worker;
    api: Remote<ApiDerivados>;
    /** Quien espera a este Worker: si muere (no carga, se reinicia o se cierra), se le rechaza. */
    esperando: Set<(e: Error) => void>;
  }
  let actual: Abierto | null = null;
  let averiado = false;
  let cerrado = false;
  /** Termina el Worker y rechaza lo que esperaba de él (Comlink no lo haría nunca). */
  const terminar = (motivo: string) => {
    const w = actual;
    actual = null;
    if (!w) return;
    w.worker.terminate();
    for (const rechazar of w.esperando) rechazar(new Error(motivo));
    w.esperando.clear();
  };
  const abrir = (): Abierto => {
    const worker = new Worker(new URL('../workers/derivados.worker.ts', import.meta.url), { type: 'module' });
    const abierto: Abierto = { worker, api: wrap<ApiDerivados>(worker), esperando: new Set() };
    worker.addEventListener('error', () => {
      averiado = true;
      if (actual === abierto) terminar('derivados.workerNoCarga');
    });
    actual = abierto;
    return abierto;
  };
  /**
   * Una llamada al Worker que se rechaza si el Worker muere. Cada llamada se da de baja al acabar: no queda
   * nada que retenga su resultado (con `Promise.race` contra una promesa eterna, se acumularían).
   */
  function vigilada<T>(llamar: (api: Remote<ApiDerivados>) => Promise<T>): Promise<T> {
    const w = actual ?? abrir();
    return new Promise<T>((ok, ko) => {
      w.esperando.add(ko);
      llamar(w.api)
        .then(ok, ko)
        .finally(() => w.esperando.delete(ko));
    });
  }

  return {
    ejecutar: (nombre: string, el: Elemento, alProgreso?: (hechas: number, total: number) => void) => {
      if (cerrado) return Promise.reject(new Error('derivados.cerrado'));
      if (averiado) return enHilo(nombre, el, alProgreso);
      // El aviso de progreso cruza al Worker como proxy de Comlink (una función no se puede copiar).
      return vigilada((api) => api.derivar(nombre, el, alProgreso ? proxy(alProgreso) : undefined));
    },
    previsualizar: (texto: string) => {
      if (cerrado) return Promise.reject(new Error('derivados.cerrado'));
      if (averiado) return previaEnHilo(texto);
      return vigilada((api) => api.previsualizar(texto));
    },
    reiniciar: () => terminar('derivados.reiniciado'),
    cerrar: () => {
      cerrado = true;
      terminar('derivados.cerrado');
    },
  };
}
