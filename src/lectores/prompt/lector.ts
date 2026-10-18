/**
 * Lector Prompt (LEC-07, plan §8.4): prompts, skills, definiciones de agentes y `CLAUDE.md`. Variables en tres
 * sintaxis para «copiar con valores», tokens aproximados, secciones y destino; los resultados (respuesta,
 * valoración y nota) se guardan en el historial del elemento.
 */
import type { Elemento } from '@rimor/formato';
import type { Idioma } from '../../i18n/formatos';
import { fmtNumero } from '../../i18n/formatos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { analizarPrompt, confianzaPrompt, type DatosPrompt, frontmatterDe } from './analisis';
import { textos } from './textos';

export type { DatosPrompt } from './analisis';

const LARGO_TITULO = 80;

/** Título: el `name` de una skill o un agente, el primer encabezado o la primera frase. */
export function tituloDePrompt(texto: string): string {
  const fm = frontmatterDe(texto);
  if (fm?.name) return fm.name.slice(0, LARGO_TITULO);
  const sinFm = texto.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  const encabezado = /^#{1,6}\s+(.+?)\s*#*\s*$/m.exec(sinFm)?.[1];
  if (encabezado) return encabezado.slice(0, LARGO_TITULO);
  const primera = (sinFm.split('\n').find((l) => l.trim()) ?? '').trim();
  const frase = (/^(.+?[.:!?])(?:\s|$)/.exec(primera)?.[1] ?? primera).replace(/[.:]$/, '');
  if (!frase) return textos.t('es', 'titulo');
  return frase.length > LARGO_TITULO ? `${frase.slice(0, LARGO_TITULO - 1)}…` : frase;
}

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

export const lectorPrompt: Lector<DatosPrompt> = {
  nombre: 'prompt',
  tipo: 'prompt',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto !== undefined ? confianzaPrompt(e.texto) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const d = analizarPrompt(texto);
    return {
      titulo: tituloDePrompt(texto),
      original: texto,
      resumen: lectorPrompt.resumen(d),
    };
  },

  async derivar(el: Elemento): Promise<DatosPrompt> {
    if (el.original === null) throw new Error('prompt.sinOriginal');
    return analizarPrompt(el.original);
  },

  // Como el Anexo B: `{ variables: [adr, contexto], tokens_aprox: 410, destino: "Claude" }`.
  resumen: (d) => ({
    variables: d.variables.map((v) => v.nombre),
    tokens_aprox: d.tokens,
    forma: d.forma,
    ...(d.destino ? { destino: d.destino } : {}),
  }),

  resumenLegible(r, idioma) {
    const forma = typeof r.forma === 'string' ? r.forma : 'libre';
    const n = Array.isArray(r.variables) ? r.variables.length : 0;
    const base = t(idioma, 'legible', {
      forma: t(idioma, `formas.${forma}`),
      variables: t(idioma, 'variables', { n }),
    });
    return typeof r.destino === 'string' ? `${base} · ${t(idioma, 'para', { destino: r.destino })}` : base;
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const n = d.variables.length;
    const tokens = fmtNumero(d.tokens, i);
    const copiar = n ? ` ${t(i, 'respuesta.copiar')}` : '';
    let primera: string;
    if ((d.forma === 'skill' || d.forma === 'agente') && d.nombre) {
      const clave = d.forma === 'skill' ? 'skill' : 'agente';
      primera = n
        ? t(i, `respuesta.${clave}`, { nombre: d.nombre, n })
        : t(i, `respuesta.${clave}SinVariables`, { nombre: d.nombre, tokens });
    } else if (d.forma === 'claude-md' && !n) primera = t(i, 'respuesta.claudeMd', { tokens });
    else primera = n ? t(i, 'respuesta.conVariables', { n }) : t(i, 'respuesta.sinVariables', { tokens });
    return { texto: [{ t: 'texto', v: `${primera}${copiar}` }] };
  },

  cifras: {
    variables: (d) => ({ texto: fmtNumero(d.variables.length, 'es'), valor: d.variables.length }),
    tokens: (d) => ({ texto: fmtNumero(d.tokens, 'es'), valor: d.tokens, unidad: 'tokens' }),
  },

  textoIndexable: (d) => [...d.variables.map((v) => v.nombre), ...d.secciones, d.destino ?? ''].join('\n'),
};
