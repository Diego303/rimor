/**
 * Vistas guardadas (ORG-11, IN-054): una búsqueda con nombre que funciona como una colección que se llena sola. Van en
 * `vistas.json`, en la raíz del espacio (viaja en el ZIP; al importar se juntan). TS puro.
 */
import { isoConZona } from '@rimor/formato';

export const RUTA_VISTAS = 'vistas.json';
export const LARGO_NOMBRE = 80;
export const LARGO_CONSULTA = 500;

export interface Vista {
  /** Sale del nombre al crearla y no cambia (la dirección `/v/id` sigue valiendo al renombrarla). */
  id: string;
  nombre: string;
  /** La consulta de Buscar (`tipo:error ureq`). */
  consulta: string;
  creada: string;
}

export interface DatosVistas {
  esquema: 1;
  vistas: Vista[];
}

export const VISTAS_INICIALES: DatosVistas = Object.freeze({ esquema: 1, vistas: [] }) as DatosVistas;

const limpio = (s: string, largo: number) => s.replace(/\s+/g, ' ').trim().slice(0, largo).trim();

/** El id de un nombre: sin acentos, en minúsculas, con guiones; `vista` si no queda nada. */
export function idDeNombre(nombre: string): string {
  const base = nombre
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return base || 'vista';
}

/** Lee el archivo; `null` si existe pero no se entiende o es de un esquema más nuevo (no se sobrescribe). */
export function leerVistas(texto: string | null): DatosVistas | null {
  if (!texto) return { esquema: 1, vistas: [] };
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  if (typeof o.esquema === 'number' && o.esquema > 1) return null;
  const vistos = new Set<string>();
  const vistas: Vista[] = [];
  for (const v of Array.isArray(o.vistas) ? o.vistas : []) {
    if (typeof v !== 'object' || v === null) continue;
    const x = v as Record<string, unknown>;
    if (typeof x.id !== 'string' || !x.id || vistos.has(x.id)) continue;
    const nombre = typeof x.nombre === 'string' ? limpio(x.nombre, LARGO_NOMBRE) : '';
    const consulta = typeof x.consulta === 'string' ? limpio(x.consulta, LARGO_CONSULTA) : '';
    if (!nombre || !consulta) continue;
    vistos.add(x.id);
    vistas.push({ id: x.id, nombre, consulta, creada: typeof x.creada === 'string' ? x.creada : '' });
  }
  return { esquema: 1, vistas };
}

export const escribirVistas = (d: DatosVistas): string => `${JSON.stringify(d, null, 2)}\n`;

/** Crea una vista (con un id libre). `null` si el nombre o la consulta quedan vacíos. */
export function crearVista(
  d: DatosVistas,
  nombre: string,
  consulta: string,
  ahora: Date = new Date(),
): { datos: DatosVistas; vista: Vista } | null {
  const n = limpio(nombre, LARGO_NOMBRE);
  const c = limpio(consulta, LARGO_CONSULTA);
  if (!n || !c) return null;
  const usados = new Set(d.vistas.map((v) => v.id));
  const base = idDeNombre(n);
  let id = base;
  for (let i = 2; usados.has(id); i++) id = `${base}-${i}`;
  const vista: Vista = { id, nombre: n, consulta: c, creada: isoConZona(ahora) };
  return { datos: { ...d, vistas: [...d.vistas, vista] }, vista };
}

/** Cambia el nombre (o la consulta) de una vista; lo vacío no se aplica. */
export function editarVista(d: DatosVistas, id: string, cambio: Partial<Pick<Vista, 'nombre' | 'consulta'>>) {
  const nombre = cambio.nombre === undefined ? undefined : limpio(cambio.nombre, LARGO_NOMBRE);
  const consulta = cambio.consulta === undefined ? undefined : limpio(cambio.consulta, LARGO_CONSULTA);
  if (nombre === '' || consulta === '') return d;
  return {
    ...d,
    vistas: d.vistas.map((v) =>
      v.id === id ? { ...v, ...(nombre ? { nombre } : {}), ...(consulta ? { consulta } : {}) } : v,
    ),
  };
}

export const borrarVista = (d: DatosVistas, id: string): DatosVistas => ({
  ...d,
  vistas: d.vistas.filter((v) => v.id !== id),
});

/** La vista que ya guarda esa consulta (sin distinguir espacios de más). */
export const vistaConConsulta = (d: DatosVistas, consulta: string): Vista | undefined =>
  d.vistas.find((v) => v.consulta === limpio(consulta, LARGO_CONSULTA));

/**
 * Junta las vistas de un paquete con las de aquí (ante el mismo id, la de aquí). `null` si alguna no vale: la de aquí
 * que no se entiende no se sobrescribe.
 */
export function juntarVistas(aqui: string | null, paquete: string): string | null {
  const suyas = leerVistas(paquete);
  const nuestras = leerVistas(aqui);
  if (!suyas || !nuestras) return null;
  const ids = new Set(nuestras.vistas.map((v) => v.id));
  return escribirVistas({ esquema: 1, vistas: [...nuestras.vistas, ...suyas.vistas.filter((v) => !ids.has(v.id))] });
}
