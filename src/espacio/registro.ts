/**
 * Un registro del espacio en un archivo JSON (los nombres de las sesiones, IN-051; las vistas guardadas, IN-054): en
 * memoria, con cada cambio escrito en orden y solo desde la pestaña que escribe. Un archivo que existe pero no se
 * entiende no se sobrescribe nunca (`ilegibles`); uno que no se pudo leer (E/S) se vuelve a leer antes de escribir
 * nada (`sinLeer`).
 */
import { type Almacen, escribirTexto, leerTexto } from '../almacen/contrato';

export type EstadoLectura = 'leidas' | 'ilegibles' | 'sinLeer';

export interface OpcionesRegistro<T> {
  almacen: Almacen;
  ruta: string;
  leer: (texto: string | null) => T | null;
  escribir: (datos: T) => string;
  inicial: T;
  /** ¿Puede escribir ahora esta pestaña (y sigue abierto el espacio)? */
  puedeEscribir: () => boolean;
  /** Tras cada cambio en memoria (la interfaz se pone al día). */
  alCambiar: () => void;
  /** Tras cada escritura (la otra pestaña relee). */
  alEscribir: () => void;
}

export interface Registro<T> {
  datos(): T;
  legible(): boolean;
  /** Un cambio: con lo leído, al momento (quien llama lee el resultado ya); si aún no se pudo leer, después de leerlo. */
  guardar(cambio: (d: T) => T): Promise<void>;
  /** Relee el archivo (otra pestaña lo cambió): una lectura que falla deja lo que había. */
  releer(): Promise<void>;
  /** Lo que está pedido de escribir. */
  esperar(): Promise<void>;
}

export class ErrorRegistroIlegible extends Error {
  constructor(ruta: string) {
    super(`${ruta} no se entiende: no se sobrescribe`);
    this.name = 'ErrorRegistroIlegible';
  }
}

export async function abrirRegistro<T>(o: OpcionesRegistro<T>): Promise<Registro<T>> {
  const leer = async (): Promise<{ datos: T; estado: EstadoLectura }> => {
    try {
      const datos = o.leer(await leerTexto(o.almacen, o.ruta));
      return datos ? { datos, estado: 'leidas' } : { datos: o.inicial, estado: 'ilegibles' };
    } catch {
      return { datos: o.inicial, estado: 'sinLeer' };
    }
  };
  let actual = await leer();
  let pendientes: Promise<void> = Promise.resolve();
  return {
    datos: () => actual.datos,
    legible: () => actual.estado !== 'ilegibles',
    guardar(cambio) {
      const aplicar = () => {
        if (actual.estado !== 'leidas') throw new ErrorRegistroIlegible(o.ruta);
        actual = { datos: cambio(actual.datos), estado: 'leidas' };
        o.alCambiar();
        return actual.datos;
      };
      const copia = actual.estado === 'leidas' ? aplicar() : null;
      pendientes = pendientes
        .catch(() => undefined)
        .then(async () => {
          if (copia !== null) return copia;
          if (actual.estado === 'sinLeer') {
            const otra = await leer();
            if (actual.estado === 'sinLeer') actual = otra;
          }
          return aplicar();
        })
        .then((d) => (o.puedeEscribir() ? escribirTexto(o.almacen, o.ruta, o.escribir(d)) : undefined))
        .then(() => o.alEscribir());
      return pendientes;
    },
    async releer() {
      const releido = await leer();
      if (releido.estado !== 'sinLeer' || actual.estado === 'sinLeer') actual = releido;
    },
    esperar: () => pendientes.catch(() => undefined),
  };
}

/** ¿Es un registro de un esquema más nuevo que el que se conoce? (Al importar, otro rechazo que «no se entiende».) */
export function esEsquemaNuevo(texto: string): boolean {
  try {
    const d = JSON.parse(texto) as { esquema?: unknown };
    return typeof d?.esquema === 'number' && d.esquema > 1;
  } catch {
    return false;
  }
}
