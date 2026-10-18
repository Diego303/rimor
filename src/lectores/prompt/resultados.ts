/**
 * Resultados de un prompt (LEC-07): respuestas pegadas al lado, con valoración de 1 a 5 y una nota. Cada uno va
 * en `historial/REF/resultado-AAAA-MM-DD.md` y se apunta en `resultados` del frontmatter (Anexo B). TS puro.
 */
import { escribirYaml, unir } from '@rimor/formato';

export interface ResultadoPrompt {
  /** `AAAA-MM-DD`. */
  fecha: string;
  valoracion: number;
  nota: string;
  archivo: string;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Los resultados del frontmatter que se entienden (los demás se dejan como están, pero no se enseñan). */
export function resultadosDe(frontmatter: Record<string, unknown>): ResultadoPrompt[] {
  const lista = frontmatter.resultados;
  if (!Array.isArray(lista)) return [];
  const validos: ResultadoPrompt[] = [];
  for (const r of lista) {
    if (!r || typeof r !== 'object') continue;
    const { fecha, valoracion, nota, archivo } = r as Record<string, unknown>;
    // El YAML puede dar la fecha como texto o como Date.
    const dia = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : fecha;
    if (typeof dia !== 'string' || !FECHA.test(dia)) continue;
    if (typeof valoracion !== 'number' || !Number.isInteger(valoracion) || valoracion < 1 || valoracion > 5) continue;
    validos.push({
      fecha: dia,
      valoracion,
      nota: typeof nota === 'string' ? nota : '',
      archivo: typeof archivo === 'string' ? archivo : '',
    });
  }
  return validos;
}

/** Media de las valoraciones, o `null` sin resultados. */
export function valoracionMedia(resultados: readonly ResultadoPrompt[]): number | null {
  if (!resultados.length) return null;
  return resultados.reduce((s, r) => s + r.valoracion, 0) / resultados.length;
}

/** Ruta sin extensión del archivo de un resultado; el repositorio añade `-2`, `-3`… si ya existe. */
export const baseResultado = (ref: string, fecha: string) => `historial/${ref}/resultado-${fecha}`;

/** El archivo del resultado: frontmatter con la valoración y la nota, y la respuesta en el cuerpo. */
export function archivoResultado(r: {
  ref: string;
  fecha: string;
  valoracion: number;
  nota: string;
  respuesta: string;
}): string {
  const yaml = escribirYaml({ ref: r.ref, fecha: r.fecha, valoracion: r.valoracion, nota: r.nota });
  return unir(yaml, r.respuesta.trim() ? `${r.respuesta.trim()}\n` : '');
}

/** El frontmatter con un resultado más, al final (el orden es el de captura). */
export function conResultado<F extends Record<string, unknown>>(frontmatter: F, r: ResultadoPrompt): F {
  const previos = Array.isArray(frontmatter.resultados) ? frontmatter.resultados : [];
  return { ...frontmatter, resultados: [...previos, { ...r }] };
}

/** «★★★★☆». */
export const estrellas = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
