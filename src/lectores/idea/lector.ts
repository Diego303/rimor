/**
 * Lector Idea (LEC-02): un texto corto sin señales de otro tipo, o lo que se marca con `/idea`. Nace en
 * «semilla» y vuelve a los 7 días si no se hace nada con ella (ver `resurgir.ts`).
 */

import type { Elemento } from '@rimor/formato';
import { confianzaCodigo } from '../codigo/analisis';
import type { Borrador, Entrada, Lector } from '../contrato';
import { textos } from './textos';

export const ESTADOS_IDEA = ['semilla', 'explorando', 'aparcada', 'descartada', 'convertida'] as const;
export type EstadoIdea = (typeof ESTADOS_IDEA)[number];
/** Los que se pueden elegir a mano; «convertida» la pone IN-070 al convertirla en investigación. */
export const ESTADOS_ELEGIBLES: readonly EstadoIdea[] = ['semilla', 'explorando', 'aparcada', 'descartada'];

/** Menos de esto (y sin otras señales) es una idea (plan §8.8). */
export const LARGO_IDEA = 280;

/**
 * Señales de que un texto corto es otra cosa: un enlace, un log, una traza, mediciones, código, un comando o
 * Markdown. Solo sintaxis, nunca palabras sueltas: «Measure the return rate» o «Revisar el stack trace» son ideas.
 */
const SENALES_DE_OTRO = [
  /https?:\/\//i,
  /\b\d{1,2}:\d{2}:\d{2}\b/, // marca de tiempo de log (con segundos; «a las 10:30» es una idea)
  /^\s*\[?(?:ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL)\]?[\s:]|\[(?:ERROR|WARN|WARNING|INFO|DEBUG|TRACE|FATAL)\]/m, // nivel
  /\b\w*(?:Error|Exception)\s*:|^\s*(?:panic|Traceback|thread '.*' panicked)\b|panicked at|^\s*at \S+[.(:]/m, // traza
  /\d+(?:[.,]\d+)?\s*(?:ns|µs|us|ms|s|KB|MB|GB|%)\b.*\d+(?:[.,]\d+)?\s*(?:ns|µs|us|ms|s|KB|MB|GB|%)\b/i, // mediciones
  /[{};]\s*$|=>|\w\.\w+\(|\w\(\)|^\s*[A-Za-z_][\w.]*\s*=\s*\S|^\s*(?:SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/m, // código
  /^\s*(?:\$\s|>\s|(?:sudo|git|npm|pnpm|npx|yarn|docker|kubectl|curl|wget|ssh|ssh-keygen|cd|ls|cat|grep|find|rm|cp|mv|mkdir|chmod|echo|export|make|cargo|pip|python|python3|node|go|brew|apt|systemctl)\s+\S)/m, // comando
  /^\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s|```)/m, // Markdown
];

export function pareceIdea(texto: string): boolean {
  const t = texto.trim();
  if (!t || t.length >= LARGO_IDEA) return false;
  if (t.split(/\r?\n/).length > 3) return false;
  // Un fragmento de código corto (un bloque de Ruby de tres líneas) no es una idea: que no haya duda con Código.
  return !SENALES_DE_OTRO.some((r) => r.test(t)) && confianzaCodigo(t) === 0;
}

export interface DatosIdea {
  palabras: number;
  lineas: number;
}

const primeraLinea = (texto: string) => (texto.split(/\r?\n/).find((l) => l.trim()) ?? '').trim();

export const lectorIdea: Lector<DatosIdea> = {
  nombre: 'idea',
  tipo: 'idea',
  version: 1,
  textos,
  estados: ESTADOS_IDEA,

  // Un archivo soltado nunca es una idea (un `.env` o un `.yaml` de una línea): lo deciden su tipo o Texto.
  detectar: (e: Entrada) => (!e.archivos?.length && e.texto !== undefined && pareceIdea(e.texto) ? 0.7 : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    return {
      titulo: primeraLinea(texto).slice(0, 120),
      original: texto,
      resumen: { palabras: texto.split(/\s+/).filter(Boolean).length },
      // Sin `vuelve`: la primera vuelta se cuenta desde `creado` (con el reloj de la captura).
      metadatos: { estado: 'semilla' },
    };
  },

  async derivar(el: Elemento): Promise<DatosIdea> {
    const texto = el.original ?? '';
    return {
      palabras: texto.split(/\s+/).filter(Boolean).length,
      lineas: texto.trim() ? texto.trim().split(/\r?\n/).length : 0,
    };
  },

  resumen: (d) => ({ palabras: d.palabras }),

  resumenLegible: (r, idioma) =>
    typeof r.palabras === 'number' ? textos.t(idioma, 'palabras', { n: r.palabras }) : '',

  respuesta: (_el, _d, ctx) => ({ texto: [{ t: 'texto', v: textos.t(ctx.idioma, 'guardada') }] }),

  cifras: { palabras: (d) => ({ texto: String(d.palabras), valor: d.palabras }) },
};
