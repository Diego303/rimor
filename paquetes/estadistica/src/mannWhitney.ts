/**
 * Prueba de Mann-Whitney U para dos muestras independientes (CMP-01), con la aproximación normal, corrección
 * por empates y corrección de continuidad; p bilateral. Coincide con
 * `scipy.stats.mannwhitneyu(x, y, alternative='two-sided', method='asymptotic', use_continuity=True)`.
 */
import { fda } from './normal';

export interface ResultadoMannWhitney {
  /** U de la primera muestra (suma de rangos de x − n₁(n₁+1)/2). */
  u: number;
  p: number;
}

export function mannWhitney(x: readonly number[], y: readonly number[]): ResultadoMannWhitney {
  const n1 = x.length;
  const n2 = y.length;
  if (!n1 || !n2) return { u: Number.NaN, p: Number.NaN };
  const todos = [...x.map((v) => [v, 0] as const), ...y.map((v) => [v, 1] as const)].sort((a, b) => a[0] - b[0]);
  const n = n1 + n2;
  let empates = 0;
  let rangosX = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && (todos[j + 1] as readonly [number, number])[0] === (todos[i] as readonly [number, number])[0])
      j++;
    const rango = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if ((todos[k] as readonly [number, number])[1] === 0) rangosX += rango;
    const t = j - i + 1;
    if (t > 1) empates += t ** 3 - t;
    i = j + 1;
  }
  const u = rangosX - (n1 * (n1 + 1)) / 2;
  const media = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - empates / (n * (n - 1))));
  if (!sigma) return { u, p: 1 };
  const desvio = Math.abs(u - media);
  // Corrección de continuidad hacia la media, sin pasarse de ella.
  const zc = Math.max(0, desvio - 0.5) / sigma;
  return { u, p: Math.min(1, 2 * (1 - fda(zc))) };
}
