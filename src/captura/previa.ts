/**
 * Vista previa del compositor (IN-015): qué tipo saldría, con qué confianza, si hay duda, qué indicaciones se
 * aplicarían y cuántos secretos se ocultarían. TS puro: con textos grandes se calcula en el Worker.
 */

import type { TipoElemento } from '@rimor/formato';
import type { OpcionesCaptura } from '../espacio/ajustes';
import type { Registro } from '../lectores/registro';
import { ocultar } from '../seguridad/secretos/ocultar';
import { type Deteccion, detectar } from './detector';
import { partes } from './dividir';
import { analizarIndicaciones, type Indicaciones } from './indicaciones';
import { opcionesDetectar, opcionesOcultar } from './opciones';

/** A partir de este tamaño, la vista previa se calcula en el Worker. */
export const PREVIA_EN_WORKER = 20 * 1024;

export interface Previa {
  indicaciones: Indicaciones;
  /** Sin `/tipo` ni búsqueda: lo que dice el detector sobre el cuerpo ya ocultado. */
  deteccion?: Deteccion;
  secretos: number;
  /** Se puede dividir en `n` elementos (IN-049): varias URL o varios bloques que son cosas distintas. */
  division?: { n: number; via: 'enlaces' | 'bloques' };
}

/**
 * Tipos cuyas líneas en blanco son de su estructura: sus bloques no son elementos sueltos (los párrafos de un Markdown,
 * las funciones de un código, las secciones de un log). Un conjunto que es Texto sí puede dividirse: suele ser una
 * mezcla que nadie reconoce entera (un JSON y un log).
 */
const CON_BLOQUES_PROPIOS: ReadonlySet<TipoElemento> = new Set([
  'markdown',
  'codigo',
  'datos',
  'prompt',
  'log',
  'mediciones',
  // Una orden y su salida (`$ curl -i …` con la respuesta; `$ npm test` con el fallo) son una sola cosa.
  'comando',
  'http',
]);

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
  const division = divisionDe(indicaciones.cuerpo, indicaciones.tipo ?? deteccion?.tipo ?? 'texto', registro, opciones);
  return {
    indicaciones,
    ...(deteccion ? { deteccion } : {}),
    secretos: oculto.hallados.length,
    ...(division ? { division } : {}),
  };
}

/** Lo que se ejecuta: lo que va detrás de una orden es su salida. */
const ORDENES: ReadonlySet<TipoElemento> = new Set(['comando', 'http']);
/** Lo que se detecta en un párrafo de prosa: un bloque así no es un elemento suelto. */
const PROSA: ReadonlySet<TipoElemento> = new Set(['texto', 'idea']);

/**
 * Si conviene ofrecer dividir: varias URL, siempre; varios bloques, si cada uno solo es algo que no es prosa (dos
 * trazas, dos curl, un error y un JSON) y el conjunto no es de un tipo con bloques propios (un código, un log con
 * huecos). Unas notas con párrafos no: sus bloques son prosa.
 */
function divisionDe(
  cuerpo: string,
  tipo: TipoElemento,
  registro: Registro,
  opciones?: OpcionesCaptura,
): Previa['division'] {
  const p = partes(cuerpo);
  if (!p) return undefined;
  if (p.via === 'bloques') {
    if (CON_BLOQUES_PROPIOS.has(tipo)) return undefined;
    const delBloque = (b: string) =>
      detectar({ texto: ocultar(b, opcionesOcultar(opciones)).texto }, registro, opcionesDetectar(opciones)).tipo;
    // Una orden seguida de lo que sigue es la orden y su salida (`$ npm test` y el fallo): una sola cosa.
    const primero = delBloque(p.partes[0] ?? '');
    if (ORDENES.has(primero) || PROSA.has(primero)) return undefined;
    // Los demás, los más cortos primero: el primero que es prosa ya decide, y detectar uno corto cuesta poco.
    const porLargo = p.partes.slice(1).sort((a, b) => a.length - b.length);
    if (porLargo.some((b) => PROSA.has(delBloque(b)))) return undefined;
  }
  return { n: p.partes.length, via: p.via };
}
