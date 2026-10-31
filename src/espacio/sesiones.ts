/**
 * Sesiones automáticas (ORG-08, IN-051): las capturas separadas por menos de 45 minutos son del mismo rato de trabajo.
 * Cada elemento guarda la suya en `sesion` (`2026-10-16-tarde-1630`: el día, la franja y la hora de su primera
 * captura, para que no se repita ni entre dispositivos); los nombres que se editan, en `sesiones.json` (en la
 * raíz del espacio: viaja en el ZIP). Sin nombre editado, se propone uno: la colección o las etiquetas dominantes, o la
 * franja del día. TS puro.
 */
import type { FrontmatterComun } from '@rimor/formato';

export const RUTA_SESIONES = 'sesiones.json';
/** Dos capturas separadas por menos de esto son de la misma sesión (el umbral de la referencia). */
export const UMBRAL_SESION_MS = 45 * 60 * 1000;
/** Largo máximo de un nombre de sesión. */
export const LARGO_NOMBRE = 80;

export type Franja = 'madrugada' | 'manana' | 'tarde' | 'noche';

/** La franja de una hora local: madrugada antes de las 6, mañana hasta las 14, tarde hasta las 21 y noche. */
export function franjaDe(fecha: Date): Franja {
  const h = fecha.getHours();
  return h < 6 ? 'madrugada' : h < 14 ? 'manana' : h < 21 ? 'tarde' : 'noche';
}

/** El día local (`AAAA-MM-DD`). */
const diaDe = (f: Date) =>
  `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

/** La franja de un id de sesión (`2026-10-16-tarde-1630-2` → `tarde`), o `null` si no tiene esa forma. */
export function franjaDeId(id: string): Franja | null {
  const m = /^\d{4}-\d{2}-\d{2}-(madrugada|manana|tarde|noche)(?:-\d+)*$/.exec(id);
  return (m?.[1] as Franja | undefined) ?? null;
}

/**
 * La sesión de una captura de ahora: la del capturado más reciente (de `elementos`, los que no están en la papelera)
 * si es de hace menos de 45 minutos y la tiene; si no, una nueva con el día, la franja y la hora de ahora, con `-2`,
 * `-3`… si ese id ya lo tiene alguno (también de `otras`: los de la papelera, que pueden volver).
 */
export function sesionPara(
  elementos: readonly FrontmatterComun[],
  ahora: Date,
  otras: readonly FrontmatterComun[] = [],
): string {
  let ultimo: FrontmatterComun | null = null;
  let ultimoMs = Number.NEGATIVE_INFINITY;
  const usadas = new Set<string>();
  for (const fm of otras) if (fm.sesion) usadas.add(fm.sesion);
  for (const fm of elementos) {
    if (fm.sesion) usadas.add(fm.sesion);
    const ms = Date.parse(fm.creado);
    // Lo de después de ahora (un reloj que va atrás, una importación) no continúa nada.
    if (Number.isFinite(ms) && ms <= ahora.getTime() && ms > ultimoMs) {
      ultimoMs = ms;
      ultimo = fm;
    }
  }
  if (ultimo?.sesion && ahora.getTime() - ultimoMs < UMBRAL_SESION_MS) return ultimo.sesion;
  const hora = `${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`;
  const base = `${diaDe(ahora)}-${franjaDe(ahora)}-${hora}`;
  if (!usadas.has(base)) return base;
  let n = 2;
  while (usadas.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export interface DatosSesiones {
  esquema: 1;
  /** Los nombres editados, por id de sesión. */
  nombres: Record<string, string>;
}

export const SESIONES_INICIALES: DatosSesiones = Object.freeze({ esquema: 1, nombres: {} }) as DatosSesiones;

/** Limpia un nombre: sin saltos de línea ni espacios de más, y no demasiado largo. */
export const limpiarNombre = (nombre: string): string =>
  nombre.replace(/\s+/g, ' ').trim().slice(0, LARGO_NOMBRE).trim();

/** Lee el archivo; `null` si existe pero no se entiende o es de un esquema más nuevo (no se sobrescribe). */
export function leerSesiones(texto: string | null): DatosSesiones | null {
  if (!texto) return { esquema: 1, nombres: {} };
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  if (typeof o.esquema === 'number' && o.esquema > 1) return null;
  const nombres: Record<string, string> = {};
  if (typeof o.nombres === 'object' && o.nombres !== null && !Array.isArray(o.nombres))
    for (const [id, nombre] of Object.entries(o.nombres as Record<string, unknown>)) {
      const limpio = typeof nombre === 'string' ? limpiarNombre(nombre) : '';
      if (id && limpio) nombres[id] = limpio;
    }
  return { esquema: 1, nombres };
}

export const escribirSesiones = (d: DatosSesiones): string => `${JSON.stringify(d, null, 2)}\n`;

/**
 * El nombre de una sesión: `nombre`. Vacío, o igual que el propuesto (`propuesto`), vuelve al propuesto: así sigue a su
 * colección si cambia.
 */
export function renombrar(d: DatosSesiones, id: string, nombre: string, propuesto?: string): DatosSesiones {
  const nombres = { ...d.nombres };
  const limpio = limpiarNombre(nombre);
  if (limpio && limpio !== propuesto) nombres[id] = limpio;
  else delete nombres[id];
  return { ...d, nombres };
}

/**
 * Junta los nombres de un paquete con los de aquí (ante el mismo id, el de aquí). `null` si alguno no vale: el de aquí
 * que no se entiende no se sobrescribe.
 */
export function juntarSesiones(aqui: string | null, paquete: string): string | null {
  const suyo = leerSesiones(paquete);
  const nuestro = leerSesiones(aqui);
  if (!suyo || !nuestro) return null;
  return escribirSesiones({ esquema: 1, nombres: { ...suyo.nombres, ...nuestro.nombres } });
}

/** Lo que propone el nombre de una sesión (la vista lo escribe en su idioma). */
export type Propuesto =
  | { t: 'coleccion'; coleccion: string }
  | { t: 'etiquetas'; etiquetas: string[] }
  | { t: 'franja'; franja: Franja };

/**
 * El nombre propuesto de una sesión: la colección que tiene al menos la mitad de sus elementos; si no, sus etiquetas
 * más repetidas (una o dos, en al menos dos elementos); si no, la franja.
 */
export function nombrePropuesto(id: string, elementos: readonly FrontmatterComun[]): Propuesto {
  const contar = (listas: (readonly string[] | undefined)[]) => {
    const n = new Map<string, number>();
    for (const l of listas) for (const x of new Set(l ?? [])) n.set(x, (n.get(x) ?? 0) + 1);
    // Por recuento y, a igualdad, por orden alfabético (determinista).
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const [coleccion] = contar(elementos.map((fm) => fm.colecciones));
  if (coleccion && coleccion[1] * 2 >= elementos.length) return { t: 'coleccion', coleccion: coleccion[0] };
  const etiquetas = contar(elementos.map((fm) => fm.etiquetas))
    .filter(([, n]) => n >= 2)
    .slice(0, 2)
    .map(([e]) => e);
  if (etiquetas.length) return { t: 'etiquetas', etiquetas };
  return { t: 'franja', franja: franjaDeId(id) ?? franjaDe(new Date(elementos[0]?.creado ?? Date.now())) };
}
