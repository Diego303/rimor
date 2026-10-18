/**
 * Migraciones del formato (plan §13.8): funciones puras de la versión N a la N+1.
 * `manifest.esquema` dice la versión de un espacio; `migrar` encadena las necesarias.
 */
import type { Manifest } from './esquemas';
import { fallo, ok, type Resultado } from './resultado';
import { ESQUEMA_ACTUAL } from './version';

export interface EspacioMigrable {
  manifest: Manifest;
  /** Ruta → contenido de cada archivo de texto del espacio. */
  archivos: Map<string, string>;
}

export type Migracion = (e: EspacioMigrable) => EspacioMigrable;

/**
 * `MIGRACIONES[n]` lleva de la versión `n` a la `n + 1`. Hoy solo existe el esquema 1, así que la lista está
 * vacía y migrar de 1 a 1 es la identidad. Al añadir el esquema 2 se añade `MIGRACIONES[1]`.
 */
export const MIGRACIONES: Readonly<Record<number, Migracion>> = {};

/** Lleva un espacio de la versión `desde` a la `hasta` (por defecto, la actual). */
export function migrar(e: EspacioMigrable, desde: number, hasta: number = ESQUEMA_ACTUAL): Resultado<EspacioMigrable> {
  if (!Number.isInteger(desde) || desde < 1) return fallo('formato.esquemaDesconocido', { esquema: desde });
  if (desde > hasta || hasta > ESQUEMA_ACTUAL)
    return fallo('formato.esquemaFuturo', { esquema: desde, actual: ESQUEMA_ACTUAL });
  let actual = e;
  for (let n = desde; n < hasta; n++) {
    const paso = MIGRACIONES[n];
    if (!paso) return fallo('formato.esquemaDesconocido', { esquema: n });
    actual = paso(actual);
  }
  return ok({ manifest: { ...actual.manifest, esquema: hasta }, archivos: actual.archivos });
}
