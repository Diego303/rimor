/** Lectura del `manifest.json` de un espacio (Anexo A). */
import * as v from 'valibot';
import { type Manifest, manifestSchema } from './esquemas';

/** Lee un manifest; `null` si no es JSON o no cumple el esquema (el espacio se trata como dañado). */
export function leerManifest(texto: string): Manifest | null {
  try {
    const r = v.safeParse(manifestSchema, JSON.parse(texto));
    return r.success ? r.output : null;
  } catch {
    return null;
  }
}
