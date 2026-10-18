# IN-011 · Paquete de estadística

## Objetivo y catálogo

Cálculos de mediciones correctos y verificados. Soporte de **LEC-06** (mediciones) y **CMP-01** (comparación). Depende de IN-001.

## Estado de partida

- `paquetes/estadistica` es un esqueleto (IN-001) con `ordenados()`; `tsconfig` con `lib: ES2023` y sin tipos de DOM ni Node.
- Las pantallas de referencia calculan la estadística de mediciones en su script (`stats`, `mannWhitney`): son el resultado que hay que reproducir («mediana 38,54 ms (IC 95 %: 38,11 – 39,02)», «−4,5 %», «p < 0,001»).

## Diseño

### Módulos

```
paquetes/estadistica/src/
├── orden.ts           ← ordenados()
├── descriptiva.ts     ← describir(), percentil(), medianaOrdenada(), icMediana(), atipicos()
├── normal.ts          ← erfc() y fda() de la normal estándar
├── mannWhitney.ts     ← mannWhitney(x, y) → { u, p }
├── comparar.ts        ← comparar(a, b) → cambio, p, significativo y sentido
├── avisos.ts          ← avisosDeMetodo(valores): pocas, ruido, atípicos
├── hodgesLehmann.ts   ← solo el tipo (IN-047)
└── index.ts
paquetes/estadistica/referencias/
├── generar.py         ← genera los casos con NumPy y SciPy
└── casos.json         ← 30 casos de referencia
```

### Métodos (documentados en el código)

| Medida | Método |
|---|---|
| Mediana, media, mínimo, máximo | Habituales |
| Desviación típica | Muestral (n − 1); CV = desviación / media |
| Percentiles 5, 25, 75 y 95 | Interpolación lineal entre estadísticos de orden (método 7 de Hyndman y Fan, el de `numpy.percentile` y R) |
| IC 95 % de la mediana | Estadísticos de orden con la aproximación normal de la binomial (n, ½): rangos j = ⌊n/2 − 1,96·√n/2⌋ y k = ⌈1 + n/2 + 1,96·√n/2⌉, acotados a [1, n]. Es el de las pantallas y da 38,11 – 39,02 en el ejemplo |
| Mann-Whitney U | Aproximación normal con corrección por empates y de continuidad, p bilateral; igual que `scipy.stats.mannwhitneyu(..., method='asymptotic', use_continuity=True)` |
| Normal estándar | `erfc` de Chebyshev (Numerical Recipes §6.2), error relativo < 1,2·10⁻⁷ |
| Atípicos | Regla de Tukey: fuera de [Q1 − 1,5·IQR, Q3 + 1,5·IQR] |
| Avisos | n < 10 (benchstat), CV > 5 %, atípicos |
| Veredicto | Cambio % de medianas (B frente a A) y significación con p < 0,05; sentido «baja», «sube» o «igual» |

### Referencias

`generar.py` (con NumPy 2.2 y SciPy 1.15, en un entorno aparte) produce `casos.json`: el ejemplo del plan, series normales de tamaños entre 3 y 60, series con muchos empates, series lognormales con colas, series idénticas, sin solape, con ceros y negativos, de valores grandes y pequeños, y con tamaños muy distintos. **benchstat** no se usa como referencia: no hay Go en el entorno, y su prueba usa la distribución exacta de U para tamaños pequeños, distinta de la aproximación normal elegida (la de las pantallas y la de SciPy).

## Tareas

- [ ] Mediana, media, desviación, CV, mínimo, máximo, percentiles 5 y 95 (método documentado).
- [ ] IC 95 % de la mediana por estadísticos de orden.
- [ ] Mann-Whitney U con corrección por empates y de continuidad; p bilateral.
- [ ] Atípicos (IQR × 1,5) y avisos de método.
- [ ] Veredicto: cambio de medianas y significación (0,05).
- [ ] Hodges-Lehmann como firma, sin implementar.

## Pruebas previstas

- Los 30 casos de `casos.json`: tolerancia 10⁻⁹ (relativa, con mínimo absoluto de 10⁻⁹) en estadísticos y 10⁻⁶ en p.
- El ejemplo del plan: medianas 38,535 y 36,795, cambio −4,5 % y p < 0,001; IC 38,11 – 39,02.
- Propiedades (fast-check): mediana, percentiles e IC dentro de [mínimo, máximo] y en orden; Mann-Whitney con p en [0, 1], U₁ + U₂ = n₁·n₂ y simétrica.
- Avisos de pocas repeticiones, ruido y atípicos.

## Criterios de aceptación

- El ejemplo del plan da mediana 38,535 y 36,795, cambio −4,5 % y p < 0,001.
- Las referencias pasan con las tolerancias de la ficha.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Sin benchstat como referencia | SciPy como referencia; se documenta la diferencia de método |
| IC de la mediana con n pequeño | El método da los extremos de la serie; los avisos de método ya dicen que son pocas |
| Precisión de la normal | `erfc` de Chebyshev; la tolerancia de p (10⁻⁶) la cubre de sobra |

## Autorrevisión

Cubre la ficha. TS puro, sin dependencias, utilizable desde la CLI.
