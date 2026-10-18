/**
 * Geometría del símbolo «Señal» (LEEME de rimor-icono y rimor-diseno.md §6.2): retícula de 48 × 48,
 * onda en tinta, punto naranja (el siguiente máximo de la onda) y guion. Única fuente para los
 * componentes de marca y para las animaciones (IN-090).
 */

export const VIEWBOX = '0 0 48 48';
export const LADO = 48;
export const ONDA = 'M7 24 C10.5 12.5 13.5 12.5 17 24 S23.5 35.5 27 24';
export const PUNTO = { cx: 33, cy: 15.5, r: 3.1 } as const;
export const GUION = 'M40 24 H41';
/** Trazo normal y el de tamaños pequeños (por debajo de 20 px y en el favicon). */
export const TRAZO = 3;
export const TRAZO_PEQUENO = 3.6;
export const UMBRAL_PEQUENO = 20;
/** Radio del icono de app: 22,5 % del lado. */
export const RADIO_APP = 0.225;

/** Nombre de la app: no se traduce. */
export const NOMBRE_APP = 'Rimor';
