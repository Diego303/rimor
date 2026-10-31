/**
 * Estimador de Hodges-Lehmann de la diferencia de posición entre dos series, con su intervalo (LEC-06, v0.2;
 * IN-047): la mediana de las m·n diferencias `b − a` y el intervalo de Moses (Hollander y Wolfe): las diferencias
 * ordenadas D₍ₖ₎ y D₍ₘₙ₊₁₋ₖ₎, con k el valor crítico de la U de Mann-Whitney. Exacto (la distribución de U por
 * recuento) con m·n ≤ 400 y sin empates; si no, con la aproximación normal y la corrección por empates.
 */
import { medianaOrdenada, todosFinitos, Z95 } from './descriptiva';

export interface ResultadoHodgesLehmann {
  /** Mediana de todas las diferencias b − a. */
  estimacion: number;
  /** Extremos del intervalo del 95 %; `NaN` si hay muy pocas mediciones para darlo. */
  icBajo: number;
  icAlto: number;
  /** Si el intervalo sale de la distribución exacta de U (o de la aproximación normal). */
  exacto: boolean;
}

export type HodgesLehmann = (a: readonly number[], b: readonly number[]) => ResultadoHodgesLehmann;

/** Hasta aquí (m·n), la distribución de U se calcula entera. */
export const MAXIMO_EXACTO = 400;

/**
 * Las probabilidades de U = 0, 1, …, m·n bajo la hipótesis nula (sin empates): los coeficientes del polinomio
 * de Gauss ∏ᵢ (1 − qⁿ⁺ⁱ) / (1 − qⁱ), divididos por C(m+n, m). En coma flotante con m·n ≤ 400 no pierde precisión
 * que importe (los recuentos caben de sobra en un `number` hasta C(40, 20)).
 */
export function distribucionU(m: number, n: number): number[] {
  // Recurrencia de recuentos: f(m, n, u) = f(m − 1, n, u − n) + f(m, n − 1, u), con la tabla por filas de n.
  let fila: number[][] = Array.from({ length: n + 1 }, () => [1]);
  for (let i = 1; i <= m; i++) {
    const nueva: number[][] = [[1]];
    for (let j = 1; j <= n; j++) {
      const maximo = i * j;
      const cuentas = new Array<number>(maximo + 1).fill(0);
      const sinX = nueva[j - 1] ?? [];
      const conX = fila[j] ?? [];
      for (let u = 0; u <= maximo; u++) cuentas[u] = (sinX[u] ?? 0) + (u >= j ? (conX[u - j] ?? 0) : 0);
      nueva.push(cuentas);
    }
    fila = nueva;
  }
  const cuentas = fila[n] ?? [1];
  const total = cuentas.reduce((s, c) => s + c, 0);
  return cuentas.map((c) => c / total);
}

const NADA: ResultadoHodgesLehmann = { estimacion: Number.NaN, icBajo: Number.NaN, icAlto: Number.NaN, exacto: false };

export const hodgesLehmann: HodgesLehmann = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (!m || !n || !todosFinitos(a) || !todosFinitos(b)) return NADA;
  const diferencias = new Float64Array(m * n);
  let k = 0;
  for (const y of b) for (const x of a) diferencias[k++] = y - x;
  diferencias.sort();
  const orden = Array.from(diferencias);
  const estimacion = medianaOrdenada(orden);
  const N = m * n;
  const todos = [...a, ...b].sort((x, y) => x - y);
  const conEmpates = todos.some((v, i) => i > 0 && v === todos[i - 1]);
  const exacto = N <= MAXIMO_EXACTO && !conEmpates;
  // k: el mayor tal que P(U ≤ k − 1) ≤ α/2 (exacto) o el redondeo hacia abajo de su aproximación normal.
  let critico: number;
  if (exacto) {
    const p = distribucionU(m, n);
    let acumulada = 0;
    critico = 0;
    while (critico < p.length && acumulada + (p[critico] ?? 0) <= 0.025 + 1e-12) acumulada += p[critico++] ?? 0;
  } else {
    let empates = 0;
    for (let i = 0; i < todos.length; ) {
      let j = i;
      while (j + 1 < todos.length && todos[j + 1] === todos[i]) j++;
      const t = j - i + 1;
      if (t > 1) empates += t ** 3 - t;
      i = j + 1;
    }
    const total = m + n;
    const varianza = (N / 12) * (total + 1 - empates / (total * (total - 1)));
    critico = Math.floor(N / 2 - Z95 * Math.sqrt(varianza));
  }
  if (critico < 1) return { estimacion, icBajo: Number.NaN, icAlto: Number.NaN, exacto };
  return { estimacion, icBajo: orden[critico - 1] ?? Number.NaN, icAlto: orden[N - critico] ?? Number.NaN, exacto };
};
