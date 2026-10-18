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

/** Abre (o crea) la carpeta del espacio en OPFS dentro de un Worker. */
export async function crearAlmacenOpfs(espacio: string): Promise<AlmacenOpfsRemoto> {
  const worker = new Worker(new URL('../../workers/almacen.worker.ts', import.meta.url), { type: 'module' });
  const api = wrap<ApiAlmacenWorker>(worker);
  await api.abrir(espacio);
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
