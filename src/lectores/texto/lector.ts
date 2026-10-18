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

/** Primera línea con contenido, sin las marcas de Markdown del principio (`#`, `-`, `*`, `>`, `1.`). */
export function tituloDe(texto: string): string {
  const linea = texto.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const limpia = linea
    .trim()
    .replace(/^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|>\s*|\d+[.)]\s+)/, '')
    .trim();
  return limpia.length > LARGO_TITULO ? `${limpia.slice(0, LARGO_TITULO - 1)}…` : limpia;
}

/** URL `http(s)://` del texto, sin repetir y sin la puntuación final que se les pega. */
export function enlacesDe(texto: string): string[] {
  const vistos = new Set<string>();
  for (const m of texto.matchAll(/\bhttps?:\/\/[^\s<>"'`]+/gi)) {
    let url = m[0].replace(/[.,;:!?]+$/, '');
    // Un paréntesis de cierre final solo es parte de la URL si abrió uno dentro (Wikipedia).
    while (url.endsWith(')') && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0))
      url = url.slice(0, -1);
    vistos.add(url);
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
    return { titulo: tituloDe(texto), original: texto, resumen: { lineas: contarLineas(texto) } };
  },

  async derivar(el: Elemento): Promise<DatosTexto> {
    const texto = el.original ?? '';
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
          { id: `coleccion:${coleccion}`, etiqueta: t('siColeccion', { nombre: coleccion }), principal: true },
          { id: 'no', etiqueta: t('no') },
        ],
      };
    if (d.menciones.length) {
      const refs = d.menciones.slice(0, 3);
      const piezas: Fragmento[] = [{ t: 'texto', v: ` ${t('menciona')}` }];
      refs.forEach((ref, i) => {
        if (i > 0) piezas.push({ t: 'texto', v: i === refs.length - 1 ? t('y') : ', ' });
        piezas.push({ t: 'ref', ref });
      });
      piezas.push({ t: 'texto', v: '.' });
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
