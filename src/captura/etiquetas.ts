/**
 * Etiquetas que Rimor infiere al capturar (ORG-03): los hashtags del texto, los dominios y paquetes de sus
 * enlaces, el lenguaje que dice su lector y los niveles de un log con errores o avisos. Se guardan con las que el
 * usuario escribe con `#` (y se pueden quitar a mano: solo se infieren al capturar). TS puro.
 */
import type { TipoElemento } from '@rimor/formato';

/** Como mucho, tantas inferidas por elemento. */
export const MAX_INFERIDAS = 8;
/** Cuánto texto se mira (un log enorme no tiene que recorrerse entero para esto). */
const MUESTRA = 200 * 1024;

const CERCA = /^ {0,3}(`{3,}|~{3,})/;
/** `#palabra` tras un espacio o al principio, con al menos una letra (no un color hexadecimal ni un número). */
const HASHTAG = /(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;
const COLOR = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const URL = /\bhttps?:\/\/[^\s<>"'`)\]]+/gi;

/** Los hashtags fuera de los bloques de código y que no son encabezados de Markdown. */
function hashtags(texto: string): string[] {
  const salida: string[] = [];
  let enCodigo = false;
  for (const linea of texto.split('\n')) {
    if (CERCA.test(linea)) {
      enCodigo = !enCodigo;
      continue;
    }
    if (enCodigo || /^\s{0,3}#{1,6}\s/.test(linea)) continue;
    for (const m of linea.matchAll(HASHTAG)) {
      const t = m[1] ?? '';
      if (/\p{L}/u.test(t) && !COLOR.test(t)) salida.push(t);
    }
  }
  return salida;
}

/** El paquete de un enlace a un registro de paquetes, si lo es. */
function paqueteDe(url: URL): string | null {
  const partes = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'npmjs.com' && partes[0] === 'package')
    return partes[1]?.startsWith('@') ? `${partes[1]}/${partes[2] ?? ''}` : (partes[1] ?? null);
  if (host === 'pypi.org' && partes[0] === 'project') return partes[1] ?? null;
  if (host === 'crates.io' && partes[0] === 'crates') return partes[1] ?? null;
  if (host === 'pkg.go.dev') return partes.join('/') || null;
  return null;
}

/** Dominios y paquetes de los enlaces del texto. */
function deEnlaces(texto: string): string[] {
  const salida: string[] = [];
  for (const m of texto.matchAll(URL)) {
    let url: URL;
    try {
      url = new globalThis.URL(m[0].replace(/[.,;:]+$/, ''));
    } catch {
      continue;
    }
    const paquete = paqueteDe(url);
    if (paquete) salida.push(paquete);
    else salida.push(url.hostname.replace(/^www\./, ''));
  }
  return salida;
}

/** Los niveles de un log: `error` si tiene errores y `warn` si tiene avisos. */
function niveles(texto: string): string[] {
  const salida: string[] = [];
  if (/\b(?:ERROR|FATAL|CRITICAL)\b/.test(texto)) salida.push('error');
  if (/\bWARN(?:ING)?\b/.test(texto)) salida.push('warn');
  return salida;
}

export interface EntradaEtiquetas {
  texto?: string;
  tipo: TipoElemento;
  /** El resumen que dejó el lector al leer (`lenguaje` en código y errores). */
  resumen?: Record<string, unknown>;
}

/** Las etiquetas inferidas, en minúsculas, sin repetir y como mucho `MAX_INFERIDAS`. */
export function etiquetasInferidas({ texto = '', tipo, resumen = {} }: EntradaEtiquetas): string[] {
  const muestra = texto.slice(0, MUESTRA);
  const lenguaje = typeof resumen.lenguaje === 'string' && resumen.lenguaje ? [resumen.lenguaje] : [];
  const todas = [
    ...hashtags(muestra),
    ...lenguaje,
    ...(tipo === 'log' ? niveles(muestra) : []),
    ...deEnlaces(muestra),
  ].map((e) => e.toLocaleLowerCase().replace(/\s+/g, '-'));
  return [...new Set(todas.filter(Boolean))].slice(0, MAX_INFERIDAS);
}
