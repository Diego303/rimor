/**
 * Reconocer un CSV o un TSV pegado (IN-044, Anexo D puesto 8: «separador consistente en todas las filas»): al menos 3
 * filas y 2 columnas con el mismo número de separadores fuera de comillas en todas. Una tabla de Markdown no lo es.
 * TS puro y barato (lo usa la detección en cada pegado).
 */

export const SEPARADORES = [',', ';', '\t', '|'] as const;
export type Separador = (typeof SEPARADORES)[number];

/** Como mucho se miran estas líneas para decidir (un CSV enorme se reconoce por su principio). */
const LINEAS_MUESTRA = 200;

export interface FormaCsv {
  separador: Separador;
  columnas: number;
  /** Filas de datos (sin la cabecera), contadas por líneas: aproximadas si hay campos con saltos de línea. */
  filas: number;
}

/** Separadores fuera de comillas dobles (`"a,b"` es un campo; `""` dentro es una comilla). */
export function contarSeparadores(linea: string, sep: Separador): number {
  let n = 0;
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (dentro && linea[i + 1] === '"') i++;
      else dentro = !dentro;
    } else if (c === sep && !dentro) n++;
  }
  return n;
}

/** Los campos de una línea (para mirar la cabecera). */
export function camposDe(linea: string, sep: Separador): string[] {
  const campos: string[] = [];
  let actual = '';
  let dentro = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i] ?? '';
    if (c === '"') {
      if (dentro && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else dentro = !dentro;
    } else if (c === sep && !dentro) {
      campos.push(actual.trim());
      actual = '';
    } else actual += c;
  }
  campos.push(actual.trim());
  return campos;
}

/** La forma del texto si es un CSV o un TSV; `null` si no lo es. */
export function formaCsv(texto: string): FormaCsv | null {
  const lineas = texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  if (lineas.length < 3) return null;
  const muestra = lineas.slice(0, LINEAS_MUESTRA);
  // Una tabla de Markdown: `| a | b |` con su fila de guiones.
  if (/^\s*\|?\s*:?-{3,}/.test(muestra[1] ?? '')) return null;
  // Código con una coma por línea (`const suma = (a, b) => a + b;`): asignaciones, flechas o llaves y paréntesis al final.
  if (muestra.filter((l) => / = |=>|[{}]\s*$|\)\s*;?\s*$/.test(l)).length * 2 >= muestra.length) return null;
  let mejor: FormaCsv | null = null;
  for (const separador of SEPARADORES) {
    const n = contarSeparadores(muestra[0] ?? '', separador);
    if (n < 1 || !muestra.every((l) => contarSeparadores(l, separador) === n)) continue;
    if (!mejor || n + 1 > mejor.columnas) mejor = { separador, columnas: n + 1, filas: lineas.length - 1 };
  }
  return mejor;
}

const NUMERO = /^-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i;

/**
 * Confianza de que el texto sea datos tabulares: 0,85 con la forma de un CSV o un TSV (0,8 con `|`, que también
 * usan algunos logs), y algo más si la cabecera no tiene números y los datos sí.
 */
export function puntuarCsv(texto: string): number {
  const forma = formaCsv(texto);
  if (!forma) return 0;
  const lineas = texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  const cabecera = camposDe(lineas[0] ?? '', forma.separador);
  const primera = camposDe(lineas[1] ?? '', forma.separador);
  const conCabecera = cabecera.every((c) => c && !NUMERO.test(c)) && primera.some((c) => NUMERO.test(c));
  const base = forma.separador === '|' ? 0.8 : 0.85;
  return conCabecera ? base + 0.05 : base;
}
