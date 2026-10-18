/**
 * Contrato del almacén de archivos de un espacio (DAT-01): lo cumplen el adaptador en memoria y el de OPFS.
 * Las rutas son relativas a la raíz del espacio, con «/», sin «..», sin «/» inicial ni segmentos vacíos.
 */

export interface EntradaAlmacen {
  ruta: string;
  tam: number;
  /** Milisegundos desde 1970. */
  modificado: number;
}

export interface Almacen {
  leer(ruta: string): Promise<Uint8Array | null>;
  /** Atómica: el archivo queda en su versión anterior o en la nueva, nunca a medias. */
  escribir(ruta: string, datos: Uint8Array): Promise<void>;
  mover(de: string, a: string): Promise<void>;
  /** Borrar algo que no existe no es un error. */
  borrar(ruta: string): Promise<void>;
  /** Archivos cuya ruta empieza por `prefijo` (vacío: todos), en cualquier orden. */
  listar(prefijo: string): AsyncIterable<EntradaAlmacen>;
  existe(ruta: string): Promise<boolean>;
}

/** Comprueba que una ruta es segura y normalizada. Una ruta mala es un error de programación: lanza. */
export function validarRuta(ruta: string): string {
  if (!ruta || ruta.startsWith('/') || ruta.endsWith('/') || ruta.includes('\\') || ruta.includes('\0'))
    throw new Error(`Ruta no válida: «${ruta}»`);
  for (const segmento of ruta.split('/')) {
    if (!segmento || segmento === '.' || segmento === '..') throw new Error(`Ruta no válida: «${ruta}»`);
  }
  // Sufijos reservados para la escritura atómica de OPFS.
  if (ruta.endsWith('.rimor-tmp') || ruta.endsWith('.rimor-ok')) throw new Error(`Ruta reservada: «${ruta}»`);
  return ruta;
}

const codificador = new TextEncoder();
const decodificador = new TextDecoder();

export async function leerTexto(almacen: Almacen, ruta: string): Promise<string | null> {
  const datos = await almacen.leer(ruta);
  return datos ? decodificador.decode(datos) : null;
}

export function escribirTexto(almacen: Almacen, ruta: string, texto: string): Promise<void> {
  return almacen.escribir(ruta, codificador.encode(texto));
}

/** Recoge un `listar` en una lista. */
export async function listarTodo(almacen: Almacen, prefijo = ''): Promise<EntradaAlmacen[]> {
  const salida: EntradaAlmacen[] = [];
  for await (const e of almacen.listar(prefijo)) salida.push(e);
  return salida;
}
