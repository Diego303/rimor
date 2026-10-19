/**
 * Estados ligeros de un elemento (ORG-04): sin estado es «nuevo»; los comunes valen para cualquier tipo y cada
 * lector puede declarar los suyos (`Lector.estados`, como los de las ideas). TS puro.
 */

export const ESTADOS_COMUNES = ['en-uso', 'resuelto', 'archivado'] as const;
export type EstadoComun = (typeof ESTADOS_COMUNES)[number];

export const esEstadoComun = (estado: string | undefined): estado is EstadoComun =>
  !!estado && (ESTADOS_COMUNES as readonly string[]).includes(estado);
