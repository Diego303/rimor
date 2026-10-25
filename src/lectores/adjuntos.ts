/** Adjuntos de texto de los elementos (originales de más de 2 MB), para derivar y para pintar. TS puro. */
import type { Elemento } from '@rimor/formato';
import type { Repositorio } from '../almacen/repositorio';
import { decodificarTexto } from '../captura/firmas';

/**
 * El texto de un adjunto, si lo es (por su contenido, como al capturar: un `.jsonl` o un `.log` sin MIME de
 * texto también); `null` si es binario. Si el adjunto no está, lanza: el derivado no se calcula sobre nada.
 */
/** Los bytes de un adjunto (un Parquet, para derivar); si no está, lanza. */
export async function cargarBytesAdjunto(repositorio: Repositorio, el: Elemento): Promise<Uint8Array | null> {
  const a = el.frontmatter.adjunto;
  if (!a) return null;
  const bytes = await repositorio.leerAdjunto(a.ruta);
  if (!bytes) throw new Error('almacen.adjuntoNoEncontrado');
  return bytes;
}

export async function cargarTextoAdjunto(repositorio: Repositorio, el: Elemento): Promise<string | null> {
  const a = el.frontmatter.adjunto;
  if (!a) return null;
  const bytes = await repositorio.leerAdjunto(a.ruta);
  if (!bytes) throw new Error('almacen.adjuntoNoEncontrado');
  return decodificarTexto(bytes)?.texto ?? null;
}
