/**
 * Ocultación de secretos (CAP-05): sustituye cada secreto por `‹oculto:tipo›` antes de que nada llegue al
 * disco. Pura e idempotente. Nunca devuelve ni guarda el valor original.
 */
import { REGLAS_SECRETOS, type ReglaSecreto } from './reglas';

export interface Hallazgo {
  regla: string;
  tipo: string;
  /** Posición del secreto en el texto de entrada. */
  posicion: number;
  longitud: number;
}

export interface Ocultado {
  texto: string;
  hallados: Hallazgo[];
}

export interface OpcionesOcultar {
  /** Reglas desactivadas (en Ajustes o solo para este pegado, desde el compositor). */
  desactivadas?: ReadonlySet<string>;
  reglas?: readonly ReglaSecreto[];
}

export const marca = (tipo: string) => `‹oculto:${tipo}›`;

/** Busca los secretos de un texto sin cambiarlo. Si dos reglas se solapan, gana la que empieza antes (y la más larga). */
export function buscarSecretos(texto: string, opciones: OpcionesOcultar = {}): Hallazgo[] {
  const candidatos: Hallazgo[] = [];
  for (const regla of opciones.reglas ?? REGLAS_SECRETOS) {
    if (opciones.desactivadas?.has(regla.id)) continue;
    for (const m of texto.matchAll(regla.patron)) {
      const grupo = m.indices?.groups?.secreto;
      const [inicio, final] = grupo ?? [m.index ?? 0, (m.index ?? 0) + m[0].length];
      const longitud = final - inicio;
      if (longitud > 0) candidatos.push({ regla: regla.id, tipo: regla.tipo, posicion: inicio, longitud });
    }
  }
  candidatos.sort((a, b) => a.posicion - b.posicion || b.longitud - a.longitud);
  const elegidos: Hallazgo[] = [];
  let fin = -1;
  for (const c of candidatos) {
    if (c.posicion < fin) continue;
    elegidos.push(c);
    fin = c.posicion + c.longitud;
  }
  return elegidos;
}

/** Oculta los secretos de un texto. `ocultar(ocultar(t).texto).texto === ocultar(t).texto`. */
export function ocultar(texto: string, opciones: OpcionesOcultar = {}): Ocultado {
  const hallados = buscarSecretos(texto, opciones);
  let salida = '';
  let desde = 0;
  for (const h of hallados) {
    salida += texto.slice(desde, h.posicion) + marca(h.tipo);
    desde = h.posicion + h.longitud;
  }
  return { texto: salida + texto.slice(desde), hallados };
}
