/** Worker de derivados (IN-012): ejecuta `derivar` de cada lector fuera del hilo principal. */

import type { Elemento } from '@rimor/formato';
import { expose } from 'comlink';
import { ejecutorEnHilo } from '../lectores/ejecutor';
import { REGISTRO } from '../lectores/registro';

const derivar = ejecutorEnHilo(REGISTRO);

const api = {
  derivar: (nombre: string, el: Elemento): Promise<unknown> => derivar(nombre, el),
};

export type ApiDerivados = typeof api;

expose(api);
