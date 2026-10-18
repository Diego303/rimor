/// <reference lib="webworker" />
/** Worker del almacén: OPFS con accesos síncronos, fuera del hilo de la interfaz (IN-005, F0-1). */
import { expose } from 'comlink';
import { listarTodo } from '../almacen/contrato';
import { AlmacenOpfs } from '../almacen/opfs/opfs';

let almacen: AlmacenOpfs | null = null;

function abierto(): AlmacenOpfs {
  if (!almacen) throw new Error('Almacén sin abrir');
  return almacen;
}

const api = {
  /** Abre `espacios/<espacio>/` en OPFS. */
  async abrir(espacio: string): Promise<void> {
    const raiz = await navigator.storage.getDirectory();
    const espacios = await raiz.getDirectoryHandle('espacios', { create: true });
    almacen = new AlmacenOpfs(await espacios.getDirectoryHandle(espacio, { create: true }));
  },
  /** Termina o deshace escrituras cortadas. Solo la pestaña que escribe (con el cerrojo de IN-005). */
  limpiarHuerfanos: () => abierto().limpiarHuerfanos(),
  leer: (ruta: string) => abierto().leer(ruta),
  escribir: (ruta: string, datos: Uint8Array) => abierto().escribir(ruta, datos),
  mover: (de: string, a: string) => abierto().mover(de, a),
  borrar: (ruta: string) => abierto().borrar(ruta),
  existe: (ruta: string) => abierto().existe(ruta),
  listar: (prefijo: string) => listarTodo(abierto(), prefijo),
};

export type ApiAlmacenWorker = typeof api;

expose(api);
