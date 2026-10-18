/** Firma de un binario por sus primeros bytes (atajo del Anexo D, puesto 2). TS puro. */

export type Firma = 'png' | 'jpeg' | 'gif' | 'webp' | 'pdf' | 'parquet' | 'zip';

/** Bytes que hacen falta para reconocer cualquier firma de la lista. */
export const BYTES_FIRMA = 12;

/** Bytes del principio de un archivo que se pasan al detector: la firma y una muestra para saber si es texto. */
export const BYTES_CABECERA = 1024;

const empieza = (b: Uint8Array, firma: readonly number[], desde = 0) =>
  b.length >= desde + firma.length && firma.every((x, i) => b[desde + i] === x);

const ascii = (texto: string) => [...texto].map((c) => c.charCodeAt(0));

/** La firma de `cabecera`, o `null` si no es ninguna conocida. */
export function firmaDe(cabecera: Uint8Array): Firma | null {
  if (empieza(cabecera, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (empieza(cabecera, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (empieza(cabecera, ascii('GIF87a')) || empieza(cabecera, ascii('GIF89a'))) return 'gif';
  if (empieza(cabecera, ascii('RIFF')) && empieza(cabecera, ascii('WEBP'), 8)) return 'webp';
  if (empieza(cabecera, ascii('%PDF-'))) return 'pdf';
  if (empieza(cabecera, ascii('PAR1'))) return 'parquet';
  if (empieza(cabecera, [0x50, 0x4b, 0x03, 0x04])) return 'zip';
  return null;
}

export type Codificacion = 'utf-8' | 'utf-16le' | 'utf-16be' | 'windows-1252';

/** Bytes de control que no aparecen en un texto (todo lo menor de 0x20 salvo tab, saltos y avance de página). */
const esControl = (b: number) => (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0c && b !== 0x0d) || b === 0x7f;

function utf8Valido(bytes: Uint8Array, muestra: boolean): boolean {
  try {
    // En una muestra, una secuencia cortada al final vale (`stream`); en el archivo entero, no.
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: muestra });
    return true;
  } catch {
    return false;
  }
}

/** UTF-16 sin BOM: la mitad de los bytes (los de un lado) son nulos, como en el texto ASCII de Windows. */
function utf16SinBom(bytes: Uint8Array): Codificacion | null {
  const n = Math.min(bytes.length - (bytes.length % 2), 4096);
  // Con pocos bytes, un par de nulos no dice nada.
  if (n < 16) return null;
  let paresNulos = 0;
  let imparesNulos = 0;
  for (let i = 0; i < n; i += 2) {
    if (bytes[i] === 0) paresNulos++;
    if (bytes[i + 1] === 0) imparesNulos++;
  }
  const mitad = n / 2;
  if (imparesNulos > mitad * 0.4 && paresNulos < mitad * 0.05) return 'utf-16le';
  if (paresNulos > mitad * 0.4 && imparesNulos < mitad * 0.05) return 'utf-16be';
  return null;
}

/**
 * Codificación de texto de unos bytes, o `null` si son binarios: UTF-8 (con o sin BOM), UTF-16 (con BOM o
 * por su patrón de nulos) o, si no es UTF-8 pero no tiene bytes de control, Windows-1252 (Latin-1 y la
 * mayoría de archivos antiguos de Windows). Así un `.env` en UTF-16 o un `.ini` en Latin-1 se tratan como texto
 * y pasan por la ocultación de secretos. Con `muestra`, los bytes son el principio del archivo.
 */
export function codificacionDe(bytes: Uint8Array, muestra = false): Codificacion | null {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  if (bytes.includes(0)) return utf16SinBom(bytes);
  if (utf8Valido(bytes, muestra)) return 'utf-8';
  return bytes.some(esControl) ? null : 'windows-1252';
}

/** ¿Parecen texto estos bytes (el principio de un archivo)? */
export const pareceTexto = (bytes: Uint8Array): boolean => codificacionDe(bytes, true) !== null;

/**
 * El texto de un archivo entero, o `null` si es binario. Se decide con todos sus bytes: una «ñ» en Latin-1
 * pasado el primer KB no se convierte en «�», y un binario con un KB de texto delante no pasa por texto.
 */
export function decodificarTexto(bytes: Uint8Array): { texto: string; codificacion: Codificacion } | null {
  const codificacion = codificacionDe(bytes);
  if (!codificacion) return null;
  // El BOM no es parte del texto (TextDecoder lo quita en UTF-8 y UTF-16).
  const texto = new TextDecoder(codificacion).decode(bytes);
  // Un UTF-16 adivinado que deja caracteres de control no era texto.
  if (codificacion.startsWith('utf-16') && [...texto].some((c) => esControl(c.charCodeAt(0)))) return null;
  return { texto, codificacion };
}

export const esImagen = (f: Firma | null): boolean => f === 'png' || f === 'jpeg' || f === 'gif' || f === 'webp';
