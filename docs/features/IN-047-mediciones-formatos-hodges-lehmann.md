# IN-047 · Mediciones: más formatos y Hodges-Lehmann

## Objetivo y catálogo

Que las mediciones de las herramientas de benchmark más usadas se lean tal cual salen (pytest-benchmark, JMH, criterion y una tabla CSV de tiempos) y que, al comparar dos series, Rimor diga también **cuánto** cambia con el estimador de Hodges-Lehmann y su intervalo, verificado contra referencias. Catálogo: **LEC-06 (v0.2)** (plan §8.3: «JSON de pytest-benchmark, JSON de JMH, `estimates.json` de criterion, columnas CSV» y «en v0.2, el estimador de Hodges-Lehmann de la diferencia con su intervalo»). Depende de IN-022.

## Estado de partida

- `lectores/mediciones/series.ts` lee una medida por línea, `go test -bench` y el JSON de hyperfine; una tabla (CSV) devuelve cero series (es de Datos). Todo se calcula desde los valores sueltos (`describir`, avisos, gráfico, comparación).
- `@rimor/estadistica` tiene la firma de `HodgesLehmann` sin implementar (IN-011) y referencias de NumPy y SciPy generadas con `referencias/generar.py`.
- La comparación de mediciones (CMP-01) da el cambio de las medianas, Mann-Whitney y el veredicto; su resultado guardado lleva `cambio`, `p`, las medianas y `n`.

## Diseño

### Formatos (`series.ts`)

- **pytest-benchmark** (`--benchmark-json`): una serie por benchmark con `stats.data` (segundos), etiquetada con su `name`. Sin `data` (se guarda solo con `--benchmark-save-data`), no hay mediciones sueltas: se lee como resumen (ver abajo) con su `median` y sin intervalo.
- **JMH** (`-rf json`): una serie por benchmark (con sus `params`) con `primaryMetric.rawData` aplanado, en la unidad de `scoreUnit` (`ns/op`, `us/op`, `ms/op`, `s/op`). Los modos de rendimiento (`thrpt`, `ops/s`) no son tiempos: no se leen (mayor sería mejor y la comparación diría lo contrario).
- **criterion**: el `sample.json` de cada benchmark (`iters` y `times` en ns) da la serie entera (`times[i] / iters[i]`); el `estimates.json` da **un resumen**: la mediana y su intervalo, la media y la desviación que calculó criterion, sin mediciones sueltas.
- **Columnas CSV**: una tabla con cabecera en la que todas las columnas son números y dicen su unidad (`reqwest (ms)`, `ureq_ms`, `[µs]`, o los valores con su unidad): una serie por columna. Sin unidad, es una tabla de datos (Datos).
- Un **resumen** (sin valores sueltos) es una serie con `resumen: { mediana, icBajo?, icAlto?, media?, desviacion? }`: la vista enseña la mediana y el intervalo de quien la calculó, sin gráfico ni avisos de método, y la comparación dice que necesita las mediciones (`comparacion.sinValores`).

### Hodges-Lehmann (`@rimor/estadistica`)

- `hodgesLehmann(a, b)`: la mediana de las m·n diferencias `b − a` y su intervalo del 95 % por el método de Moses (Hollander y Wolfe): las diferencias ordenadas `D₍ₖ₎` y `D₍ₘₙ₊₁₋ₖ₎`, con `k` el valor crítico de U. Exacto (distribución de U por recuento) si `m·n ≤ 400` y no hay empates; si no, con la aproximación normal y la corrección por empates de Mann-Whitney. Con muy pocas mediciones para un intervalo del 95 %, los extremos son `NaN`.
- Referencias: `generar.py` añade a cada caso `hl` (estimación e intervalo) calculado en Python de otra forma (todas las diferencias con NumPy y la distribución exacta de U por recurrencia con enteros), y `referencias.test.ts` los comprueba.
- `comparar` devuelve también `hl`.

### En la comparación

- La vista de una comparación de mediciones añade «Diferencia (Hodges-Lehmann)» con su intervalo; el resultado guardado, `hl`, `hl_bajo` y `hl_alto` (opcionales: los de antes siguen leyéndose); sus cifras citables, `hl`.

## Tareas

- [x] JSON de pytest-benchmark.
- [x] JSON de JMH.
- [x] `estimates.json` de criterion (y su `sample.json`).
- [x] Columnas CSV.
- [x] Estimador de Hodges-Lehmann con intervalo, verificado contra referencias.

## Pruebas previstas

- Cada formato con salidas reales (varias series, unidades, parámetros de JMH, pytest sin `data`, criterion resumen y muestras); no son mediciones: un CSV sin unidades, JMH en `thrpt`.
- Detección: los ejemplos nuevos en `fixtures/deteccion/mediciones/` y que Datos y JSON no pierdan los suyos.
- Hodges-Lehmann contra las referencias (exacto y normal, con empates), casos límite (series de 1, iguales, con `NaN`) y propiedades (la estimación cambia de signo al intercambiar las series y se desplaza con ellas).
- Vista y respuesta de un resumen; comparación con Hodges-Lehmann en la vista y en el resultado guardado.

## Criterios de aceptación

- `pnpm verificar` en verde; los cuatro formatos se leen como mediciones; la comparación enseña Hodges-Lehmann con su intervalo, igual que las referencias.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `estimates.json` no trae mediciones sueltas | Se lee como resumen (la mediana y el intervalo de criterion); para el gráfico y la comparación, el `sample.json`. |
| Un CSV de números es también de Datos | Solo es de Mediciones si dice su unidad (en la cabecera o en los valores). |
| JMH en rendimiento (`ops/s`) | No se lee: no es un tiempo. |
| Hodges-Lehmann sin SciPy que lo calcule | Las referencias se calculan en Python por otro camino (todas las diferencias y la distribución exacta de U con enteros), no copiando el algoritmo de TypeScript. |

## Autorrevisión

Cubre las cinco tareas. Reutiliza las series, la descriptiva, la comparación y su resultado guardado; lo nuevo del modelo (un resumen sin valores) se trata en la vista, la respuesta y la comparación, sin inventar valores.

## Implementación

- `@rimor/estadistica`: `hodgesLehmann` y `distribucionU` (`hodgesLehmann.ts`); `comparar` devuelve `hl`. Referencias: `generar.py` añade `hl` a cada caso (todas las diferencias con NumPy y la distribución exacta de U contando con enteros, o la normal de SciPy), regenerado con las mismas versiones que antes (NumPy 2.2.6, SciPy 1.15.3) sin que cambie ningún valor anterior; los 33 casos coinciden (15 exactos y 18 con la normal).
- `lectores/mediciones/formatos.ts`: hyperfine (movido de `series.ts`), pytest-benchmark, JMH, criterion (`sample.json` y `estimates.json`) y columnas CSV; `series.ts` los usa y pasa los resúmenes a su unidad.
- Lector: las series de resumen (`Serie.resumen`) tienen su descriptiva sin inventar nada (`n` = 0), su respuesta («Mediana de 38,48 µs según criterion (IC 95 %: …), sin las mediciones sueltas.»), su resumen del frontmatter sin `n` y su vista (mediana, intervalo y una nota de por qué no hay gráfico).
- Comparación: «Diferencia según Hodges-Lehmann» en la vista; `hl`, `hl_bajo` y `hl_alto` en el resultado guardado y la cifra citable `hl`. Un resumen no se compara (no tiene mediciones).
- Pruebas: `referencias.test.ts` (los 33 casos, la distribución de U, el ejemplo del plan, casos límite y propiedades), `mediciones.test.ts` (formatos, resúmenes, CSV sin unidad, JMH en `thrpt`), `comparaciones.test.ts`, `rutas/comparacion/VistaMediciones.test.tsx`; ejemplos en `fixtures/mediciones/` (sus valores esperados, calculados en Python por fuera) y en el corpus de detección.

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| La cifra `hl` sigue la regla de decimales del resto (unas cuatro cifras significativas: «−1,820 ms») | Así se cita igual que las medianas de la misma comparación. |
| La distribución exacta de U, en coma flotante | Con m·n ≤ 400 los recuentos caben de sobra y la referencia con enteros exactos da lo mismo. |
| `testTimeout` de Vitest a 15 s y la prueba de linealidad de `curl -u` en el proyecto `rendimiento` | El entorno tenía pausas de varios segundos que agotaban pruebas al azar (también en el commit anterior); ninguna aserción cambia. |
| `elementoDeTexto` en `pruebas/falsos.ts` (un elemento con el resumen de verdad) para la prueba de exportar | Con el resumen de mentira, la puesta al día en segundo plano contaba un cambio a destiempo (la misma carrera que en Importar). |
| Las columnas CSV con unidad puntúan 0,9, como una tabla de Datos con cabecera | Mediciones va antes en el orden (puesto 6), así que gana el empate; una tabla sin unidades sigue siendo de Datos. |
