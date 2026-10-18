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
    if (regla.buscar) {
      for (const [inicio, fin] of regla.buscar(texto))
        if (fin > inicio)
          candidatos.push({ regla: regla.id, tipo: regla.tipo, posicion: inicio, longitud: fin - inicio });
      continue;
    }
    if (!regla.patron) continue;
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

/** Una sustitución hecha: tramo en el texto de entrada de la pasada y tramo de la marca en su salida. */
interface Cambio {
  entrada: [number, number];
  salida: [number, number];
}

function sustituir(texto: string, hallados: Hallazgo[]): { texto: string; cambios: Cambio[] } {
  let salida = '';
  let desde = 0;
  const cambios: Cambio[] = [];
  for (const h of hallados) {
    salida += texto.slice(desde, h.posicion);
    const m = marca(h.tipo);
    cambios.push({ entrada: [h.posicion, h.posicion + h.longitud], salida: [salida.length, salida.length + m.length] });
    salida += m;
    desde = h.posicion + h.longitud;
  }
  return { texto: salida + texto.slice(desde), cambios };
}

/** Lleva una posición de la salida de una pasada a su entrada (dentro de una marca: a su principio o su final). */
function haciaAtras(p: number, cambios: Cambio[], final: boolean): number {
  let delta = 0;
  for (const c of cambios) {
    if (p >= c.salida[1]) delta += c.entrada[1] - c.entrada[0] - (c.salida[1] - c.salida[0]);
    else if (p > c.salida[0]) return final ? c.entrada[1] : c.entrada[0];
    else break;
  }
  return p + delta;
}

/**
 * Oculta los secretos de un texto. `ocultar(ocultar(t).texto).texto === ocultar(t).texto`: algunas reglas miran
 * lo que rodea al secreto, y una sustitución puede dejar a la vista otro (una clave pegada a un bloque PEM), así
 * que se repite hasta que no queda nada. Las posiciones de los hallazgos son siempre las del texto de entrada.
 */
export function ocultar(texto: string, opciones: OpcionesOcultar = {}): Ocultado {
  const hallados: Hallazgo[] = [];
  const pasadas: Cambio[][] = [];
  let actual = texto;
  for (let pasada = 0; pasada < 8; pasada++) {
    const nuevos = buscarSecretos(actual, opciones);
    if (!nuevos.length) break;
    for (const h of nuevos) {
      let inicio = h.posicion;
      let fin = h.posicion + h.longitud;
      for (let k = pasadas.length - 1; k >= 0; k--) {
        inicio = haciaAtras(inicio, pasadas[k] as Cambio[], false);
        fin = haciaAtras(fin, pasadas[k] as Cambio[], true);
      }
      hallados.push({ ...h, posicion: inicio, longitud: fin - inicio });
    }
    const { texto: siguiente, cambios } = sustituir(actual, nuevos);
    pasadas.push(cambios);
    actual = siguiente;
  }
  hallados.sort((a, b) => a.posicion - b.posicion);
  return { texto: actual, hallados };
}
