/** El `manifest.json` de un espacio (plan Anexo A): formato, versión de esquema, espacio, fechas y app. */
import { ESQUEMA_ACTUAL, isoConZona, type Manifest, ulid } from '@rimor/formato';

export const RUTA_MANIFEST = 'manifest.json';
export const NOMBRE_ESPACIO_INICIAL = 'Trabajo';

export function crearManifest(nombre: string, ahora: Date, id: string = ulid()): Manifest {
  return {
    formato: 'rimor',
    esquema: ESQUEMA_ACTUAL,
    espacio: { id, nombre },
    creado: isoConZona(ahora),
    app: { version: __VERSION_APP__ },
    recuentos: { elementos: 0, investigaciones: 0, documentos: 0, adjuntos: 0 },
    adjuntos_excluidos: [],
  };
}
