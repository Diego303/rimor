/**
 * Menciones (ORG-10, IN-053): lo que un elemento menciona y le conecta con otros. Las refs de elementos (`LOG-0042`)
 * en sus notas y, si es prosa, en su original; los paquetes de los enlaces que contienen (`crates.io/ureq`); y las
 * huellas de error que se copian en ellos. Son sus términos, que el repositorio guarda en un índice inverso (término →
 * elementos) al guardar y al abrir. Lo que va dentro de una URL o de código no cuenta ni se reescribe. TS puro.
 */
import { analizarRef, type Elemento, PREFIJOS, TIPOS_ELEMENTO, type TipoElemento } from '@rimor/formato';
import { clasificar, type Destino } from '../lectores/enlace/urls';

/** Refs por elemento como mucho (un original con miles no llena el índice); los paquetes y huellas, aparte. */
export const MAX_REFS = 150;
export const MAX_OTROS = 50;
/** Caracteres que se miran de un original (uno enorme no se recorre entero para esto). */
const MUESTRA = 512 * 1024;
/** Originales que se miran: los de prosa. En un log o un código, `ERR-1001` es de otro sistema, no de Rimor. */
const PROSA: ReadonlySet<TipoElemento> = new Set(['texto', 'idea', 'markdown', 'prompt']);

/** Los prefijos de los elementos (`DOC-0002` o `HIL-0001` son entidades: no se mencionan así). */
const DE_ELEMENTOS = new Set(TIPOS_ELEMENTO.map((t) => PREFIJOS[t]));

/**
 * Una ref como palabra entera: ni letra, ni cifra, ni guion, ni subrayado a los lados. La misma frontera para detectar
 * y para reescribir (lo que cuenta como mención es lo que se cambia).
 */
const FRONTERA_ANTES = '(?<![\\p{L}\\p{N}_-])';
const FRONTERA_DESPUES = '(?![\\p{L}\\p{N}_-])';
const REF = new RegExp(`${FRONTERA_ANTES}[A-Z]{2,3}(?:-MD)?-\\d{4,}${FRONTERA_DESPUES}`, 'gu');
/** Una huella de error (16 hexadecimales, como la enseña el lector Error). */
const HUELLA = new RegExp(`${FRONTERA_ANTES}[0-9a-f]{16}${FRONTERA_DESPUES}`, 'gu');

/** Lo que no es texto corriente: bloques de código, código en línea y URLs. */
const PROTEGIDO = /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`|\bhttps?:\/\/[^\s<>"'`)\]]+/gi;

/** Los trozos de un texto: los corrientes (se miran y se reescriben) y los protegidos (se dejan tal cual). */
function trozos(texto: string): { t: string; protegido: boolean }[] {
  const salida: { t: string; protegido: boolean }[] = [];
  let i = 0;
  for (const m of texto.matchAll(PROTEGIDO)) {
    const desde = m.index ?? 0;
    if (desde > i) salida.push({ t: texto.slice(i, desde), protegido: false });
    salida.push({ t: m[0], protegido: true });
    i = desde + m[0].length;
  }
  if (i < texto.length) salida.push({ t: texto.slice(i), protegido: false });
  return salida;
}

const corriente = (texto: string) =>
  trozos(texto)
    .filter((x) => !x.protegido)
    .map((x) => x.t)
    .join(' ');

/**
 * Refs de Rimor que aparecen en el texto (fuera de URLs y código), sin repetir, en su orden: de elementos y de
 * entidades (`CMP-0004`), como las enseñan los lectores.
 */
export function refsEn(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of corriente(texto).matchAll(REF)) if (analizarRef(m[0])) vistas.add(m[0]);
  return [...vistas];
}

/** ¿Es la ref de un elemento? (Solo esas van al índice: «Mencionado por» es de los elementos.) */
const deElemento = (ref: string) => DE_ELEMENTOS.has(analizarRef(ref)?.prefijo ?? '');

/** Un nombre de repositorio o de paquete comparable: sin `.git`, y en minúsculas donde no distinguen. */
export const nombreComparable = (sitio: string, nombre: string): string =>
  (['GitHub', 'GitLab', 'Codeberg', 'PyPI'].includes(sitio) ? nombre.toLowerCase() : nombre).replace(/\.git$/i, '');

/** El paquete de un destino ya clasificado (`npm/react`), o `undefined`. */
export const paqueteDeDestino = (d: Destino): string | undefined =>
  d.clase === 'paquete' && d.nombre ? `${d.sitio}/${nombreComparable(d.sitio, d.nombre)}` : undefined;

/** El paquete al que lleva una URL (`npm/react`, `crates.io/ureq`), o `undefined`. */
export const paqueteDe = (url: string): string | undefined => paqueteDeDestino(clasificar(url));

/** Los términos de un paquete y de una huella en el índice, distintos de una ref. */
export const terminoPaquete = (paquete: string): string => `paquete:${paquete}`;
export const terminoHuella = (huella: string): string => `huella:${huella}`;

const URL_EN_TEXTO = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;

/**
 * Los términos de un elemento: las refs que mencionan sus notas y, si es prosa, su original (sin la suya ni sus
 * alias, como mucho {@link MAX_REFS}); y aparte (como mucho {@link MAX_OTROS}) los paquetes de los enlaces que
 * contienen (`paquete:npm/react`) y las huellas de error copiadas en ellos (`huella:3f9a…`). Un original que va como
 * adjunto (más de 2 MB) no se mira.
 */
export function terminosDe(el: Elemento): string[] {
  const propias = new Set<string>([el.frontmatter.ref, ...(el.frontmatter.alias ?? [])]);
  const original = PROSA.has(el.frontmatter.tipo) ? (el.original ?? '').slice(0, MUESTRA) : '';
  const texto = `${el.notas}\n${original}`;
  const refs = refsEn(texto)
    .filter((r) => !propias.has(r) && deElemento(r))
    .slice(0, MAX_REFS);
  const otros = new Set<string>();
  for (const m of texto.matchAll(URL_EN_TEXTO)) {
    if (otros.size >= MAX_OTROS) break;
    const p = paqueteDe(m[0].replace(/[.,;:!?]+$/, ''));
    if (p) otros.add(terminoPaquete(p));
  }
  for (const m of corriente(texto).matchAll(HUELLA)) {
    if (otros.size >= MAX_OTROS) break;
    otros.add(terminoHuella(m[0]));
  }
  return [...refs, ...otros];
}

/**
 * Cambia en un texto las refs de `cambios` (como palabras enteras, de una pasada: `A→B` y `B→C` no encadenan). Con
 * `soloCorriente`, lo de dentro de una URL o de código se deja tal cual (un enlace externo o un `grep` no son
 * menciones).
 */
export function reescribirRefs(
  contenido: string,
  cambios: ReadonlyMap<string, string>,
  { soloCorriente = false }: { soloCorriente?: boolean } = {},
): string {
  if (!cambios.size) return contenido;
  const patron = new RegExp(
    `${FRONTERA_ANTES}(${[...cambios.keys()].map((r) => r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})${FRONTERA_DESPUES}`,
    'gu',
  );
  const cambiar = (t: string) => t.replace(patron, (r) => cambios.get(r) ?? r);
  if (!soloCorriente) return cambiar(contenido);
  return trozos(contenido)
    .map((x) => (x.protegido ? x.t : cambiar(x.t)))
    .join('');
}
