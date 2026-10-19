/**
 * Vaciar la papelera con una copia antes (ORG-07): un ZIP con lo que hay en ella (los `.md` y los adjuntos que
 * solo usan ellos, con sus rutas en el espacio) y, solo cuando se ha entregado, el borrado de lo copiado. IN-035
 * cambiará la copia por su ZIP completo en un Worker.
 */
import { isoConZona, slug } from '@rimor/formato';
import { type Zippable, zipSync } from 'fflate';
import type { Repositorio } from '../almacen/repositorio';

/** Los adjuntos (binarios, a menudo ya comprimidos) van tal cual; el texto, comprimido. */
const NIVEL_TEXTO = 6;

/** Un ZIP con los archivos en sus rutas. */
export function zipDeArchivos(archivos: readonly { ruta: string; datos: Uint8Array }[]): Uint8Array {
  const arbol: Zippable = {};
  for (const { ruta, datos } of archivos) arbol[ruta] = [datos, { level: ruta.endsWith('.md') ? NIVEL_TEXTO : 0 }];
  return zipSync(arbol);
}

/** «rimor-trabajo-papelera-2026-10-19.zip». */
export const nombreZipPapelera = (espacio: string, fecha: Date): string =>
  `rimor-${/[\p{L}\p{N}]/u.test(espacio) ? slug(espacio) : 'espacio'}-papelera-${isoConZona(fecha).slice(0, 10)}.zip`;

/**
 * Copia en un ZIP lo que hay ahora en la papelera, lo entrega a `guardar` (la descarga) y borra solo lo copiado.
 * Si el ZIP no se puede hacer o entregar, no se borra nada. Devuelve cuántos elementos se borraron.
 */
export async function vaciarConCopia(repositorio: Repositorio, guardar: (zip: Uint8Array) => void): Promise<number> {
  const ids = repositorio.enPapelera().map((fm) => fm.id);
  if (!ids.length) return 0;
  const zip = zipDeArchivos(await repositorio.archivosDePapelera(ids));
  guardar(zip);
  return repositorio.vaciarPapelera(ids);
}
