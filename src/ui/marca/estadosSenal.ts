/**
 * Estados de la animación «Señal» (IN-090): duración, si es bucle y el fotograma de reposo (fracción del ciclo
 * en la que se detiene una animación de una vez; 1 = el final). TS puro.
 */

export type EstadoSenal =
  | 'arranque'
  | 'primer-uso'
  | 'cargando'
  | 'analizando'
  | 'indexando'
  | 'contestando'
  | 'exportando'
  | 'copia-al-dia'
  | 'guardado'
  | 'error'
  | 'comparando';

export interface DefinicionEstado {
  /** Archivo SVG de rimor-animaciones que es su especificación. */
  svg: string;
  duracionS: number;
  bucle: boolean;
  /** Fracción del ciclo donde se queda una animación de una vez (los «88 %» de la ficha). */
  reposo: number;
  /** Lienzo ancho (logotipo con nombre) o cuadrado. */
  ancho: boolean;
}

export const ESTADOS_SENAL: Record<EstadoSenal, DefinicionEstado> = {
  arranque: { svg: '01-abrir-la-web', duracionS: 3.6, bucle: false, reposo: 0.88, ancho: true },
  'primer-uso': { svg: '02-primer-uso', duracionS: 5.5, bucle: false, reposo: 0.9, ancho: true },
  cargando: { svg: '04-cargando', duracionS: 1.4, bucle: true, reposo: 1, ancho: false },
  indexando: { svg: '06-indexando', duracionS: 2.4, bucle: true, reposo: 1, ancho: false },
  guardado: { svg: '09-guardado', duracionS: 1.8, bucle: false, reposo: 1, ancho: false },
  analizando: { svg: '11-analizando', duracionS: 1.6, bucle: true, reposo: 1, ancho: false },
  'copia-al-dia': { svg: '14-copia-al-dia', duracionS: 3, bucle: false, reposo: 0.88, ancho: false },
  error: { svg: '15-error', duracionS: 3.2, bucle: false, reposo: 1, ancho: false },
  comparando: { svg: '17-comparando', duracionS: 3, bucle: false, reposo: 0.75, ancho: false },
  exportando: { svg: '19-exportando', duracionS: 2.4, bucle: true, reposo: 1, ancho: false },
  contestando: { svg: '20-rimor-contesta', duracionS: 2.4, bucle: true, reposo: 1, ancho: false },
};

/** Tras este tiempo en bucle, la animación se detiene en su reposo y queda el texto. */
export const LIMITE_BUCLE_MS = 20_000;
/** Una espera más corta no muestra animación. */
export const UMBRAL_ESPERA_MS = 400;
/** Una vez visible, una espera se ve al menos este tiempo. */
export const MINIMO_VISIBLE_MS = 600;
