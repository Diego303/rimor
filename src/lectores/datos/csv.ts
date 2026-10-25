/**
 * Reconocer un CSV o un TSV pegado (IN-044, Anexo D puesto 8: «separador consistente en todas las filas»): al menos 3
 * filas y 2 columnas con el mismo número de campos en todas. Un campo entre comillas puede llevar separadores y
 * saltos de línea. Una tabla de Markdown, código o un log con milisegundos tras coma no lo son. TS puro y barato (lo
 * usa la detección en cada pegado): para decidir se miran las primeras filas y solo el ganador se recorre entero.
 */

export const SEPARADORES = [',', ';', '\t', '|'] as const;
export type Separador = (typeof SEPARADORES)[number];

/** Como mucho se miran estas filas para decidir (un CSV enorme se reconoce por su principio). */
const FILAS_MUESTRA = 200;

export interface FormaCsv {
  separador: Separador;
  columnas: number;
  /** Filas de datos (sin la cabecera). */
  filas: number;
}

/**
 * Las filas de un texto con este separador, como sus campos (las primeras `max`), y cuántas hay si `contarTodas`.
 * Una comilla abre un campo solo al principio de este (`5" de pantalla` no abre nada); dentro, `""` es una comilla
 * y un salto de línea no corta la fila. Las líneas en blanco no cuentan. Con índices y `slice` (no carácter a
 * carácter): se usa en cada pegado y un CSV de 2 MB se recorre entero para contar sus filas.
 */
export function filasCsv(
  texto: string,
  sep: Separador,
  max = FILAS_MUESTRA,
  contarTodas = false,
): { filas: string[][]; total: number } {
  const SEP = sep.charCodeAt(0);
  const filas: string[][] = [];
  let total = 0;
  let campos: string[] = [];
  /** Lo de un campo entre comillas ya leído (los trozos entre `""`). */
  let entreComillas: string | null = null;
  let inicio = 0;
  let vacia = true;
  const guardar = () => filas.length < max;
  const cerrarCampo = (fin: number) => {
    if (!guardar()) return;
    campos.push(
      entreComillas !== null ? entreComillas + texto.slice(inicio, fin).trim() : texto.slice(inicio, fin).trim(),
    );
  };
  const cerrarFila = (fin: number) => {
    if (!vacia || texto.slice(inicio, fin).trim()) {
      cerrarCampo(fin);
      if (guardar()) filas.push(campos);
      total++;
    }
    campos = [];
    entreComillas = null;
    vacia = true;
  };
  // Pasada la última comilla, ninguna fila se parte en varias líneas: el resto se cuenta por líneas, de golpe.
  const ultimaComilla = texto.lastIndexOf('"');
  let i = 0;
  for (; i < texto.length; i++) {
    if (!contarTodas && total >= max) return { filas, total };
    const c = texto.charCodeAt(i);
    if (c === 0x22 && !texto.slice(inicio, i).trim()) {
      // Un campo entre comillas: hasta la comilla que lo cierra (`""` es una comilla dentro).
      let trozos = '';
      let desde = i + 1;
      let j = desde;
      for (;;) {
        j = texto.indexOf('"', j);
        if (j < 0) {
          j = texto.length;
          break;
        }
        if (texto.charCodeAt(j + 1) !== 0x22) break;
        if (guardar()) trozos += texto.slice(desde, j + 1);
        j += 2;
        desde = j;
      }
      entreComillas = guardar() ? trozos + texto.slice(desde, j) : '';
      vacia = false;
      i = j;
      inicio = j + 1;
    } else if (c === SEP) {
      cerrarCampo(i);
      entreComillas = null;
      inicio = i + 1;
      vacia = false;
    } else if (c === 0x0a || c === 0x0d) {
      cerrarFila(i);
      if (c === 0x0d && texto.charCodeAt(i + 1) === 0x0a) i++;
      inicio = i + 1;
      if (contarTodas && !guardar() && i > ultimaComilla)
        return { filas, total: total + (texto.slice(inicio).match(LINEA_CON_ALGO) ?? []).length };
    }
  }
  cerrarFila(Math.min(i, texto.length));
  return { filas, total };
}

/** Una línea que no está en blanco. */
const LINEA_CON_ALGO = /^.*\S.*$/gm;

/** La fila de guiones de una tabla de Markdown (`|---|:-:|`, también corta: `|-|-|`). */
const FILA_MARKDOWN = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?\s*$|^\s*\|\s*:?-+:?\s*\|\s*$/;

/** Una línea de log de Python (`%(asctime)s`): la coma es la de los milisegundos, no un separador. */
const LINEA_ASCTIME = /^\s*\[?\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2},\d{3}\]?\s/;

/** La forma del texto si es un CSV o un TSV; `null` si no lo es. */
export function formaCsv(texto: string): FormaCsv | null {
  const lineas: string[] = [];
  for (const l of texto.split(/\r\n?|\n/, FILAS_MUESTRA * 2)) if (l.trim()) lineas.push(l);
  if (lineas.length < 3) return null;
  const muestra = lineas.slice(0, FILAS_MUESTRA);
  // Una tabla de Markdown: `| a | b |` con su fila de guiones.
  if (FILA_MARKDOWN.test(muestra[1] ?? '')) return null;
  // Código con una coma por línea (`const suma = (a, b) => a + b;`): asignaciones, flechas o llaves y paréntesis al final.
  if (muestra.filter((l) => / = |=>|[{}]\s*$|\)\s*;?\s*$/.test(l)).length * 2 >= muestra.length) return null;
  const asctime = muestra.filter((l) => LINEA_ASCTIME.test(l)).length * 2 >= muestra.length;
  let mejor: { separador: Separador; columnas: number } | null = null;
  for (const separador of SEPARADORES) {
    // Sin el separador en la cabecera no hay dos columnas (se mira su principio, barato).
    if ((separador === ',' && asctime) || !(muestra[0] ?? '').includes(separador)) continue;
    const { filas } = filasCsv(texto, separador);
    const n = filas[0]?.length ?? 0;
    if (n < 2 || filas.length < 3 || !filas.every((f) => f.length === n)) continue;
    if (!mejor || n > mejor.columnas) mejor = { separador, columnas: n };
  }
  if (!mejor) return null;
  return { ...mejor, filas: filasCsv(texto, mejor.separador, 0, true).total - 1 };
}

const NUMERO = /^-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?$/i;

/**
 * Confianza de que el texto sea datos tabulares: 0,85 con la forma de un CSV o un TSV (0,8 con `|`, que también
 * usan algunos logs), y algo más si la cabecera no tiene números y los datos sí.
 */
export function puntuarCsv(texto: string): number {
  const forma = formaCsv(texto);
  if (!forma) return 0;
  const [cabecera = [], primera = []] = filasCsv(texto, forma.separador, 2).filas;
  const conCabecera = cabecera.every((c) => c && !NUMERO.test(c)) && primera.some((c) => NUMERO.test(c));
  const base = forma.separador === '|' ? 0.8 : 0.85;
  return conCabecera ? base + 0.05 : base;
}
