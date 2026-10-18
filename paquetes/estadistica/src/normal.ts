/**
 * Distribución normal estándar. `erfc` con la aproximación de Chebyshev de Numerical Recipes (§6.2), de error
 * relativo menor que 1,2·10⁻⁷ en toda la recta: suficiente para p-valores con tolerancia 10⁻⁶.
 */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t *
                  (0.09678418 +
                    t *
                      (-0.18628806 +
                        t *
                          (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Función de distribución de la normal estándar. */
export const fda = (z: number): number => 0.5 * erfc(-z / Math.SQRT2);
