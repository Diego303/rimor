/**
 * Vaciar la papelera con una copia antes (ORG-07): un ZIP con lo que hay en ella (los `.md` y los adjuntos que
 * solo usan ellos, con sus rutas en el espacio), que se descarga antes de borrar nada; al vaciar se borra solo lo
 * copiado. IN-035 cambiará la copia por su ZIP completo en un Worker.
 */
import { isoConZona, slug } from '@rimor/formato';
import { type Zippable, zipSync } from 'fflate';
import type { CopiaPapelera, Repositorio } from '../almacen/repositorio';

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

/** El ZIP de la papelera y lo que entró en él (lo único que se borrará al vaciarla). */
export interface CopiaZip extends Pick<CopiaPapelera, 'ids' | 'adjuntos'> {
  zip: Uint8Array;
}

/**
 * Prepara el ZIP con lo que hay ahora en la papelera, o `null` si está vacía. Vaciar es otro paso: el navegador no
 * dice si una descarga llegó a guardarse, así que se descarga con un clic y después se vacía con otro, borrando
 * solo lo que entró en el ZIP (`repositorio.vaciarPapelera(copia)`).
 */
export async function prepararCopia(repositorio: Repositorio): Promise<CopiaZip | null> {
  const copia = await repositorio.copiaDePapelera();
  if (!copia.ids.length) return null;
  return { ids: copia.ids, adjuntos: copia.adjuntos, zip: zipDeArchivos(copia.archivos) };
}
