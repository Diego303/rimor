/** Worker de búsqueda (IN-032, F0-8): el índice de MiniSearch fuera del hilo principal. */

import { expose } from 'comlink';
import { apiIndice } from '../busqueda/indice';

const api = apiIndice();

export type ApiBusqueda = typeof api;

expose(api);
