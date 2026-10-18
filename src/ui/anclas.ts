/**
 * Anclas estables de los encabezados de un documento (LEC-08): el índice del lector Markdown y el documento
 * pintado las calculan igual, así que cada entrada del índice lleva a su encabezado. TS puro.
 */

const LARGO_ANCLA = 80;

/**
 * Título normalizado: minúsculas, sin tildes ni signos (con la descomposición de compatibilidad, «2.º» da «2-o»),
 * con guiones; conserva letras de cualquier alfabeto.
 */
export function anclaDe(titulo: string): string {
  const base = titulo
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_ANCLA)
    .replace(/-+$/, '');
  return base || 'seccion';
}

/** Anclas en orden de aparición: las repetidas llevan `-2`, `-3`… (como GitHub). */
export function crearAnclador(): (titulo: string) => string {
  const vistas = new Map<string, number>();
  return (titulo) => {
    const base = anclaDe(titulo);
    const n = (vistas.get(base) ?? 0) + 1;
    vistas.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

/** Texto plano de un nodo de mdast o hast (los dos tienen `value` en el texto y `children`). */
export function textoPlano(nodo: unknown): string {
  if (!nodo || typeof nodo !== 'object') return '';
  const n = nodo as { type?: unknown; value?: unknown; alt?: unknown; children?: unknown[] };
  // El HTML en línea de mdast (`<b>`) no se ve al pintar: tampoco cuenta para el ancla.
  if (n.type === 'html' || n.type === 'raw' || n.type === 'comment') return '';
  if (typeof n.value === 'string') return n.value;
  if (typeof n.alt === 'string' && !n.children) return n.alt;
  return (n.children ?? []).map(textoPlano).join('');
}

/** El `id` (con el prefijo de los `id` saneados) de un ancla. */
export const idDeAncla = (ancla: string) => `rimor-${ancla}`;
