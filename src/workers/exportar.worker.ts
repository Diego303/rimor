/// <reference lib="webworker" />
/**
 * Worker de exportación (IN-035, F0-2): abre en OPFS la carpeta del espacio solo para leer (con `getFile()`, que no
 * toma el cerrojo del almacén) y genera el ZIP o el JSON sin cargar el hilo de la interfaz.
 */
import { expose } from 'comlink';
import { AlmacenOpfs } from '../almacen/opfs/opfs';
import { exportarJson, exportarZip, type ProgresoExportacion } from '../datos/exportar';

const api = {
  async exportar(
    espacio: string,
    tipo: 'zip' | 'json',
    o: { ahora: Date; version: string },
    alProgreso?: (p: ProgresoExportacion) => void,
  ) {
    const raiz = await navigator.storage.getDirectory();
    const espacios = await raiz.getDirectoryHandle('espacios');
    const almacen = new AlmacenOpfs(await espacios.getDirectoryHandle(espacio));
    const opciones = { ...o, ...(alProgreso ? { alProgreso } : {}) };
    if (tipo === 'zip') {
      const { trozos, manifest } = await exportarZip(almacen, opciones);
      return {
        blob: new Blob(trozos as Uint8Array<ArrayBuffer>[], { type: 'application/zip' }),
        manifest,
        excluidos: [],
      };
    }
    const { texto, manifest, excluidos } = await exportarJson(almacen, opciones);
    return { blob: new Blob([texto], { type: 'application/json' }), manifest, excluidos };
  },
};

export type ApiExportar = typeof api;

expose(api);
