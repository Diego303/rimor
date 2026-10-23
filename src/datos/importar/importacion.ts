/**
 * Importar en el espacio abierto (DAT-04): comprobar un archivo (leerlo, validarlo y planear) y aplicarlo con el
 * modo elegido. Reemplazar exige la copia previa; un espacio nuevo se escribe en otra carpeta de OPFS y se abre
 * recargando la app. Después, el espacio lo relee todo (y el índice de búsqueda se pone al día solo).
 */
import { type Manifest, ulid } from '@rimor/formato';
import { create } from 'zustand';
import type { Almacen } from '../../almacen/contrato';
import type { EspacioAbierto } from '../../espacio/abrir';
import { enEspacioNuevo, fusionar, type ModoImportar, manifestNuevo, reemplazar } from './aplicar';
import { leerPaquete, type Paquete } from './paquete';
import { type EspacioLocal, type Plan, planear } from './plan';

/** El archivo elegido en Datos y copias, para la pantalla Importar (un `File` no cabe en la dirección). */
export const useArchivoImportar = create<{ archivo: File | null }>(() => ({ archivo: null }));

export type EspacioImportable = Pick<
  EspacioAbierto,
  'almacen' | 'repositorio' | 'entidades' | 'esperarEscrituras' | 'recargar' | 'manifest'
>;

/** Lo que el plan necesita del espacio: sus elementos (también los de la papelera) y sus entidades. */
export function localDe(espacio: EspacioImportable): EspacioLocal {
  const elementos = [...espacio.repositorio.entradas()].flatMap((e) => {
    const fm = espacio.repositorio.frontmatter(e.id);
    return fm ? [{ id: e.id, ref: e.ref, alias: fm.alias ?? [], ruta: e.ruta, modificado: fm.modificado }] : [];
  });
  return { elementos, entidades: espacio.entidades.entradas(), leer: (ruta) => espacio.almacen.leer(ruta) };
}

export interface Comprobado {
  paquete: Paquete;
  plan: Plan;
}

/** Lee, valida y planea. Lanza `ErrorImportar` (regla y archivo) si el archivo no se puede importar. */
export async function comprobar(espacio: EspacioImportable, archivo: Blob, nombre: string): Promise<Comprobado> {
  const paquete = await leerPaquete(archivo, nombre);
  return { paquete, plan: await planear(paquete.archivos, paquete.manifest, localDe(espacio)) };
}

export interface OpcionesImportar {
  /** Descarga el ZIP de lo que hay (devuelve si se pudo): obligatorio antes de reemplazar. */
  copiaPrevia: () => Promise<boolean>;
  /** Abre el almacén de un espacio nuevo (en el navegador, su carpeta de OPFS). */
  crearAlmacen?: (id: string) => Promise<Almacen & { cerrar?: () => void; esperar?: () => Promise<void> }>;
  reloj?: () => Date;
}

export type Importado = { modo: 'fusionar' | 'reemplazar'; plan: Plan } | { modo: 'nuevo'; id: string; nombre: string };

/** Aplica el modo. Reemplazar sin copia previa no toca nada (`importar.sinCopia`). */
export async function importar(
  espacio: EspacioImportable,
  { paquete }: Comprobado,
  modo: ModoImportar,
  o: OpcionesImportar,
): Promise<Importado> {
  if (modo === 'nuevo') {
    if (!o.crearAlmacen) throw new Error('importar.sinEspacioNuevo');
    const id = ulid();
    const nombre = `${paquete.manifest.espacio.nombre} (importado)`;
    const almacen = await o.crearAlmacen(id);
    try {
      const manifest: Manifest = manifestNuevo(paquete.manifest, nombre, (o.reloj ?? (() => new Date()))(), id);
      await enEspacioNuevo(almacen, paquete, manifest);
      await almacen.esperar?.();
    } finally {
      almacen.cerrar?.();
    }
    return { modo, id, nombre };
  }
  await espacio.esperarEscrituras();
  if (modo === 'reemplazar') {
    if (!(await o.copiaPrevia())) throw new Error('importar.sinCopia');
    await reemplazar(espacio.almacen, paquete);
    await espacio.recargar();
    return {
      modo,
      plan: await planear(paquete.archivos, paquete.manifest, { elementos: [], entidades: [], leer: async () => null }),
    };
  }
  // El plan, otra vez con lo de ahora: pudo cambiar algo mientras se miraba la vista previa.
  const plan = await planear(paquete.archivos, paquete.manifest, localDe(espacio));
  await fusionar(espacio.almacen, plan);
  await espacio.recargar();
  return { modo, plan };
}
