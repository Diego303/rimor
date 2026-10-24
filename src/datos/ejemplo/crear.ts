/**
 * Crear el espacio de ejemplo (APP-03): genera su ZIP (en diferido: el generador y sus fixtures no pesan en la carga
 * inicial) y lo importa como espacio nuevo, apuntado entre los conocidos para abrirlo o borrarlo desde Datos y copias.
 */
import type { Almacen } from '../../almacen/contrato';
import type { Registro } from '../../lectores/registro';
import { type EspacioImportable, importar } from '../importar/importacion';
import { leerPaquete } from '../importar/paquete';
import { planear } from '../importar/plan';

export interface OpcionesEjemplo {
  crearAlmacen: (id: string) => Promise<Almacen & { cerrar?: () => void; esperar?: () => Promise<void> }>;
  alCrearEspacio?: (id: string, nombre: string) => void;
  /** Si falla a medias, se borra lo escrito. */
  alFallarEspacio?: (id: string) => Promise<void>;
  /** El nombre del espacio (en el idioma de la interfaz). */
  nombre?: string;
}

/** Crea el espacio de ejemplo y devuelve su id y su nombre. */
export async function crearEspacioDeEjemplo(
  espacio: EspacioImportable,
  registro: Registro,
  o: OpcionesEjemplo,
): Promise<{ id: string; nombre: string }> {
  const { NOMBRE_EJEMPLO, zipDeEjemplo } = await import('./ejemplo');
  const nombre = o.nombre ?? NOMBRE_EJEMPLO;
  const paquete = await leerPaquete(await zipDeEjemplo(registro, new Date(), nombre), 'ejemplo.zip');
  const plan = await planear(paquete.archivos, paquete.manifest, {
    elementos: [],
    entidades: [],
    leer: async () => null,
  });
  const hecho = await importar(espacio, { paquete, plan }, 'nuevo', {
    copiaPrevia: async () => true,
    crearAlmacen: o.crearAlmacen,
    nombre,
    ...(o.alCrearEspacio ? { alCrearEspacio: o.alCrearEspacio } : {}),
    ...(o.alFallarEspacio ? { alFallarEspacio: o.alFallarEspacio } : {}),
  });
  if (hecho.modo !== 'nuevo') throw new Error('ejemplo.noCreado');
  return { id: hecho.id, nombre: hecho.nombre };
}
