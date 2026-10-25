/**
 * La ficha en el frontmatter del enlace (IN-041): `ficha` (la última consulta) y `fichaAnterior` (la de antes, para
 * enseñar qué cambió). No es contenido: guardarla no crea versión nueva. TS puro y ligero (lo usa la respuesta del
 * lector, que va en la carga inicial).
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import type { CamposFicha, Ficha, FuenteFicha } from './contrato';

const FUENTES: readonly FuenteFicha[] = ['github', 'gitlab', 'paquete', 'crossref', 'arxiv'];

/** Una ficha del frontmatter que se entiende (lo demás, `null`: de otra versión o editada a mano). */
export function leerFicha(x: unknown): Ficha | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const f = x as Record<string, unknown>;
  if (!FUENTES.includes(f.fuente as FuenteFicha) || typeof f.consultada !== 'string') return null;
  if (Number.isNaN(Date.parse(f.consultada)) || !f.campos || typeof f.campos !== 'object') return null;
  const campos: CamposFicha = {};
  for (const [k, v] of Object.entries(f.campos as Record<string, unknown>))
    if (typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) campos[k] = v;
  return { fuente: f.fuente as FuenteFicha, consultada: f.consultada, campos };
}

export const fichaDe = (fm: FrontmatterComun): Ficha | null => leerFicha((fm as Record<string, unknown>).ficha);
export const fichaAnteriorDe = (fm: FrontmatterComun): Ficha | null =>
  leerFicha((fm as Record<string, unknown>).fichaAnterior);

/** El elemento con la ficha nueva; la que tenía pasa a `fichaAnterior`. */
export function conFicha(el: Elemento, ficha: Ficha, ahora: string): Elemento {
  const anterior = fichaDe(el.frontmatter);
  const { fichaAnterior: _, ...resto } = el.frontmatter as Record<string, unknown>;
  return {
    ...el,
    frontmatter: {
      ...(resto as FrontmatterComun),
      modificado: ahora,
      ficha,
      ...(anterior ? { fichaAnterior: anterior } : {}),
    } as FrontmatterComun,
  };
}
