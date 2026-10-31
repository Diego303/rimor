/**
 * Estimador de Hodges-Lehmann de la diferencia de posición entre dos series, con su intervalo (LEC-06, v0.2;
 * IN-047): la mediana de las m·n diferencias `b − a` y el intervalo de Moses (Hollander y Wolfe): las diferencias
 * ordenadas D₍ₖ₎ y D₍ₘₙ₊₁₋ₖ₎, con k el valor crítico de la U de Mann-Whitney. Exacto (la distribución de U por
 * recuento) con m·n ≤ 400 y sin empates; si no, con la aproximación normal, la corrección por empates y la de
 * continuidad. Sin escribir las m·n diferencias: las que hacen falta se buscan contando (O((m + n)·log)).
 */
import { todosFinitos, Z95 } from './descriptiva';

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

/**
 * Cuántas diferencias `b[j] − a[i]` son ≤ t, con `a` y `b` ordenadas: un recorrido de dos punteros, O(m + n).
 * Para cada `b[j]`, las `a[i]` ≥ b[j] − t; al subir `b[j]`, ese umbral solo sube.
 */
function contarHasta(a: Float64Array, b: Float64Array, t: number): number {
  let total = 0;
  let i = a.length;
  // Recorriendo `b` de mayor a menor, el primer `a[i]` ≥ b[j] − t solo baja.
  for (let j = b.length - 1; j >= 0; j--) {
    const umbral = (b[j] ?? 0) - t;
    while (i > 0 && (a[i - 1] ?? 0) >= umbral) i--;
    total += a.length - i;
  }
  return total;
}

/**
 * La k-ésima diferencia más pequeña (desde 1) de todas las `b[j] − a[i]`, sin escribirlas todas (con 10.000 × 10.000
 * serían 800 MB): se acota el valor por bisección contando con `contarHasta` y, cuando entre las cotas quedan pocas,
 * se enumeran y se elige. El resultado es una de las diferencias, exacta.
 */
function kesima(a: Float64Array, b: Float64Array, k: number): number {
  const m = a.length;
  const n = b.length;
  let bajo = (b[0] ?? 0) - (a[m - 1] ?? 0); // la menor diferencia
  let alto = (b[n - 1] ?? 0) - (a[0] ?? 0); // la mayor
  if (k <= 1) return bajo;
  if (k >= m * n) return alto;
  // Invariante: contar(bajo) < k ≤ contar(alto); se empieza justo por debajo de la menor.
  bajo = bajo - Math.max(1, Math.abs(bajo)) * 1e-9 - Number.MIN_VALUE;
  const tope = Math.max(m + n, 1024);
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const entre = contarHasta(a, b, alto) - contarHasta(a, b, bajo);
    if (entre <= tope) break;
    const medio = bajo + (alto - bajo) / 2;
    // Sin sitio entre las dos cotas (coma flotante): todo lo que queda vale `alto`.
    if (medio <= bajo || medio >= alto) return alto;
    if (contarHasta(a, b, medio) >= k) alto = medio;
    else bajo = medio;
  }
  // Las diferencias en (bajo, alto], ordenadas: la que hace la k-ésima. Para cada `b[j]` (de menor a mayor), las
  // `a[i]` en [b[j] − alto, b[j] − bajo): los dos extremos solo suben.
  const candidatas: number[] = [];
  let desde = 0;
  let hasta = 0;
  for (let j = 0; j < n; j++) {
    const y = b[j] ?? 0;
    while (desde < m && y - (a[desde] ?? 0) > alto) desde++;
    if (hasta < desde) hasta = desde;
    while (hasta < m && y - (a[hasta] ?? 0) > bajo) hasta++;
    for (let i = desde; i < hasta; i++) candidatas.push(y - (a[i] ?? 0));
  }
  candidatas.sort((x, y) => x - y);
  return candidatas[k - contarHasta(a, b, bajo) - 1] ?? alto;
}

export const hodgesLehmann: HodgesLehmann = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (!m || !n || !todosFinitos(a) || !todosFinitos(b)) return NADA;
  const x = Float64Array.from(a).sort();
  const y = Float64Array.from(b).sort();
  const N = m * n;
  const estimacion = N % 2 ? kesima(x, y, (N + 1) / 2) : (kesima(x, y, N / 2) + kesima(x, y, N / 2 + 1)) / 2;
  const todos = [...a, ...b].sort((p, q) => p - q);
  const conEmpates = todos.some((v, i) => i > 0 && v === todos[i - 1]);
  const exacto = N <= MAXIMO_EXACTO && !conEmpates;
  // k: el mayor tal que P(U ≤ k − 1) ≤ α/2 (exacto) o su aproximación normal con corrección de continuidad (la
  // misma de Mann-Whitney): ⌊mn/2 − z·σ + ½⌋.
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
    critico = Math.floor(N / 2 - Z95 * Math.sqrt(varianza) + 0.5);
  }
  if (critico < 1) return { estimacion, icBajo: Number.NaN, icAlto: Number.NaN, exacto };
  return { estimacion, icBajo: kesima(x, y, critico), icAlto: kesima(x, y, N - critico + 1), exacto };
};
