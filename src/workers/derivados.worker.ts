/** Worker de derivados (IN-012): ejecuta `derivar` de cada lector y la vista previa del compositor fuera del hilo principal. */

import type { Elemento } from '@rimor/formato';
import { expose } from 'comlink';
import { previsualizar } from '../captura/previa';
import type { OpcionesCaptura } from '../espacio/ajustes';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { REGISTRO } from '../lectores/registro';

const derivar = ejecutorEnHilo(REGISTRO);

const api = {
  derivar: (nombre: string, el: Elemento, alProgreso?: (hechas: number, total: number) => void): Promise<unknown> =>
    derivar(nombre, el, alProgreso),
  /** Vista previa del compositor para textos grandes (IN-015). */
  previsualizar: (texto: string, opciones?: OpcionesCaptura) => previsualizar(texto, REGISTRO, opciones),
};

export type ApiDerivados = typeof api;

expose(api);
