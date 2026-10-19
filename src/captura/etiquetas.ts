/**
 * Etiquetas que Rimor infiere al capturar (ORG-03): los hashtags del texto, los dominios y paquetes de sus
 * enlaces, el lenguaje que dice su lector y los niveles de un log con errores o avisos. Se guardan con las que el
 * usuario escribe con `#` (y se pueden quitar a mano: solo se infieren al capturar). TS puro.
 */
import type { TipoElemento } from '@rimor/formato';
import { analizarLinea } from '../lectores/log/analisis';

/** Como mucho, tantas inferidas por elemento. */
export const MAX_INFERIDAS = 8;
/** Cuánto texto se mira (un log enorme no tiene que recorrerse entero para esto). */
const MUESTRA = 200 * 1024;

const CERCA = /^ {0,3}(`{3,}|~{3,})/;
/** `#palabra` tras un espacio, un paréntesis o «¿¡», con al menos una letra (no un color hexadecimal ni un número). */
const HASHTAG = /(?:^|[\s(¿¡])#([\p{L}\p{N}_][\p{L}\p{N}_-]*)/gu;
/** Directivas de preprocesador (`#include`, `#define`…) al principio de una línea: código, no etiquetas. */
const DIRECTIVA =
  /^\s*#\s*(?:include|define|undef|if|ifdef|ifndef|elif|else|endif|pragma|import|error|warning|region|endregion|line)\b/;
/** Código en línea (`` `git log #rama` ``): lo de dentro no son etiquetas. */
const CODIGO_EN_LINEA = /`[^`\n]*`/g;
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
    if (enCodigo || /^\s{0,3}#{1,6}\s/.test(linea) || DIRECTIVA.test(linea)) continue;
    for (const m of linea.replace(CODIGO_EN_LINEA, ' ').matchAll(HASHTAG)) {
      // Sin guiones ni subrayados al final (`#tag-` es `tag`).
      const t = (m[1] ?? '').replace(/[-_]+$/, '');
      if (/\p{L}/u.test(t) && !COLOR.test(t)) salida.push(t);
    }
  }
  return salida;
}

/** Registros de paquetes: de sus enlaces sale el paquete, no el dominio. */
const REGISTROS = new Set(['npmjs.com', 'pypi.org', 'crates.io', 'pkg.go.dev']);

/** El paquete de un enlace a un registro de paquetes, si lo es. */
function paqueteDe(url: URL): string | null {
  const partes = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'npmjs.com' && partes[0] === 'package')
    return partes[1]?.startsWith('@') ? `${partes[1]}/${partes[2] ?? ''}` : (partes[1] ?? null);
  if (host === 'pypi.org' && partes[0] === 'project') return partes[1] ?? null;
  if (host === 'crates.io' && partes[0] === 'crates') return partes[1] ?? null;
  // pkg.go.dev/github.com/a/b@v1.2.3: el módulo sin su versión; sus páginas propias (`search`, `std`), nada.
  if (host === 'pkg.go.dev') {
    const modulo = partes.join('/').replace(/@[^/]*$/, '');
    return modulo && !['search', 'std', 'about'].includes(modulo) ? modulo : null;
  }
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
    const host = url.hostname.replace(/^www\./, '');
    if (paquete) salida.push(paquete);
    // Una página del registro de paquetes que no es un paquete (una búsqueda): ni paquete ni dominio.
    else if (REGISTROS.has(host)) continue;
    // Una máquina local o una IP no dicen de qué va: no son etiquetas.
    else if (
      host !== 'localhost' &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) &&
      !host.startsWith('[') &&
      host.includes('.')
    )
      salida.push(host);
  }
  return salida;
}

/** Líneas que se miran para los niveles (los primeros que aparecen bastan). */
const LINEAS_NIVELES = 5000;

/**
 * Los niveles de un log, con la misma lectura de cada línea que el lector Log (`level=error`, JSON, `[WARN]`…):
 * `error` si tiene errores y `warn` si tiene avisos.
 */
function niveles(texto: string): string[] {
  let error = false;
  let aviso = false;
  const anio = new Date().getFullYear();
  for (const linea of texto.split('\n', LINEAS_NIVELES)) {
    if (!linea.trim()) continue;
    const { nivel } = analizarLinea(linea, anio);
    if (nivel === 'ERROR' || nivel === 'FATAL') error = true;
    else if (nivel === 'WARN') aviso = true;
    if (error && aviso) break;
  }
  return [...(error ? ['error'] : []), ...(aviso ? ['warn'] : [])];
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
    // En código, `#` es un comentario o una directiva, no una etiqueta.
    ...(tipo === 'codigo' ? [] : hashtags(muestra)),
    ...lenguaje,
    ...(tipo === 'log' ? niveles(muestra) : []),
    ...deEnlaces(muestra),
  ].map((e) => e.toLocaleLowerCase().replace(/\s+/g, '-'));
  return [...new Set(todas.filter(Boolean))].slice(0, MAX_INFERIDAS);
}
