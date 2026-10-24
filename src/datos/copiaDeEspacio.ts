/**
 * La copia previa de otro espacio (§13.7): antes de borrarlo, se abre su carpeta solo para leer, se exporta su ZIP
 * completo y se descarga. Si algo falla, quien llama no borra nada.
 */
import type { Almacen } from '../almacen/contrato';
import { descargarBlob } from '../lectores/descargar';

export async function descargarCopiaDeEspacio(
  id: string,
  nombre: string,
  motivo: string,
  crearAlmacen: (id: string) => Promise<Almacen & { cerrar?: () => void }>,
): Promise<void> {
  const almacen = await crearAlmacen(id);
  try {
    const { exportarZip, nombreExportacion } = await import('./exportar');
    const ahora = new Date();
    const { trozos } = await exportarZip(almacen, { ahora, version: __VERSION_APP__ });
    descargarBlob(
      new Blob(trozos as Uint8Array<ArrayBuffer>[], { type: 'application/zip' }),
      nombreExportacion(nombre, ahora, 'zip', motivo),
    );
  } finally {
    almacen.cerrar?.();
  }
}
