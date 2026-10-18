/**
 * Lector Documento Markdown (LEC-08, plan §8.5): índice de secciones con anclas estables, palabras, tareas por
 * sección y en total, enlaces y bloques de código. La detección es barata (`deteccion.ts`); el análisis con remark
 * se carga solo al derivar, en el Worker.
 */
import type { Elemento } from '@rimor/formato';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { encabezadoDe } from '../prompt/analisis';
import { confianzaMarkdown, palabrasAprox } from './deteccion';
import { type DatosMarkdown, indiceDe } from './indice';
import { textos } from './textos';

export type { DatosMarkdown } from './indice';

const LARGO_TITULO = 100;

/** Título: el primer encabezado o, si no hay, la primera línea con texto. */
export function tituloDeDocumento(texto: string): string {
  const lineas = texto.split('\n');
  const h = lineas.map(encabezadoDe).find((x) => x)?.titulo;
  const base = h ?? (lineas.find((l) => l.trim()) ?? '').trim().replace(/^[-*+>]\s+/, '');
  if (!base) return textos.t('es', 'titulo');
  return base.length > LARGO_TITULO ? `${base.slice(0, LARGO_TITULO - 1)}…` : base;
}

/** Cuántas secciones tiene el índice (sin el título del documento). */
const enIndice = (d: DatosMarkdown) => indiceDe(d).length;

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

export const lectorMarkdown: Lector<DatosMarkdown> = {
  nombre: 'markdown',
  tipo: 'markdown',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto !== undefined ? confianzaMarkdown(e.texto) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    return { titulo: tituloDeDocumento(texto), original: texto, resumen: { palabras: palabrasAprox(texto) } };
  },

  async derivar(el: Elemento): Promise<DatosMarkdown> {
    if (el.original === null) throw new Error('markdown.sinOriginal');
    // remark solo hace falta aquí: así no entra en la carga inicial (el registro carga este archivo para detectar).
    const { analizarMarkdown } = await import('./analisis');
    return analizarMarkdown(el.original);
  },

  resumen: (d) => ({
    secciones: enIndice(d),
    palabras: d.palabras,
    tareas_hechas: d.tareas.hechas,
    tareas_total: d.tareas.total,
  }),

  resumenLegible(r, idioma) {
    const partes: string[] = [];
    if (typeof r.secciones === 'number' && r.secciones > 0) partes.push(t(idioma, 'secciones', { n: r.secciones }));
    if (typeof r.palabras === 'number') partes.push(t(idioma, 'palabras', { n: r.palabras }));
    if (typeof r.tareas_total === 'number' && r.tareas_total > 0)
      partes.push(t(idioma, 'legibleTareas', { hechas: Number(r.tareas_hechas) || 0, total: r.tareas_total }));
    return partes.join(' · ');
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const n = enIndice(d);
    const palabras = t(i, 'palabras', { n: d.palabras });
    let v: string;
    if (!n) v = t(i, 'respuesta.sinSecciones', { palabras });
    else if (!d.tareas.total) v = t(i, 'respuesta.sinTareas', { secciones: t(i, 'secciones', { n }), palabras });
    else
      v = t(i, d.tareas.hechas === 1 ? 'respuesta.conTareasUna' : 'respuesta.conTareas', {
        secciones: t(i, 'secciones', { n }),
        tareas: t(i, 'tareas', { n: d.tareas.total }),
        hechas: fmtNumero(d.tareas.hechas, i),
      });
    return { texto: [{ t: 'texto', v }] };
  },

  cifras: {
    tareas_hechas: (d) => ({ texto: fmtNumero(d.tareas.hechas, 'es'), valor: d.tareas.hechas }),
    tareas_total: (d) => ({ texto: fmtNumero(d.tareas.total, 'es'), valor: d.tareas.total }),
    palabras: (d) => ({ texto: fmtNumero(d.palabras, 'es'), valor: d.palabras }),
  },

  textoIndexable: (d) => d.secciones.map((s) => s.titulo).join('\n'),
};
