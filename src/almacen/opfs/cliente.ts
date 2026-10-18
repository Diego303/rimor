/**
 * Cliente del almacén OPFS: el trabajo lo hace `almacen.worker.ts` (con `createSyncAccessHandle`, que solo
 * existe en Workers) y aquí se expone con la interfaz Almacen. Comlink no transfiere iteradores
 * asíncronos: el Worker devuelve listas y aquí se convierten en `AsyncIterable`.
 */
import { wrap } from 'comlink';
import type { ApiAlmacenWorker } from '../../workers/almacen.worker';
import type { Almacen, EntradaAlmacen } from '../contrato';

export interface AlmacenOpfsRemoto extends Almacen {
  /** Termina o deshace escrituras cortadas; solo la pestaña que escribe debe llamarlo. Devuelve cuántas había. */
  limpiarHuerfanos(): Promise<number>;
  cerrar(): void;
}

/** Lo que se espera a que el Worker abra OPFS antes de darlo por perdido. */
export const ESPERA_APERTURA_MS = 10_000;

/**
 * Abre (o crea) la carpeta del espacio en OPFS dentro de un Worker. Falla (y termina el Worker) si OPFS no se
 * abre, si el Worker no llega a cargar (Comlink no rechaza nada en ese caso) o si tarda demasiado.
 */
export async function crearAlmacenOpfs(espacio: string, espera = ESPERA_APERTURA_MS): Promise<AlmacenOpfsRemoto> {
  const worker = new Worker(new URL('../../workers/almacen.worker.ts', import.meta.url), { type: 'module' });
  const api = wrap<ApiAlmacenWorker>(worker);
  let tiempo: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      api.abrir(espacio),
      new Promise<never>((_, ko) => {
        worker.addEventListener('error', () => ko(new Error('opfs.workerNoCarga')), { once: true });
        tiempo = setTimeout(() => ko(new Error('opfs.tiempoAgotado')), espera);
      }),
    ]);
  } catch (e) {
    worker.terminate();
    throw e;
  } finally {
    clearTimeout(tiempo);
  }
  return {
    limpiarHuerfanos: () => api.limpiarHuerfanos(),
    leer: (ruta) => api.leer(ruta),
    escribir: (ruta, datos) => api.escribir(ruta, datos),
    mover: (de, a) => api.mover(de, a),
    borrar: (ruta) => api.borrar(ruta),
    existe: (ruta) => api.existe(ruta),
    async *listar(prefijo: string): AsyncIterable<EntradaAlmacen> {
      yield* await api.listar(prefijo);
    },
    cerrar: () => worker.terminate(),
  };
}
