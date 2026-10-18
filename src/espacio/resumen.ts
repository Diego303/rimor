/** Lo que la carcasa pinta del espacio (raíl): nombre, «Sin clasificar», colecciones y estado de la copia. Puro. */
import type { FrontmatterComun, Manifest } from '@rimor/formato';
import type { ColeccionRail, EstadoEspacio } from '../estado/espacio';
import type { EstadoCuidado } from './estado';

/** Umbrales del recordatorio de copia (IN-037 los hará configurables en Ajustes). */
export const UMBRALES_COPIA = { cambios: 50, dias: 7 } as const;
const DIA = 86_400_000;

/** Lo capturado que no está en ninguna colección, hilo ni investigación, y no está archivado (ORG-01). */
export function sinClasificar(fm: FrontmatterComun): boolean {
  return !fm.colecciones?.length && !fm.hilo && !fm.investigaciones?.length && fm.estado !== 'archivado';
}

/** La copia está al día si existe y no han pasado ni 50 cambios ni 7 días desde ella. */
export function copiaAlDia(e: EstadoCuidado, ahora: Date, umbrales = UMBRALES_COPIA): boolean {
  if (!e.ultimaCopia) return false;
  const desde = Date.parse(e.ultimaCopia);
  return (
    Number.isFinite(desde) && e.cambiosDesdeCopia < umbrales.cambios && ahora.getTime() - desde < umbrales.dias * DIA
  );
}

export function resumenParaCarcasa(
  manifest: Manifest,
  elementos: readonly FrontmatterComun[],
  estado: EstadoCuidado,
  ahora: Date = new Date(),
): Omit<EstadoEspacio, 'soloLectura'> {
  const recuentos = new Map<string, number>();
  for (const fm of elementos) for (const c of fm.colecciones ?? []) recuentos.set(c, (recuentos.get(c) ?? 0) + 1);
  const colecciones: ColeccionRail[] = [...recuentos]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([nombre, recuento]) => ({ id: nombre, nombre, recuento }));
  return {
    nombre: manifest.espacio.nombre,
    sinClasificar: elementos.filter(sinClasificar).length,
    colecciones,
    ultimaCopia: estado.ultimaCopia,
    copiaAlDia: copiaAlDia(estado, ahora),
  };
}
