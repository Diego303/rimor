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

/**
 * Anclas en orden de aparición: las repetidas llevan `-2`, `-3`… (como GitHub), sin chocar nunca con otra ya dada
 * (`A`, `A`, `A-2` dan `a`, `a-2` y `a-2-2`).
 */
export function crearAnclador(): (titulo: string) => string {
  const usadas = new Set<string>();
  return (titulo) => {
    const base = anclaDe(titulo);
    let ancla = base;
    for (let n = 2; usadas.has(ancla); n++) ancla = `${base}-${n}`;
    usadas.add(ancla);
    return ancla;
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

/** Lo que se usa de un nodo mdast para anclar sus encabezados (sin depender de sus tipos). */
interface NodoMd {
  type: string;
  children?: NodoMd[];
  data?: { hProperties?: Record<string, unknown> } & Record<string, unknown>;
}

/**
 * Pone el ancla a cada encabezado del árbol mdast, en orden, como `id` del elemento que saldrá al pintar (el
 * saneado le añade el prefijo `rimor-`). Es el mismo árbol, el mismo texto y el mismo orden que usa el índice del
 * lector Markdown: las anclas coinciden siempre (imágenes, notas al pie, HTML en línea, Setext). Devuelve las anclas.
 */
export function anclarMdast(arbol: unknown): string[] {
  const anclar = crearAnclador();
  const anclas: string[] = [];
  const recorrer = (n: NodoMd) => {
    if (n.type === 'heading') {
      const ancla = anclar(textoPlano(n).trim());
      anclas.push(ancla);
      n.data = { ...n.data, hProperties: { ...n.data?.hProperties, id: ancla } };
      return;
    }
    for (const hijo of n.children ?? []) recorrer(hijo);
  };
  recorrer(arbol as NodoMd);
  return anclas;
}
