/**
 * La respuesta de Rimor a una captura (CAP-14): texto en fragmentos marcados (cifras, refs, citas) y hasta dos
 * acciones. Modelo de IN-016; aquí solo los tipos, que el contrato de los lectores necesita (IN-012).
 */

export type Fragmento =
  | { t: 'texto'; v: string }
  | { t: 'fuerte'; v: string }
  | { t: 'cifra'; v: string }
  | { t: 'ref'; ref: string }
  | { t: 'cita'; v: string; fecha: string }
  | { t: 'mono'; v: string };

/**
 * Una decisión que se ofrece en un botón (`btn sm`, como todas las de `msgHTML` en la referencia). `etiqueta` llega
 * ya traducida (la compone el lector con sus textos).
 */
export interface Accion {
  id: string;
  etiqueta: string;
}

export interface Respuesta {
  texto: Fragmento[];
  acciones?: [Accion, Accion?];
}
