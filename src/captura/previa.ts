/**
 * Vista previa del compositor (IN-015): qué tipo saldría, con qué confianza, si hay duda, qué indicaciones se
 * aplicarían y cuántos secretos se ocultarían. TS puro: con textos grandes se calcula en el Worker.
 */
import type { Registro } from '../lectores/registro';
import { type OpcionesOcultar, ocultar } from '../seguridad/secretos/ocultar';
import { type Deteccion, detectar } from './detector';
import { analizarIndicaciones, type Indicaciones } from './indicaciones';

/** A partir de este tamaño, la vista previa se calcula en el Worker. */
export const PREVIA_EN_WORKER = 20 * 1024;

export interface Previa {
  indicaciones: Indicaciones;
  /** Sin `/tipo` ni búsqueda: lo que dice el detector sobre el cuerpo ya ocultado. */
  deteccion?: Deteccion;
  secretos: number;
}

export function previsualizar(texto: string, registro: Registro, secretos?: OpcionesOcultar): Previa {
  const indicaciones = analizarIndicaciones(texto);
  if (indicaciones.busqueda !== undefined) return { indicaciones, secretos: 0 };
  const oculto = ocultar(indicaciones.cuerpo, secretos);
  const deteccion = indicaciones.tipo ? undefined : detectar({ texto: oculto.texto }, registro);
  return { indicaciones, ...(deteccion ? { deteccion } : {}), secretos: oculto.hallados.length };
}
