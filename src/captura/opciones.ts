/** De las opciones de captura de los ajustes (IN-038) a las de la ocultación y la detección. TS puro. */
import type { OpcionesCaptura } from '../espacio/ajustes';
import type { OpcionesOcultar } from '../seguridad/secretos/ocultar';
import type { OpcionesDeteccion } from './detector';

export const opcionesOcultar = (o?: OpcionesCaptura): OpcionesOcultar =>
  o?.secretosDesactivados.length ? { desactivadas: new Set(o.secretosDesactivados) } : {};

export const opcionesDetectar = (o?: OpcionesCaptura): Pick<OpcionesDeteccion, 'umbral' | 'margen' | 'reglas'> =>
  o ? { umbral: o.umbral, margen: o.margen, ...(o.reglas?.length ? { reglas: o.reglas } : {}) } : {};
