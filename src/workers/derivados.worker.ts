/** Worker de derivados (IN-012): ejecuta `derivar` de cada lector y la vista previa del compositor fuera del hilo principal. */

import type { Elemento } from '@rimor/formato';
import { expose } from 'comlink';
import { previsualizar } from '../captura/previa';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { REGISTRO } from '../lectores/registro';

const derivar = ejecutorEnHilo(REGISTRO);

const api = {
  derivar: (nombre: string, el: Elemento): Promise<unknown> => derivar(nombre, el),
  /** Vista previa del compositor para textos grandes (IN-015). */
  previsualizar: (texto: string) => previsualizar(texto, REGISTRO),
};

export type ApiDerivados = typeof api;

expose(api);
