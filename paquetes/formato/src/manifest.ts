/** Lectura del `manifest.json` de un espacio (Anexo A) y de `colecciones.json`. */
import * as v from 'valibot';
import { type Colecciones, coleccionesSchema, type Manifest, manifestSchema } from './esquemas';

/** Lee un manifest; `null` si no es JSON o no cumple el esquema (el espacio se trata como dañado). */
export function leerManifest(texto: string): Manifest | null {
  try {
    const r = v.safeParse(manifestSchema, JSON.parse(texto));
    return r.success ? r.output : null;
  } catch {
    return null;
  }
}

/** Lee `colecciones.json`; `null` si no es JSON o no cumple el esquema (no se pisa: puede ser de otra versión). */
export function leerColecciones(texto: string): Colecciones | null {
  try {
    const r = v.safeParse(coleccionesSchema, JSON.parse(texto));
    return r.success ? r.output : null;
  } catch {
    return null;
  }
}
