/**
 * Menciones (ORG-10, IN-053): lo que un elemento menciona y conecta con otros. Las refs de Rimor (`LOG-0042`) en sus
 * notas y en su original, y los paquetes de los enlaces que contiene (`crates.io/ureq`): son sus términos, que el
 * repositorio guarda en un índice inverso (término → elementos) al guardar y al abrir. TS puro.
 */
import { analizarRef, type Elemento } from '@rimor/formato';
import { clasificar } from '../lectores/enlace/urls';

/** Términos por elemento como mucho (un original enorme con miles de refs no llena el índice). */
export const MAX_TERMINOS = 200;
/** Cuánto texto se mira de un original (un log de 50 MB no se recorre entero para esto). */
const MUESTRA = 512 * 1024;

/** Refs de Rimor que aparecen en el texto (`LOG-0042`, `DOC-MD-0004`), sin repetir, en su orden. */
export function refsEn(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/\b[A-Z]{2,3}(?:-MD)?-\d{4,}\b/g)) if (analizarRef(m[0])) vistas.add(m[0]);
  return [...vistas];
}

/** Un nombre de repositorio o de paquete comparable: sin `.git`, y en minúsculas donde no distinguen. */
export const nombreComparable = (sitio: string, nombre: string): string =>
  (['GitHub', 'GitLab', 'Codeberg', 'PyPI'].includes(sitio) ? nombre.toLowerCase() : nombre).replace(/\.git$/i, '');

/** El paquete al que lleva una URL (`npm/react`, `crates.io/ureq`), o `undefined`. */
export function paqueteDe(url: string): string | undefined {
  const d = clasificar(url);
  return d.clase === 'paquete' && d.nombre ? `${d.sitio}/${nombreComparable(d.sitio, d.nombre)}` : undefined;
}

/** El término de un paquete en el índice (`paquete:npm/react`), distinto de una ref. */
export const terminoPaquete = (paquete: string): string => `paquete:${paquete}`;

const URL_EN_TEXTO = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;

/**
 * Los términos de un elemento: las refs que mencionan sus notas y su original (sin la suya ni sus alias) y los
 * paquetes de los enlaces que contienen (`paquete:npm/react`), sin repetir y como mucho {@link MAX_TERMINOS}.
 */
export function terminosDe(el: Elemento): string[] {
  const propias = new Set<string>([el.frontmatter.ref, ...(el.frontmatter.alias ?? [])]);
  const texto = `${el.notas}\n${(el.original ?? '').slice(0, MUESTRA)}`;
  const terminos = new Set<string>();
  for (const r of refsEn(texto)) if (!propias.has(r)) terminos.add(r);
  for (const m of texto.matchAll(URL_EN_TEXTO)) {
    const p = paqueteDe(m[0].replace(/[.,;:!?]+$/, ''));
    if (p) terminos.add(terminoPaquete(p));
    if (terminos.size >= MAX_TERMINOS) break;
  }
  return [...terminos].slice(0, MAX_TERMINOS);
}

/** Cambia en un texto las refs de `cambios` (palabras enteras, de una pasada: `A→B` y `B→C` no encadenan). */
export function reescribirRefs(contenido: string, cambios: ReadonlyMap<string, string>): string {
  if (!cambios.size) return contenido;
  const patron = new RegExp(
    `(?<![\\p{L}\\p{N}-])(${[...cambios.keys()].map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}-])`,
    'gu',
  );
  return contenido.replace(patron, (r) => cambios.get(r) ?? r);
}
