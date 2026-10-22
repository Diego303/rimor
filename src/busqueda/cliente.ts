/**
 * Dónde vive el índice (IN-032): en el Worker de búsqueda si se puede; si no hay Worker (pruebas, navegadores raros)
 * o no carga, en el hilo principal. MiniSearch se carga aparte en los dos casos: no pesa en la carga inicial.
 */
import { type Remote, wrap } from 'comlink';
import type { ApiBusqueda } from '../workers/busqueda.worker';
import type { ApiIndice } from './contrato';

export interface ClienteIndice {
  api: ApiIndice;
  cerrar(): void;
}

/** El índice en este hilo (cargado en diferido). */
export function indiceEnHilo(): ApiIndice {
  let api: Promise<ApiIndice> | null = null;
  const cargar = () => {
    api ??= import('./indice').then((m) => m.apiIndice());
    return api;
  };
  return {
    cargar: async (json) => (await cargar()).cargar(json),
    claves: async () => (await cargar()).claves(),
    poner: async (lista) => (await cargar()).poner(lista),
    quitar: async (ids) => (await cargar()).quitar(ids),
    buscar: async (palabras, sin) => (await cargar()).buscar(palabras, sin),
    conPalabras: async (palabras) => (await cargar()).conPalabras(palabras),
    exportar: async () => (await cargar()).exportar(),
  };
}

/**
 * El índice en el Worker. Si el Worker no carga (evento `error`, que Comlink no convierte en rechazo), lo que
 * esperaba se rechaza y desde entonces se usa el índice en este hilo: el motor lo ve vacío y lo rehace.
 */
export function crearClienteIndice(alAveriarse?: () => void): ClienteIndice {
  if (typeof Worker !== 'function') return { api: indiceEnHilo(), cerrar: () => undefined };
  const worker = new Worker(new URL('../workers/busqueda.worker.ts', import.meta.url), { type: 'module' });
  const remoto: Remote<ApiBusqueda> = wrap<ApiBusqueda>(worker);
  const esperando = new Set<(e: Error) => void>();
  let respaldo: ApiIndice | null = null;
  worker.addEventListener('error', () => {
    if (respaldo) return;
    respaldo = indiceEnHilo();
    worker.terminate();
    for (const rechazar of esperando) rechazar(new Error('busqueda.workerNoCarga'));
    esperando.clear();
    alAveriarse?.();
  });
  function llamar<T>(fn: (api: ApiIndice) => Promise<T>): Promise<T> {
    if (respaldo) return fn(respaldo);
    return new Promise<T>((ok, ko) => {
      esperando.add(ko);
      fn(remoto as unknown as ApiIndice)
        .then(ok, ko)
        .finally(() => esperando.delete(ko));
    });
  }
  return {
    api: {
      cargar: (json) => llamar((a) => a.cargar(json)),
      claves: () => llamar((a) => a.claves()),
      poner: (lista) => llamar((a) => a.poner(lista)),
      quitar: (ids) => llamar((a) => a.quitar(ids)),
      buscar: (palabras, sin) => llamar((a) => a.buscar(palabras, sin)),
      conPalabras: (palabras) => llamar((a) => a.conPalabras(palabras)),
      exportar: () => llamar((a) => a.exportar()),
    },
    cerrar: () => worker.terminate(),
  };
}
