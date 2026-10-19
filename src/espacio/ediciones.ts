/**
 * Ediciones del frontmatter de un elemento (VIS-01, ORG-04): fijar, estado, colecciones, etiquetas y título, como
 * funciones puras que devuelven el frontmatter nuevo. Las aplican Inicio y la pantalla de elemento, en turno, con
 * `useEdicion`. TS puro.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { ESTADO_NUEVO } from './estados';

/** Nombre de colección limpio: sin espacios de más ni `@`, en minúsculas. */
export const limpiarColeccion = (s: string) => s.trim().replace(/^@/, '').replace(/\s+/g, '-').toLowerCase();

/** Etiqueta limpia: sin espacios de más ni `#`. */
export const limpiarEtiqueta = (s: string) => s.trim().replace(/^#/, '').replace(/\s+/g, '-');

/** Una lista escrita a mano («@gateway, prompts» o «#ureq #staging»): sus nombres limpios, sin repetir. */
export const listaDeTexto = (texto: string, limpiar: (s: string) => string): string[] => [
  ...new Set(
    texto
      .split(/[\s,]+/)
      .map(limpiar)
      .filter(Boolean),
  ),
];

/** Quita una clave opcional del frontmatter (en vez de dejarla con `undefined`). */
function sin<K extends keyof FrontmatterComun>(fm: FrontmatterComun, clave: K): FrontmatterComun {
  const { [clave]: _, ...resto } = fm;
  return resto as FrontmatterComun;
}

export const conFijado = (fm: FrontmatterComun, fijado: boolean): FrontmatterComun =>
  fijado ? { ...fm, fijado: true } : sin(fm, 'fijado');

/** Estado nuevo; «nuevo» (o ninguno) es no tener estado. */
export const conEstado = (fm: FrontmatterComun, estado: string | undefined): FrontmatterComun =>
  estado && estado !== ESTADO_NUEVO ? { ...fm, estado } : sin(fm, 'estado');

export const conColecciones = (fm: FrontmatterComun, colecciones: readonly string[]): FrontmatterComun =>
  colecciones.length ? { ...fm, colecciones: [...colecciones] } : sin(fm, 'colecciones');

export const conEtiquetas = (fm: FrontmatterComun, etiquetas: readonly string[]): FrontmatterComun =>
  etiquetas.length ? { ...fm, etiquetas: [...etiquetas] } : sin(fm, 'etiquetas');

/**
 * Aplica a la lista de ahora lo que cambió entre `antes` y `despues` (lo que se quitó y lo que se añadió al
 * editarla), sin perder lo que otro añadió mientras tanto.
 */
export function aplicarCambios(
  ahora: readonly string[],
  antes: readonly string[],
  despues: readonly string[],
): string[] {
  const quitadas = new Set(antes.filter((x) => !despues.includes(x)));
  const quedan = ahora.filter((x) => !quitadas.has(x));
  return [...quedan, ...despues.filter((x) => !quedan.includes(x) && !antes.includes(x))];
}

/** Añade una colección (si no estaba). */
export const anadirColeccion = (fm: FrontmatterComun, coleccion: string): FrontmatterComun =>
  conColecciones(fm, [...new Set([...(fm.colecciones ?? []), coleccion])]);

/** Título nuevo, en una línea y sin espacios de más; `null` si queda vacío o no cambia. */
export function tituloNuevo(actual: string, escrito: string): string | null {
  const titulo = escrito.replace(/\s+/g, ' ').trim();
  return titulo && titulo !== actual ? titulo : null;
}
