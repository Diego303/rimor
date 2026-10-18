/**
 * Análisis de un documento Markdown (LEC-08, plan §8.5) con el mismo parser que lo pinta (remark-parse y
 * remark-gfm): secciones con su ancla estable, palabras, tareas por sección y en total, enlaces y bloques de
 * código. TS puro; se carga solo al derivar (en el Worker), para que remark no entre en la carga inicial.
 */
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { anclarMdast, textoPlano } from '../../ui/anclas';
import { mencionesDe } from '../texto/lector';
import { contarPalabras, cuerpoDe } from './deteccion';
import type { DatosMarkdown, Seccion, Tareas } from './indice';

export type { DatosMarkdown } from './indice';

/** Lo que se usa del árbol mdast (sin depender de sus tipos). */
interface Nodo {
  type: string;
  depth?: number;
  checked?: boolean | null;
  url?: string;
  identifier?: string;
  lang?: string | null;
  value?: string;
  children?: Nodo[];
}

export const MAX_ENLACES = 50;

/** Bloques cuyo texto se cuenta entero (así `**neg**rita` es una palabra, no dos). */
const BLOQUES_DE_TEXTO = new Set(['paragraph', 'heading', 'tableCell']);

const procesador = unified().use(remarkParse).use(remarkGfm);

/** Las definiciones de los enlaces por referencia (`[a][1]` … `[1]: https://…`). */
function definicionesDe(n: Nodo, mapa = new Map<string, string>()): Map<string, string> {
  if (n.type === 'definition' && n.identifier && n.url) mapa.set(n.identifier.toLowerCase(), n.url);
  for (const hijo of n.children ?? []) definicionesDe(hijo, mapa);
  return mapa;
}

/**
 * Analiza el documento. El frontmatter YAML del principio no forma parte de él (lo enseña «Detalles») y los
 * finales de línea CRLF se normalizan: la vista pinta exactamente el mismo cuerpo, con las mismas anclas.
 */
export function analizarMarkdown(texto: string): DatosMarkdown {
  const { cuerpo } = cuerpoDe(texto);
  const arbol = procesador.parse(cuerpo) as Nodo;
  // Las mismas anclas que pone `MarkdownSeguro` al pintar: la misma función sobre el mismo árbol.
  const anclas = anclarMdast(arbol);
  const definiciones = definicionesDe(arbol);
  const secciones: Seccion[] = [];
  const tareas: Tareas = { hechas: 0, total: 0 };
  const enlaces: string[] = [];
  const vistos = new Set<string>();
  let totalEnlaces = 0;
  let palabras = 0;
  const bloques = { total: 0, lenguajes: {} as Record<string, number> };
  // Las palabras y las tareas van a la última sección abierta (o a ninguna, antes del primer encabezado).
  let actual: Seccion | null = null;

  const sumarPalabras = (n: Nodo) => {
    const p = contarPalabras(textoPlano(n));
    palabras += p;
    if (actual) actual.palabras += p;
  };

  const anotarEnlace = (url: string) => {
    totalEnlaces++;
    // En «Enlaces», solo las direcciones web; los relativos, las anclas y los correos se cuentan sin listarse.
    if (!/^https?:\/\//i.test(url) || vistos.has(url)) return;
    vistos.add(url);
    if (enlaces.length < MAX_ENLACES) enlaces.push(url);
  };

  const recorrer = (n: Nodo) => {
    switch (n.type) {
      case 'heading': {
        const s: Seccion = {
          nivel: n.depth ?? 1,
          titulo: textoPlano(n).trim(),
          ancla: anclas[secciones.length] ?? '',
          tareas: { hechas: 0, total: 0 },
          palabras: 0,
        };
        secciones.push(s);
        actual = s;
        break;
      }
      case 'code': {
        bloques.total++;
        const lenguaje = n.lang?.trim().toLowerCase() || 'texto';
        bloques.lenguajes[lenguaje] = (bloques.lenguajes[lenguaje] ?? 0) + 1;
        return;
      }
      case 'html':
      case 'definition':
        return;
      case 'link':
        anotarEnlace(n.url ?? '');
        break;
      case 'linkReference':
        anotarEnlace(definiciones.get((n.identifier ?? '').toLowerCase()) ?? '');
        break;
      case 'listItem':
        if (typeof n.checked === 'boolean') {
          tareas.total++;
          if (n.checked) tareas.hechas++;
          if (actual) {
            actual.tareas.total++;
            if (n.checked) actual.tareas.hechas++;
          }
        }
        break;
    }
    if (BLOQUES_DE_TEXTO.has(n.type)) sumarPalabras(n);
    for (const hijo of n.children ?? []) recorrer(hijo);
  };
  recorrer(arbol);

  // Si el primer encabezado es el único de su nivel (y el más alto), es el título del documento; el índice es el
  // siguiente nivel presente (plano, como la pantalla de referencia).
  const primero = secciones[0];
  const conTitulo = !!primero && secciones.length > 1 && secciones.every((s, i) => i === 0 || s.nivel > primero.nivel);
  let masAlto = 6;
  for (const s of conTitulo ? secciones.slice(1) : secciones) masAlto = Math.min(masAlto, s.nivel);
  const nivelIndice = secciones.length ? masAlto : 1;
  return {
    secciones,
    nivelIndice,
    conTitulo,
    palabras,
    tareas,
    enlaces,
    totalEnlaces,
    menciones: mencionesDe(cuerpo),
    bloques,
  };
}
