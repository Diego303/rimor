/**
 * Detección de un documento Markdown (LEC-08), barata y sin parser: señales por línea, sin expresiones que
 * retrocedan (los encabezados se leen con `encabezadoDe`, las filas de tabla a mano). TS puro.
 */
import { esLineaDeLenguaje } from '../codigo/lenguajes';
import { encabezadoDe } from '../prompt/analisis';

/** Caracteres que se miran para detectar. */
const MUESTRA = 20_000;

const TAREA = /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]/;
const VALLA = /^[ \t]*(?:```|~~~)/;
const LISTA = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+\S/;
const ENLACE = /\[[^\]\n]{1,200}\]\([^)\s]{1,500}\)/;

/**
 * Una palabra: cada ideograma o kana cuenta por sí solo (el japonés y el chino no separan con espacios); en los
 * demás alfabetos, letras y cifras seguidas. Una URL cuenta como una.
 */
const PALABRA =
  /https?:\/\/\S+|[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]|(?:(?![\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}])[\p{L}\p{N}])(?:(?![\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}])[\p{L}\p{N}'’_-])*/gu;

/** Palabras de un texto. */
export const contarPalabras = (texto: string) => texto.match(PALABRA)?.length ?? 0;

/**
 * El documento sin su frontmatter YAML (si empieza por `---` y sus líneas son `clave: valor`) y con los finales de
 * línea normalizados a `\n`. El análisis y la vista trabajan sobre este cuerpo.
 */
export function cuerpoDe(texto: string): { cuerpo: string; frontmatter: string | null } {
  const t = texto.replace(/\r\n?/g, '\n');
  if (!t.startsWith('---\n')) return { cuerpo: t, frontmatter: null };
  const cierre = t.indexOf('\n---', 3);
  if (cierre < 0) return { cuerpo: t, frontmatter: null };
  const yaml = t.slice(4, cierre);
  const tras = t.slice(cierre + 4);
  // Solo si es YAML de verdad (`clave: valor`) y el cierre ocupa su línea.
  if (!/^[A-Za-z_][\w-]*:/m.test(yaml) || !/^(?:\n|$)/.test(tras)) return { cuerpo: t, frontmatter: null };
  return { cuerpo: tras.replace(/^\n/, ''), frontmatter: yaml };
}

/** Fila separadora de una tabla GFM (`|---|:--:|`), a mano: con una expresión, los espacios retrocedían. */
function esSeparadorDeTabla(linea: string): boolean {
  const t = linea.trim();
  if (!t.includes('|') || !t.includes('-')) return false;
  const celdas = t.replace(/^\|/, '').replace(/\|$/, '').split('|');
  return celdas.every((c) => /^:?-{3,}:?$/.test(c.trim()));
}

/** Encabezado Setext: una línea de texto subrayada con `===` o `---`. */
function esSetext(lineas: readonly string[], i: number): boolean {
  const texto = lineas[i] ?? '';
  const subrayado = (lineas[i + 1] ?? '').trim();
  return (
    (/^=+$/.test(subrayado) || /^-+$/.test(subrayado)) &&
    texto.trim() !== '' &&
    !LISTA.test(texto) &&
    !VALLA.test(texto) &&
    !encabezadoDe(texto)
  );
}

/**
 * Líneas de código, configuración o scripts: un `# comentario` de shell, Python, YAML o un Dockerfile no es un
 * encabezado, y lo que lo rodea delata qué es.
 */
const LINEA_DE_CODIGO =
  /[;{}]$|^[ \t]*(?:FROM|RUN|COPY|ADD|CMD|ENV|ARG|WORKDIR|EXPOSE|ENTRYPOINT|def|class|import|from|if|elif|else|fi|for|while|done|do|echo|export|return|function|const|let|var|set -e|sudo|apt|npm|pnpm|pip|cd)\b|^[ \t]*(?:-[ \t]+)?[\w.-]+:(?:[ \t]+\S+)?[ \t]*$|^[ \t]*[\w.]+[ \t]*=[ \t]*\S|\$\{?\w/;

/** Las primeras líneas del cuerpo (sin frontmatter) para detectar. */
const lineasDe = (texto: string) => cuerpoDe(texto.slice(0, MUESTRA)).cuerpo.split('\n');

/**
 * 0,75 con un encabezado (ATX o Setext) y otra señal distinta, con dos señales fuertes (tareas, código, tabla) o con
 * tres cualesquiera; 0,7 con dos encabezados o más y 200 caracteres; si no, 0. Si fuera de los bloques de código
 * casi todo son líneas de código o de configuración, no es un documento. Por debajo de Prompt (`CLAUDE.md` 0,9,
 * prompts con variables 0,8) y por encima de Idea y Texto.
 */
export function confianzaMarkdown(texto: string): number {
  const lineas = lineasDe(texto);
  let encabezados = 0;
  let enValla = false;
  let deCodigo = 0;
  let conTexto = 0;
  const senales = new Set<string>();
  for (const [i, linea] of lineas.entries()) {
    if (VALLA.test(linea)) {
      enValla = !enValla;
      senales.add('codigo');
      continue;
    }
    if (enValla || !linea.trim()) continue;
    if (encabezadoDe(linea) || esSetext(lineas, i)) {
      encabezados++;
      continue;
    }
    conTexto++;
    if (LINEA_DE_CODIGO.test(linea) || esLineaDeLenguaje(linea.trim())) deCodigo++;
    if (TAREA.test(linea)) senales.add('tareas');
    else if (esSeparadorDeTabla(linea)) senales.add('tabla');
    else if (LISTA.test(linea)) senales.add('lista');
    if (ENLACE.test(linea)) senales.add('enlace');
  }
  if (conTexto && deCodigo / conTexto >= 0.4) return 0;
  const fuertes = ['tareas', 'codigo', 'tabla'].filter((s) => senales.has(s)).length;
  if ((encabezados && senales.size >= 1) || fuertes >= 2 || senales.size >= 3) return 0.75;
  if (encabezados >= 2 && lineas.join('\n').trim().length >= 200) return 0.7;
  return 0;
}

/** Recuento rápido de palabras sin el frontmatter ni los bloques de código (resumen provisional al capturar). */
export function palabrasAprox(texto: string): number {
  let dentro = false;
  let n = 0;
  for (const linea of cuerpoDe(texto).cuerpo.split('\n')) {
    if (VALLA.test(linea)) {
      dentro = !dentro;
      continue;
    }
    if (!dentro && !/^[ \t]*(?:=+|-+)[ \t]*$/.test(linea))
      n += contarPalabras(linea.replace(/^[ \t]*(?:#{1,6}|[-*+]|\d+[.)]|>)[ \t]+(?:\[[ xX]\][ \t]+)?/, ''));
  }
  return n;
}

/**
 * Título del documento: el `title` del frontmatter, el primer encabezado (ATX o Setext, fuera de los bloques de
 * código) o la primera línea con texto.
 */
export function tituloDeCuerpo(texto: string): string | null {
  const { cuerpo, frontmatter } = cuerpoDe(texto);
  const titulo = frontmatter ? /^title:[ \t]*["']?(.+?)["']?[ \t]*$/m.exec(frontmatter)?.[1] : undefined;
  if (titulo) return titulo;
  const lineas = cuerpo.split('\n');
  let enValla = false;
  for (const [i, linea] of lineas.entries()) {
    if (VALLA.test(linea)) {
      enValla = !enValla;
      continue;
    }
    if (enValla) continue;
    const h = encabezadoDe(linea);
    if (h) return h.titulo;
    if (esSetext(lineas, i)) return linea.trim();
  }
  const primera = lineas.find((l) => l.trim() && !VALLA.test(l));
  return primera ? primera.trim().replace(/^[-*+>]\s+/, '') : null;
}
