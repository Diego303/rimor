/**
 * Lector Texto (LEC-01): la red de seguridad. Guarda cualquier texto, lo pinta como Markdown saneado y saca sus
 * enlaces y las refs de Rimor que menciona. Nunca gana la detección por sí mismo: llega por defecto (IN-013).
 */
import { analizarRef, type Elemento } from '@rimor/formato';
import type { Fragmento } from '../../respuestas/tipos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { textos } from './textos';

export interface DatosTexto {
  lineas: number;
  palabras: number;
  enlaces: string[];
  menciones: string[];
}

const LARGO_TITULO = 120;

function contarLineas(texto: string): number {
  const sinFinal = texto.replace(/\r?\n$/, '');
  return sinFinal === '' ? 0 : sinFinal.split(/\r?\n/).length;
}

/** Líneas que son solo marcado: cercas de código, reglas, imágenes o un encabezado vacío. */
const SOLO_MARCADO = /^(?:`{3,}.*|~{3,}.*|(?:[-*_]\s*){3,}|!\[[^\]]*\]\([^)]*\)|#{1,6})$/;

/** Primera línea con contenido, sin las marcas de Markdown del principio (`#`, `-`, `*`, `>`, `1.`). */
export function tituloDe(texto: string): string {
  for (const linea of texto.split(/\r?\n/)) {
    const l = linea.trim();
    if (!l || SOLO_MARCADO.test(l)) continue;
    const limpia = l.replace(/^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|>\s*|\d+[.)]\s+)/, '').trim();
    if (!limpia) continue;
    return limpia.length > LARGO_TITULO ? `${limpia.slice(0, LARGO_TITULO - 1)}…` : limpia;
  }
  return '';
}

/** Lo que nunca forma parte de una URL pegada en un texto: espacios, comillas, corchetes y ángulos. */
const URL_EN_TEXTO = /(?<![\p{L}\p{N}])https?:\/\/[^\s<>"'`«»“”‘’[\]{}|\\^]+/giu;

/**
 * URL `http(s)://` del texto, sin repetir y sin lo que se les pega alrededor: puntuación final, marcas de
 * Markdown (`**`, `_`), comillas, o el `)` de un paréntesis que se abrió fuera.
 */
export function enlacesDe(texto: string): string[] {
  const vistos = new Set<string>();
  for (const m of texto.matchAll(URL_EN_TEXTO)) {
    let url = m[0];
    for (;;) {
      const antes = url;
      url = url.replace(/[.,;:!?*_~]+$/, '');
      // Un paréntesis de cierre final solo es parte de la URL si abrió uno dentro (Wikipedia).
      if (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0))
        url = url.slice(0, -1);
      if (url === antes) break;
    }
    if (/^https?:\/\/[^/]/i.test(url)) vistos.add(url);
  }
  return [...vistos];
}

/** Refs de Rimor que aparecen en el texto (`LOG-0042`, `DOC-MD-0004`), sin repetir. */
export function mencionesDe(texto: string): string[] {
  const vistas = new Set<string>();
  for (const m of texto.matchAll(/\b[A-Z]{2,3}(?:-MD)?-\d{4,}\b/g)) if (analizarRef(m[0])) vistas.add(m[0]);
  return [...vistas];
}

export const lectorTexto: Lector<DatosTexto> = {
  nombre: 'texto',
  tipo: 'texto',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto?.trim() ? 0.1 : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    return {
      titulo: tituloDe(texto),
      original: texto,
      resumen: { lineas: contarLineas(texto), palabras: texto.split(/\s+/).filter(Boolean).length },
    };
  },

  async derivar(el: Elemento): Promise<DatosTexto> {
    // Un texto de más de 2 MB va como adjunto (D8) y el Worker no lo lee: se queda con lo que contó `leer`.
    if (el.original === null) {
      const r = el.frontmatter.lector.resumen;
      const n = (x: unknown) => (typeof x === 'number' ? x : 0);
      return { lineas: n(r.lineas), palabras: n(r.palabras), enlaces: [], menciones: [] };
    }
    const texto = el.original;
    return {
      lineas: contarLineas(texto),
      palabras: texto.split(/\s+/).filter(Boolean).length,
      enlaces: enlacesDe(texto),
      menciones: mencionesDe(texto).filter((r) => r !== el.frontmatter.ref),
    };
  },

  resumen: (d) => ({ lineas: d.lineas, palabras: d.palabras, enlaces: d.enlaces.length, menciones: d.menciones }),

  resumenLegible(r, idioma) {
    const partes: string[] = [];
    if (typeof r.lineas === 'number') partes.push(textos.t(idioma, 'lineas', { n: r.lineas }));
    if (typeof r.enlaces === 'number' && r.enlaces > 0) partes.push(textos.t(idioma, 'enlaces', { n: r.enlaces }));
    return partes.join(' · ');
  },

  respuesta(_el, d, ctx) {
    const t = (clave: Parameters<typeof textos.t>[1], vars?: Record<string, string | number>) =>
      textos.t(ctx.idioma, clave, vars);
    const guardado: Fragmento = { t: 'texto', v: t('guardado') };
    const coleccion = ctx.colecciones[0];
    if (coleccion)
      return {
        texto: [guardado, { t: 'texto', v: ` ${t('coleccion', { nombre: coleccion })}` }],
        acciones: [
          { id: `coleccion:${coleccion}`, etiqueta: t('siColeccion', { nombre: coleccion }) },
          { id: 'no', etiqueta: t('no') },
        ],
      };
    if (d.menciones.length) {
      const refs = d.menciones.slice(0, 3);
      const mas = d.menciones.length - refs.length;
      const piezas: Fragmento[] = [{ t: 'texto', v: ` ${t('menciona')}` }];
      refs.forEach((ref, i) => {
        if (i > 0) piezas.push({ t: 'texto', v: i === refs.length - 1 && !mas ? t('y') : ', ' });
        piezas.push({ t: 'ref', ref });
      });
      // Con más de tres, se dice cuántas faltan: nunca una lista incompleta como si fuera entera.
      piezas.push({ t: 'texto', v: mas ? `${t('yMas', { n: mas })}.` : '.' });
      return { texto: [guardado, ...piezas] };
    }
    return { texto: [guardado] };
  },

  cifras: {
    lineas: (d) => ({ texto: String(d.lineas), valor: d.lineas }),
    palabras: (d) => ({ texto: String(d.palabras), valor: d.palabras }),
  },

  textoIndexable: (d) => d.enlaces.join('\n'),
};
