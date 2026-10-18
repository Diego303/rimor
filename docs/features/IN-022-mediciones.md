# IN-022 · Lector Mediciones

## Objetivo y catálogo

Que una serie de tiempos diga cuánto tarda de verdad y con qué confianza, sin hoja de cálculo. Catálogo: **LEC-06** (plan §8.3). Depende de IN-011 (`@rimor/estadistica`: `describir`, `icMediana`, `avisosDeMetodo`, `atipicos`) e IN-017.

## Estado de partida

- `describir(valores)` da n, mediana, media, desviación, CV, mínimo, máximo, p5, p95, cuartiles e IC 95 % de la mediana; `avisosDeMetodo` da «pocas» (< 10), «ruido» (CV > 5 %) y «atípicos». Contrastado con NumPy y SciPy.
- La pantalla de referencia no tiene una serie suelta, pero sí la comparación (`SC.medic`): gráfico de puntos (720 de ancho, eje con marcas «bonitas», banda del IC al 14 % de opacidad, puntos de 3,4 de radio con un pequeño temblor vertical, línea de la mediana de 2,5), leyenda, tabla «Mediana · IC 95 % · Variación» y «Avisos de método (N)» plegados con `.gaps .gap .dot`. La serie suelta usa esas mismas piezas con una fila.

## Diseño

### `src/lectores/mediciones/series.ts` (puro)

`leerSeries(texto)` → `Serie[]` con `{ etiqueta, valores (en ms), unidadOriginal }`:

- **Una medida por línea**, con o sin unidad (`38.41 ms`, `38,41ms`, `850 µs`, `850 us`, `120ns`, `1.2 s`, `38.41`): por línea, el número con unidad (o la línea entera si es solo un número). Sin unidad, ms. Las líneas `#` son comentarios: el primero da la **etiqueta** (hasta un `·`).
- **`go test -bench`**: `BenchmarkNombre-8   1000000   1234 ns/op …`; una serie por nombre (sin el sufijo `-8`), con sus repeticiones (`-count=N`).
- **JSON de hyperfine**: `{ "results": [{ "command", "times": [s…] }] }`; una serie por comando.
- **Unidades a ms**, o a **s** si todos los valores pasan de 10 s (`unidad` de la serie: `ms` o `s`).

### El lector (`src/lectores/mediciones/`)

- `detectar`: 0,9 con JSON de hyperfine o con líneas de `go test -bench`; 0,88 con al menos 3 medidas y que sean al menos el 70 % de las líneas que no son comentarios; si no, 0. Al detectar, una línea con una hora, una fecha o un nivel de log, o una frase de más de 6 palabras con una duración, no cuenta como medida (lección de IN-021: un log no debe acabar en otro lector).
- `leer`: título desde la etiqueta (o «Mediciones de {comando}» / el nombre del benchmark), resumen provisional `{ n }`.
- `derivar` → `{ series: [{ etiqueta, unidad, valores, d: Descriptiva, avisos }] }`.
- `resumen`: de la primera serie, `{ n, mediana, unidad, series }`; `resumenLegible`: «20 mediciones · mediana 38,54 ms».
- **Respuesta**: «20 mediciones · mediana 38,54 ms (IC 95 %: 38,11 – 39,02).» y, si n < 10, «Son pocas: lo recomendable son al menos 10.» Con varias series, la primera y «… y 2 series más» en la misma frase.
- **Cifras**: `mediana`, `ic_bajo`, `ic_alto`, `n`, `cv` (de la primera serie).
- `textoIndexable`: las etiquetas.

### Vista (`Vista.tsx`) y `GraficoPuntos`

- `GraficoPuntos` (en `src/lectores/mediciones/`, reutilizable por la comparación de IN-028): una fila por serie, eje con marcas «bonitas» (1, 2, 5 × 10ⁿ), banda del IC, puntos con un temblor determinista y línea de la mediana; colores `--key` para la serie (y `--muted` para la de referencia en una comparación); con la unidad arriba a la derecha.
- Una tarjeta, como la de la comparación: el veredicto (la mediana como cifra grande, «Mediana de 20 mediciones», y «IC 95 %: 38,11 – 39,02 · variación 1,6 %»; tono `warn` si hay pocas o ruido, `ok` si no), el gráfico, la leyenda («Línea: mediana · banda: intervalo de confianza del 95 %») y la tabla de la referencia: serie, n, Mediana, IC 95 % y Variación.
- «Avisos de método (N)» plegados (con el número visible; sin avisos, no sale) y «Detalles» con el formato, media, desviación, mínimo, máximo, p5 y p95 de cada serie y las cifras citables.
- Números con unas cuatro cifras significativas según la mediana («38,54», «410,2», «0,001234»): una serie de `go test -bench` en ns sigue legible en ms.

### Corpus

- `fixtures/mediciones/`: ejemplos de los tres formatos con lo esperado (n, mediana, IC, unidad).
- `fixtures/deteccion/mediciones/`: 25 para la matriz (líneas con varias unidades y etiquetas, `go test -bench` y JSON de hyperfine soltado como archivo).

## Tareas

- [x] Formatos v0.1: una medida por línea con o sin unidad, `go test -bench` y JSON de hyperfine. Etiqueta desde un comentario `#`.
- [x] Normaliza unidades a ms (o a s si todo pasa de 10 s).
- [x] Deriva las estadísticas de IN-011 y los avisos de método.
- [x] Vista: gráfico de puntos con mediana e intervalo, tabla de estadísticos y avisos plegados con recuento.
- [x] Cifras: `mediana`, `ic_bajo`, `ic_alto`, `n`, `cv`.
- [x] Respuesta: «20 mediciones · mediana 38,54 ms (IC 95 %: 38,11 – 39,02).» y, si n < 10, «Son pocas: lo recomendable son al menos 10.»

## Pruebas previstas

- Lectura de los tres formatos (unidades mezcladas, comas decimales, etiquetas, varios benchmarks, varios comandos) y paso a s.
- Estadísticas iguales a las de `@rimor/estadistica` (y los avisos); el ejemplo de la ficha.
- Respuesta en es y en, con n < 10 y con varias series; reglas de estilo.
- Vista: gráfico con su banda y su mediana, tabla y avisos plegados con su número.
- Matriz con la carpeta `mediciones`; un log con milisegundos o una idea con un número no pasan por mediciones.

## Criterios de aceptación

- Las pruebas de arriba; los números coinciden con IN-011 (ya contrastado con SciPy).
- `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Una línea con varios números (`run 3: 38.4 ms`) | Cuenta el número con unidad; si no tiene unidad y hay más de un número, la línea no es una medida |
| Listas de números sueltos (años, IDs, versiones) | Al detectar, sin unidad ni comentario solo cuentan si tienen decimales y no avanzan de paso fijo (añadido en la verificación) |
| Varias series en un pegado | Se guardan todas; la respuesta y las cifras hablan de la primera; comparar es IN-028 |
| Un log con duraciones (`tardó 410ms`) | Log puntúa por sus marcas y niveles; mediciones exige que casi todas las líneas sean solo medidas |

## Autorrevisión

Cubre las seis tareas. Los formatos de v0.2 (pytest-benchmark, JMH, criterion, CSV) son de IN-047; la comparación y Mann-Whitney en pantalla, de IN-028, que reutilizará `GraficoPuntos`.

## Cambios durante la implementación

- Todas las series de un pegado van en la misma unidad (s solo si todos sus valores pasan de 10 s), para dibujarlas y compararlas juntas.
- Con una sola medición, la respuesta no da intervalo («1 medición: 38,40 ms.») y la tabla pone «—» en IC y variación; sin medidas, «No he encontrado mediciones que leer.».
- `medidaDeLinea` tiene un modo estricto (al detectar) que descarta líneas con hora, fecha o nivel de log y frases de más de 6 palabras; al leer (también con `/med`), basta un número con unidad.
- `Tabla` admite `className` (la de mediciones lleva `min-width: 420px`, como la de la referencia).
- Varias series: cada aviso lleva delante el nombre de su serie; las series sin nombre se llaman «Serie N».


## Verificación

**`pnpm verificar`** (2026-10-18 22:40): tipos 0 errores; Biome, colores y textos, OK; Vitest 52 archivos y 798 pruebas, OK; construcción OK; carga inicial 197,8 KB. **`pnpm deteccion`**: 100 % de 175 ejemplos (archivo, enlace, error, idea, log, mediciones y texto).

| Criterio | Evidencia |
|---|---|
| Formatos v0.1 | `fixtures/mediciones/` (líneas con y sin unidad, unidades mezcladas, coma decimal, `go test -bench` y hyperfine); miles, `.5`, `min`, grupos con etiqueta, `-cpu` y varios paquetes de Go |
| Unidades a ms (o s) | Pruebas de paso a s (todas las series del pegado en la misma unidad); por debajo de 1 ms la vista escribe µs o ns |
| Estadísticas y avisos de IN-011 | `describir` y `avisosDeMetodo` iguales a los del paquete; pocas, ruido y atípicos |
| Vista | Prueba de la vista: veredicto, gráfico (banda, mediana, puntos, unidad), tabla de la referencia, avisos plegados con su número, varias series |
| Cifras | `mediana`, `ic_bajo`, `ic_alto`, `n`, `cv` (texto en la escala de la vista; valor en ms o s) |
| Respuesta | El ejemplo de la ficha exacto; «Son pocas…» con n < 10; varias series; una sola medición; en es y en; reglas de estilo |
| No roba otros tipos | CSV, accesos HTTP, `go test`, vitest, años, IDs, versiones, configuración, notas, listas, un log o un documento con una línea de benchmark |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Un CSV se detectaba y se leía como mediciones** (la coma de columna como decimal): si casi todas las líneas tienen separadores y hay cabecera o varias columnas, no es una serie.
2. **`Math.min(...)` con cientos de miles de valores desbordaba la pila**: extremos con un bucle, y el gráfico dibuja como mucho 2.000 puntos por fila (a intervalos regulares; banda y mediana son de todos).
3. **Bucle sin fin con valores enormes**: sin gráfico si el rango no es finito, eje con tope de 50 marcas y parada si `k` deja de avanzar; los valores que se salen de lo representable no son medidas.
4. **Go por debajo de 1 µs salía «0,000000 ms»**: la vista, la respuesta y las cifras escriben µs o ns por debajo de 1 ms (el valor citable sigue en ms).
5. **Go mezclaba configuraciones**: el sufijo `-N` solo se quita si todos los benchmarks lo llevan igual; el mismo benchmark en dos paquetes va por separado, con el paquete entre paréntesis.
6. **Una línea de benchmark suelta decidía todo el texto**: hacen falta un 70 % de líneas de benchmark (sin contar `goos`, `pkg`, `PASS`, `ok`…).
7. **Falsos positivos**: al detectar, una medida solo puede llevar una etiqueta corta (sin barras, paréntesis ni marcas de pruebas, como mucho otro número); una lista de cosas distintas con su duración no es una serie; números sueltos sin unidad ni comentario, solo con decimales y sin paso fijo.
8. **Dos grupos con etiqueta se fundían**: cada comentario tras unas medidas empieza otra serie.
9. **Miles**: `1,234.5` y `1.234,5`; con un solo separador, decimal.
10. **Lecturas parciales**: `2 min 3 s` y `10-12 ms` ya no son medidas; `.5 ms` sí; los tiempos negativos no.
11. **Título de hyperfine**: «Mediciones de {comando}».
12. **Tabla**: las columnas de la referencia (serie, Mediana, IC 95 %, Variación); `n` va en el veredicto y en las cifras.
13. **Varias series con el mismo color**: la leyenda solo pinta la muestra con una serie (con varias, cada fila del gráfico lleva su nombre).

Sin cambiar: con n ≤ 5 el «IC 95 %» de `icMediana` (IN-011) es el mínimo y el máximo, con una cobertura algo menor; el aviso «pocas» ya lo acompaña. Con `GOMAXPROCS=1` y un solo benchmark cuyo nombre acaba en `-N` (`BenchmarkSHA-256`), el sufijo se toma por GOMAXPROCS.
