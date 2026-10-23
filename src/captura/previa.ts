/**
 * Vista previa del compositor (IN-015): qué tipo saldría, con qué confianza, si hay duda, qué indicaciones se
 * aplicarían y cuántos secretos se ocultarían. TS puro: con textos grandes se calcula en el Worker.
 */

import type { OpcionesCaptura } from '../espacio/ajustes';
import type { Registro } from '../lectores/registro';
import { ocultar } from '../seguridad/secretos/ocultar';
import { type Deteccion, detectar } from './detector';
import { analizarIndicaciones, type Indicaciones } from './indicaciones';
import { opcionesDetectar, opcionesOcultar } from './opciones';

/** A partir de este tamaño, la vista previa se calcula en el Worker. */
export const PREVIA_EN_WORKER = 20 * 1024;

export interface Previa {
  indicaciones: Indicaciones;
  /** Sin `/tipo` ni búsqueda: lo que dice el detector sobre el cuerpo ya ocultado. */
  deteccion?: Deteccion;
  secretos: number;
}

/**
 * La vista previa del compositor: lo mismo que hará la captura, con las mismas opciones de los ajustes (reglas de
 * secretos desactivadas, umbral y margen de la detección).
 */
export function previsualizar(texto: string, registro: Registro, opciones?: OpcionesCaptura): Previa {
  const indicaciones = analizarIndicaciones(texto);
  if (indicaciones.busqueda !== undefined) return { indicaciones, secretos: 0 };
  const oculto = ocultar(indicaciones.cuerpo, opcionesOcultar(opciones));
  const deteccion = indicaciones.tipo
    ? undefined
    : detectar({ texto: oculto.texto }, registro, opcionesDetectar(opciones));
  return { indicaciones, ...(deteccion ? { deteccion } : {}), secretos: oculto.hallados.length };
}
