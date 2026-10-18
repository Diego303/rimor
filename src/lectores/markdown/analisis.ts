/**
 * Análisis de un documento Markdown (LEC-08, plan §8.5) con el mismo parser que lo pinta (remark-parse y
 * remark-gfm): secciones con su ancla estable, palabras, tareas por sección y en total, enlaces y bloques de
 * código. TS puro; se carga solo al derivar (en el Worker), para que remark no entre en la carga inicial.
 */
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { crearAnclador, textoPlano } from '../../ui/anclas';
import { mencionesDe } from '../texto/lector';
import { contarPalabras } from './deteccion';
import type { DatosMarkdown, Seccion, Tareas } from './indice';

export type { DatosMarkdown } from './indice';

/** Lo que se usa del árbol mdast (sin depender de sus tipos). */
interface Nodo {
  type: string;
  depth?: number;
  checked?: boolean | null;
  url?: string;
  lang?: string | null;
  value?: string;
  children?: Nodo[];
}

export const MAX_ENLACES = 50;

const procesador = unified().use(remarkParse).use(remarkGfm);

export function analizarMarkdown(texto: string): DatosMarkdown {
  const arbol = procesador.parse(texto) as Nodo;
  const anclar = crearAnclador();
  const secciones: Seccion[] = [];
  const tareas: Tareas = { hechas: 0, total: 0 };
  const enlaces: string[] = [];
  const vistos = new Set<string>();
  let totalEnlaces = 0;
  let palabras = 0;
  const bloques = { total: 0, lenguajes: {} as Record<string, number> };
  // Las palabras y las tareas van a la última sección abierta (o a ninguna, antes del primer encabezado).
  let actual: Seccion | null = null;

  const recorrer = (n: Nodo) => {
    switch (n.type) {
      case 'heading': {
        const titulo = textoPlano(n).trim();
        const s: Seccion = {
          nivel: n.depth ?? 1,
          titulo,
          ancla: anclar(titulo),
          tareas: { hechas: 0, total: 0 },
          palabras: 0,
        };
        secciones.push(s);
        actual = s;
        const p = contarPalabras(titulo);
        palabras += p;
        s.palabras += p;
        return;
      }
      case 'code': {
        bloques.total++;
        const lenguaje = n.lang?.trim().toLowerCase() || 'texto';
        bloques.lenguajes[lenguaje] = (bloques.lenguajes[lenguaje] ?? 0) + 1;
        return;
      }
      case 'html':
        return;
      case 'text':
      case 'inlineCode': {
        const p = contarPalabras(n.value ?? '');
        palabras += p;
        if (actual) actual.palabras += p;
        return;
      }
      case 'link': {
        totalEnlaces++;
        const url = n.url ?? '';
        if (url && !vistos.has(url)) {
          vistos.add(url);
          if (enlaces.length < MAX_ENLACES) enlaces.push(url);
        }
        break;
      }
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
    menciones: mencionesDe(texto),
    bloques,
  };
}
