/**
 * Leer un ZIP por su directorio central (F0-2): no se usa `Unzip` en streaming, que con entradas de tamaño
 * desconocido no sabe dónde acaba cada una. Se leen primero todas las entradas (nombre, método, tamaños, CRC) y
 * después se infla cada una con su tamaño declarado, cortando si lo pasa (defensa contra bombas ZIP) y
 * comprobando su CRC-32. Sin ZIP64. TS puro: recibe una función que lee un trozo del archivo (`Blob.slice`).
 */
import { Inflate } from 'fflate';

/** Lee `largo` bytes desde `inicio` (un `Blob.slice` en el navegador). */
export type LeerTrozo = (inicio: number, largo: number) => Promise<Uint8Array>;

export interface EntradaZip {
  ruta: string;
  /** 0: sin comprimir; 8: DEFLATE. */
  metodo: number;
  comprimido: number;
  tam: number;
  crc: number;
  /** Dónde empieza su cabecera local. */
  local: number;
  /** Es una carpeta (termina en `/`). */
  carpeta: boolean;
}

export class ErrorZip extends Error {
  constructor(public readonly codigo: string) {
    super(codigo);
    this.name = 'ErrorZip';
  }
}

const FIRMA_FIN = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;
const FIN_MINIMO = 22;
/** Lo más que puede ocupar el final (con su comentario). */
const FIN_MAXIMO = FIN_MINIMO + 0xffff;

const u16 = (d: Uint8Array, i: number) => (d[i] ?? 0) | ((d[i + 1] ?? 0) << 8);
const u32 = (d: Uint8Array, i: number) => (u16(d, i) | (u16(d, i + 2) << 16)) >>> 0;

/** Las entradas del ZIP, de su directorio central. */
export async function entradasZip(tam: number, leer: LeerTrozo): Promise<EntradaZip[]> {
  if (tam < FIN_MINIMO) throw new ErrorZip('zip.noEsZip');
  const desde = Math.max(0, tam - FIN_MAXIMO);
  const cola = await leer(desde, tam - desde);
  let fin = -1;
  for (let i = cola.length - FIN_MINIMO; i >= 0; i--)
    if (u32(cola, i) === FIRMA_FIN) {
      fin = i;
      break;
    }
  if (fin < 0) throw new ErrorZip('zip.noEsZip');
  const n = u16(cola, fin + 10);
  const largoCentral = u32(cola, fin + 12);
  const inicioCentral = u32(cola, fin + 16);
  if (n === 0xffff || largoCentral === 0xffffffff || inicioCentral === 0xffffffff) throw new ErrorZip('zip.zip64');
  if (inicioCentral + largoCentral > desde + fin) throw new ErrorZip('zip.truncado');
  const central = await leer(inicioCentral, largoCentral);
  const entradas: EntradaZip[] = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    if (i + 46 > central.length || u32(central, i) !== FIRMA_CENTRAL) throw new ErrorZip('zip.directorioRoto');
    const largoNombre = u16(central, i + 28);
    const largoExtra = u16(central, i + 30);
    const largoComentario = u16(central, i + 32);
    const comprimido = u32(central, i + 20);
    const tamano = u32(central, i + 24);
    const local = u32(central, i + 42);
    if (comprimido === 0xffffffff || tamano === 0xffffffff || local === 0xffffffff) throw new ErrorZip('zip.zip64');
    const ruta = new TextDecoder().decode(central.subarray(i + 46, i + 46 + largoNombre));
    entradas.push({
      ruta,
      metodo: u16(central, i + 10),
      comprimido,
      tam: tamano,
      crc: u32(central, i + 16),
      local,
      carpeta: ruta.endsWith('/'),
    });
    i += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = (TABLA_CRC[(c ^ b) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Lo que trae una entrada, inflado y comprobado (tamaño y CRC). */
export async function leerEntrada(entrada: EntradaZip, leer: LeerTrozo): Promise<Uint8Array> {
  const cabecera = await leer(entrada.local, 30);
  if (u32(cabecera, 0) !== FIRMA_LOCAL) throw new ErrorZip('zip.entradaRota');
  const inicio = entrada.local + 30 + u16(cabecera, 26) + u16(cabecera, 28);
  const datos = await leer(inicio, entrada.comprimido);
  if (datos.length !== entrada.comprimido) throw new ErrorZip('zip.truncado');
  let salida: Uint8Array;
  if (entrada.metodo === 0) salida = datos;
  else if (entrada.metodo === 8) {
    salida = new Uint8Array(entrada.tam);
    let escrito = 0;
    const inflar = new Inflate((trozo) => {
      // Más de lo declarado: una bomba o un ZIP mentiroso; se corta.
      if (escrito + trozo.length > entrada.tam) throw new ErrorZip('zip.tamanoMayor');
      salida.set(trozo, escrito);
      escrito += trozo.length;
    });
    try {
      inflar.push(datos, true);
    } catch (e) {
      throw e instanceof ErrorZip ? e : new ErrorZip('zip.entradaRota');
    }
    if (escrito !== entrada.tam) throw new ErrorZip('zip.tamanoDistinto');
  } else throw new ErrorZip('zip.metodo');
  if (salida.length !== entrada.tam) throw new ErrorZip('zip.tamanoDistinto');
  if (crc32(salida) !== entrada.crc) throw new ErrorZip('zip.crc');
  return salida;
}

/** Un lector de trozos sobre bytes en memoria (pruebas) o sobre un `Blob`. */
export const trozosDe = (fuente: Uint8Array | Blob): { tam: number; leer: LeerTrozo } =>
  fuente instanceof Uint8Array
    ? { tam: fuente.length, leer: async (i, n) => fuente.subarray(i, i + n) }
    : { tam: fuente.size, leer: async (i, n) => new Uint8Array(await fuente.slice(i, i + n).arrayBuffer()) };
