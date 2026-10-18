/** Firma de un binario por sus primeros bytes (atajo del Anexo D, puesto 2). TS puro. */

export type Firma = 'png' | 'jpeg' | 'gif' | 'webp' | 'pdf' | 'parquet' | 'zip';

/** Bytes que hacen falta para reconocer cualquier firma de la lista. */
export const BYTES_FIRMA = 12;

/** Bytes del principio de un archivo que se pasan al detector: la firma y una muestra para saber si es texto. */
export const BYTES_CABECERA = 1024;

/**
 * ¿Parecen texto estos bytes? Sin bytes nulos y UTF-8 válido (una secuencia cortada al final de la muestra
 * vale). Así un `.ts` con MIME `video/mp2t` o un `.toml` sin MIME llegan a su lector, y un SQLite no.
 */
export function pareceTexto(bytes: Uint8Array): boolean {
  if (bytes.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
    return true;
  } catch {
    return false;
  }
}

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

export const esImagen = (f: Firma | null): boolean => f === 'png' || f === 'jpeg' || f === 'gif' || f === 'webp';
