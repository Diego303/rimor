/** Nombres de archivo y rutas del espacio (plan §13.2 y §13.3). */
import { CARPETAS, type TipoEntidad } from './tipos';

const LARGO_SLUG = 60;

/** Título en minúsculas, sin tildes ni emojis, con guiones: «Timeout en streaming» → `timeout-en-streaming`. */
export function slug(titulo: string): string {
  const base = titulo
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!base) return 'sin-titulo';
  if (base.length <= LARGO_SLUG) return base;
  const corte = base.slice(0, LARGO_SLUG + 1);
  const ultimo = corte.lastIndexOf('-');
  // Sin partir palabras, salvo que la primera ya pase del límite.
  return (ultimo > 0 ? corte.slice(0, ultimo) : base.slice(0, LARGO_SLUG)).replace(/-+$/, '');
}

/** `LOG-0042--timeout-en-streaming.md`. */
export function nombreArchivo(ref: string, titulo: string): string {
  return `${ref}--${slug(titulo)}.md`;
}

/** Año y mes del propio texto ISO (con la zona del usuario), no de UTC. */
function anioMes(creado: string): [string, string] {
  const m = /^(\d{4})-(\d{2})/.exec(creado);
  return m ? [m[1] ?? '0000', m[2] ?? '00'] : ['0000', '00'];
}

/** Ruta de un elemento: `elementos/AAAA/MM/REF--titulo.md`. */
export function rutaElemento(ref: string, titulo: string, creado: string): string {
  const [anio, mes] = anioMes(creado);
  return `${CARPETAS.elemento}/${anio}/${mes}/${nombreArchivo(ref, titulo)}`;
}

/** Ruta de una entidad sin fecha: `hilos/HIL-0007--titulo.md`, `comparaciones/…`. */
export function rutaEntidad(tipo: TipoEntidad, ref: string, titulo: string): string {
  return `${CARPETAS[tipo]}/${nombreArchivo(ref, titulo)}`;
}

/** Ruta de un adjunto por su hash: `adjuntos/3f/3fa2c9….log`. */
export function rutaAdjunto(hashHex: string, extension: string): string {
  const ext = extension
    .replace(/^\./, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return `adjuntos/${hashHex.slice(0, 2)}/${hashHex}${ext ? `.${ext}` : ''}`;
}

/** Ruta de una versión anterior: `historial/PRM-0012/2026-10-17T18-05-12.md`. */
export function rutaHistorial(ref: string, fecha: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(fecha);
  const sello = m ? `${m[1]}T${m[2]}-${m[3]}-${m[4] ?? '00'}` : fecha.replace(/[^\w-]/g, '-');
  return `historial/${ref}/${sello}.md`;
}
