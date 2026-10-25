# IN-044 · Datos tabulares con DuckDB

## Objetivo y catálogo

Que un CSV, un TSV o un Parquet (soltado, o un CSV pegado) se entienda de un vistazo: una fila por columna con su tipo, sus nulos, sus valores y su forma (histograma o los más repetidos), la respuesta que dice lo raro («2400 filas y 6 columnas. Hay 17 latencias de 30 s y 20 nulos en bytes.») y, para quien quiera más, una consulta SQL sobre el archivo, todo en el navegador con DuckDB-WASM. Catálogo: **LEC-11** (plan §8.7) y la comparación antes y después (§8.7). Depende de IN-012 (lectores) y F0-5 (límites de DuckDB).

## Estado de partida

- El tipo `datos` (`DAT-`) existe; `ORDEN_DETECCION` reserva el puesto 8 («separador consistente en todas las filas»). No hay lector: hoy un CSV pegado es Texto o Código, y uno soltado va al lector genérico de archivo.
- F0-5: `@duckdb/duckdb-wasm` 1.33.1-dev57.0 (etiqueta `latest`), variante `eh` con `mvp` de respaldo, en un hilo (GitHub Pages no da COOP/COEP); `duckdb-eh.wasm` pesa 34 MB (≈ 8 MB con gzip); instanciar, 2–4 s una vez por sesión; cargar y perfilar 50 MB, 4,3 s. **Hasta 50 MB, perfil completo; por encima, sobre los primeros 50 MB** cortados en un fin de línea, con aviso. `width_bucket` no existe: el histograma, con `least(floor(...), n − 1)`.
- La referencia dibuja la pantalla (`SC.tabla`): la tarjeta «Columnas» (nombre y tipo; mini-histograma, los valores más repetidos o mínimo → máximo; nulos y atípicos en ámbar), una tarjeta con el resultado de una consulta y la consulta plegada («DuckDB-WASM, en el navegador · 4 ms»), y la vista previa plegada.
- La CSP no deja compilar WebAssembly (`script-src` sin `'wasm-unsafe-eval'`).
- La `Senal` no tiene `leyendo-datos` (SVG 13) y su presupuesto de 4 KB está casi lleno (3.999 bytes).
- Las comparaciones (CMP-01) son de logs y de mediciones, con sus derivados.
- IN-058 (gráficos con Observable Plot) depende de esta: el gráfico de datos grande llega allí.

## Diseño

### DuckDB (`src/lectores/datos/motor.ts`)

- `obtenerMotor()`: carga diferida de `@duckdb/duckdb-wasm` (un trozo aparte, con sus `.wasm` y su Worker como recursos del sitio) y un `AsyncDuckDB` en su propio Worker, uno por contexto; `selectBundle` entre `eh` y `mvp`. Interfaz pequeña: `registrar(nombre, bytes)`, `consultar(sql) → { columnas, filas }`, `quitar(nombre)`.
- En las pruebas, el mismo `AsyncDuckDB` en Node (como en F0-5), detrás de la misma interfaz.
- La CSP gana `'wasm-unsafe-eval'` en `script-src` (solo compilar WebAssembly; nada de `eval`).

### El lector `datos`

- **Detecta** un CSV o TSV pegado (o soltado como texto): al menos 3 filas y 2 columnas con el mismo número de separadores (`,` `;` tabulador `|`, fuera de comillas) en todas; no una tabla de Markdown (`| a |` con su fila `|---|`). Un `.parquet` (firma `PAR1`) va a este lector, no al de archivo.
- **Lee:** título del nombre del archivo o «Datos de 6 columnas»; un CSV pequeño en el `.md`, uno grande o un Parquet como adjunto (como siempre). Resumen `{ filas, columnas }` (las filas, contadas sin DuckDB al leer un CSV; de un Parquet, al derivar).
- **Deriva** (en el Worker de derivados, con DuckDB en un Worker anidado): `read_csv_auto` o `read_parquet`, y el perfil de cada columna: tipo, nulos, únicos (aproximados), mínimo, máximo, media; en las numéricas, un histograma de 20 cubetas, los atípicos (fuera de Q1 − 1,5·IQR y Q3 + 1,5·IQR) y cuántas filas están en el máximo; en las de texto, los 3 valores más repetidos. Y la vista previa (5 filas). Por encima de 50 MB, sobre los primeros 50 MB, con `muestra: { filas, aproximadas }`.
- **Respuesta:** «2400 filas y 6 columnas.» y, si hay algo raro, una segunda frase con lo más llamativo: las filas en el máximo de una columna cuando ese máximo es atípico («17 latencias de 30 s»: el valor con su unidad si el nombre la trae, `_ms` o `_s`) y la columna con más nulos («20 nulos en bytes»).
- **Cifras citables:** `filas`, `columnas` y, por columna, sus nulos.

### La vista (como `SC.tabla`)

- **Columnas:** una fila por columna (nombre en mono y tipo; mini-histograma, los más repetidos o mínimo → máximo; nulos y atípicos en ámbar). Por encima de 50 MB, el aviso «Perfil sobre una muestra de N filas de M aproximadas».
- **Gráfico rápido:** el histograma grande de una columna numérica a elegir (el de Observable Plot llega con IN-058).
- **Consulta SQL** (plegada): un editor CodeMirror con el modo SQL (cargado al abrirlo), una consulta de ejemplo sobre la tabla `datos`, «Ejecutar» (`Ctrl+Intro`), el resultado en una tabla (hasta 200 filas) y «DuckDB-WASM, en el navegador · 4 ms». La primera vez, `<Senal estado="cargando">` con «DuckDB, solo la primera vez»; mientras consulta, `<Senal estado="leyendo-datos">`. Un error de SQL se enseña tal cual, sin romper nada.
- **Vista previa** (plegada): las 5 primeras filas; `null` en tenue.

### Comparación antes y después

«Comparar con…» desde unos datos, con otros datos (CMP-01): filas antes y después, columnas añadidas y quitadas, columnas que cambian de tipo y cambios de distribución en las comunes (nulos, media, mínimo y máximo, únicos), con lo más llamativo arriba. Sale de los dos perfiles (sus derivados), sin volver a leer los archivos.

### `leyendo-datos` en la Señal

El SVG 13 (onda punteada que avanza, 0,8 s, bucle). Se hace sitio en los 4 KB compactando el CSS.

## Tareas

- [x] Carga diferida de DuckDB-WASM en un Worker, con `<Senal estado="cargando">` y «DuckDB, solo la primera vez».
- [x] El estado `leyendo-datos` en `senal.css`, usado al perfilar o consultar.
- [x] CSV, TSV y Parquet como adjuntos.
- [x] Perfil por columna: tipo, nulos, únicos, mínimo, máximo, media, histograma y atípicos.
- [x] Vista previa de 5 filas; consulta SQL plegada con un editor CodeMirror y el modo SQL.
- [x] Gráfico rápido (con IN-058).
- [x] Comparación de dos conjuntos: filas, columnas y cambios de distribución.
- [x] Límite: por encima de lo medido en F0-5, aviso y muestra.
- [x] Respuesta «2400 filas y 6 columnas. Hay 17 latencias de 30 s y 20 nulos en bytes.».

## Pruebas previstas

- Detección: CSV y TSV de varias formas (comillas con separadores dentro, `;` europeo, cabeceras), Parquet por su firma; no son datos un log, una tabla de Markdown, prosa con comas o una lista. Corpus `fixtures/deteccion/datos/` (25) y la matriz ≥ 90 %.
- Perfil con DuckDB de verdad (en Node): tipos, nulos, únicos, mínimo, máximo, media, histograma, atípicos, filas en el máximo, los más repetidos, vista previa; un Parquet; la muestra por encima del límite.
- Respuesta con lo raro y sin nada raro, es y en, reglas de estilo; cifras.
- Vista: columnas como la referencia, aviso de muestra, gráfico rápido, consulta SQL (resultado, error, señales), vista previa.
- Comparación: filas, columnas añadidas y quitadas, tipo cambiado, distribución.
- CSP con `'wasm-unsafe-eval'`; el trozo de DuckDB fuera de la carga inicial; la Señal con su SVG y el presupuesto.

## Criterios de aceptación

- `pnpm verificar` en verde; un CSV pegado o soltado y un Parquet soltado se guardan con el lector `datos`, con su perfil, su respuesta y su consulta SQL; nada de DuckDB en la carga inicial.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| 34 MB de WebAssembly | Solo se descarga al ver o derivar unos datos; la PWA (IN-050) lo cachea. |
| `'wasm-unsafe-eval'` en la CSP | Solo permite compilar WebAssembly (no `eval` de JavaScript); lo necesitarán también Pandoc y Typst. |
| DuckDB en el Worker de derivados | Un Worker anidado (los navegadores actuales los admiten); si no arranca, el derivado falla con su error y la vista enseña lo que sabe. |
| Probar DuckDB sin navegador | El mismo paquete funciona en Node (F0-5); las pruebas usan el motor de verdad. |
| Falsos positivos de CSV | Mismo número de separadores en todas las filas, al menos 3 y 2 columnas, y no Markdown. |
| El gráfico de datos | Un histograma propio en SVG; el de Observable Plot llega con IN-058. |

## Autorrevisión

Cubre las nueve tareas. Reutiliza el contrato de lectores, los adjuntos, la cola de derivados, las comparaciones (CMP-01), `stats`, `tbl-wrap`, los plegados y la `Senal`. Lo pesado (DuckDB, CodeMirror) va en trozos diferidos.

## Implementación

- Dependencias (exactas, publicadas hace más de dos semanas): `@duckdb/duckdb-wasm` 1.33.1-dev57.0 y CodeMirror (`@codemirror/state` 6.7.6, `view` 6.43.14, `lang-sql` 6.10.0, `commands` 6.11.1, `language` 6.13.1); `@codemirror/autocomplete` (6.20.3) y `qs` (6.16.0) fijadas en `pnpm-workspace.yaml`.
- `src/lectores/datos/`: `motor.ts` (`MotorSql`, `obtenerMotor`, `usarMotor`, Arrow a valores), `motorNavegador.ts` (DuckDB-WASM `eh`/`mvp` en su Worker, con los `.wasm` y el Worker como recursos `?url`), `csv.ts` (forma de un CSV o un TSV), `perfil.ts` (el perfil con SQL), `lector.ts` (`lectorDatos`, puesto 8, con `necesitaBytes`), `textos.ts`, `Vista.tsx` (columnas, aviso de muestra, «Comparar con otros datos», gráfico rápido, vista previa), `ConsultaSql.tsx`, `EditorSql.tsx` (CodeMirror, cargado al abrir la consulta) y `Tarjeta.tsx`.
- Los bytes del adjunto llegan al derivado de los lectores que los piden (`Lector.necesitaBytes`, `OpcionesDerivar.bytes`, `cargarBytes` en la cola y en el Worker).
- El detector manda los Parquet (firma `PAR1`, extensión o MIME) al tipo `datos`.
- Comparaciones: la clase `datos` (`comparaciones/datos.ts`, su resultado con sus cifras y `rutas/comparacion/VistaDatos.tsx`).
- `Senal`: el estado `leyendo-datos` (SVG 13); cabe en los 4 KB.
- CSP: `'wasm-unsafe-eval'` en `script-src` (y las comprobaciones lo admiten a él solo, no `'unsafe-inline'` ni `'unsafe-eval'`).
- Pruebas con DuckDB de verdad en Node (`src/pruebas/motor-datos.ts`, cargado en la preparación de las pruebas): `datos/datos.test.ts` (forma, detección, perfil de un CSV y de un Parquet, muestra, respuesta), `datos/Vista.test.tsx` (columnas, aviso, gráfico, consulta y su error, captura de un CSV), `comparaciones/datos.test.ts`, la señal y la CSP. Corpus `fixtures/deteccion/datos/` (25 CSV y TSV, y un Parquet de verdad generado con DuckDB).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El Parquet del corpus pasa de `archivo` a `datos`, y es un Parquet de verdad (el anterior solo tenía la firma) | Ahora tiene lector; y el perfil necesita un archivo que se pueda leer. |
| Las consultas del perfil agrupan por posición (`GROUP BY 1`) | Un alias como `b` chocaba con una columna que se llamara así. |
| Para «lo raro» de la respuesta van antes las columnas con unidad en el nombre (`latencia_ms`) | Un código como `status` (504) también tiene «máximos atípicos», y la frase «4 latencias de 30 s» dice más. |
| El gráfico rápido es un histograma propio en SVG | El de Observable Plot llega con IN-058, que depende de esta. |
| Los nombres de las columnas van en mono en la respuesta | Son del usuario (una cabecera como `#!/usr/bin/env bash` no debe contar para las reglas de estilo). |
| Los recursos de los Workers se llaman como los del hilo principal (`astro.config.mjs`) | El `.wasm` de DuckDB lo usan los dos: así es un solo archivo y se descarga una vez. |

## Verificación

**`pnpm verificar`**: en verde, 113 archivos y 1461 pruebas, más la de rendimiento en su proyecto aparte (1462); carga inicial 259,8 KB de 300.

**Criterios de aceptación:** un CSV pegado o soltado y un Parquet soltado se guardan con el lector `datos`, con su perfil, su respuesta y su consulta SQL (`datos.test.ts`, `Vista.test.tsx`; corpus de detección al 100 %); DuckDB, el perfil y CodeMirror quedan fuera de la carga inicial (`tamano`: 259,8 KB, igual que antes de la revisión).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| DuckDB diferido en su Worker, «DuckDB, solo la primera vez» | `motorNavegador.ts` (por `import()`), `Vista.test.tsx` (consulta), `tamano` |
| `leyendo-datos` al perfilar o consultar | `Senal.test.tsx`, `Lectores.test.tsx` (señal del lector al derivar), `ConsultaSql.tsx` |
| CSV, TSV y Parquet como adjuntos | `datos.test.ts` (detección, Parquet por firma, Windows-1252 y UTF-16), `reprocesar.test.ts` (Parquet pendiente que se relee) |
| Perfil por columna | `datos.test.ts` (tipos, nulos, únicos, extremos, media, histograma, atípicos, más repetidos, infinitos; 7 consultas en total) |
| Vista previa y consulta SQL con CodeMirror | `Vista.test.tsx` (resultado recortado, sesión propia, dos elementos a la vez, archivo soltado al salir, errores con palabras, ⌘ en Mac) |
| Gráfico rápido | `Vista.test.tsx` |
| Comparación de dos conjuntos | `comparaciones/datos.test.ts` (filas, columnas, tipo, distribución sobre las filas perfiladas, resultado guardado validado), `Vista.test.tsx` (veredicto con tipo cambiado) |
| Límite con aviso y muestra | `datos.test.ts` (CSV por sus primeros bytes; Parquet por sus primeras filas con el total exacto; respuesta sin mezclar escalas) |
| Respuesta | `datos.test.ts` (con lo raro, sin nada raro, muestra aproximada y exacta, es y en, reglas de estilo) |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | En el navegador, `registerFileBuffer` se lleva el búfer: el aviso de muestra no salía nunca (0 < 0) | `registrar` copia los bytes en los dos motores, y el perfil cuenta el tamaño antes de registrar. `datos.test.ts` (motor que se lleva los bytes) |
| 2 | `read_parquet` descargaba la extensión de extensions.duckdb.org (fuera de la CSP y sin red) | La extensión de Parquet de DuckDB v1.5.4 (`wasm_eh` y `wasm_mvp`) va con el sitio en `public/duckdb/` y cada conexión apunta `custom_extension_repository` allí. En Node, las pruebas la ponen en la caché de DuckDB desde esa copia y usan un repositorio inexistente (nunca la red). `datos.test.ts` (versión y carpeta, ajuste sin duckdb.org) |
| 3 | Arrow: fechas y marcas de tiempo como milisegundos, decimales sin su escala (1,5 → 150), columnas con el mismo nombre fundidas | Conversión por el tipo del campo y por posición (`valorDeCampo`, `deArrow`); la vista previa, como la escribe DuckDB. `datos.test.ts` |
| 4 | Un Parquet se cargaba entero, sin límite ni muestra | Por encima de 50 MB, sus primeras filas en proporción, con el total exacto de sus metadatos y el aviso «las primeras N filas de M». `datos.test.ts`, `Vista.test.tsx` |
| 5 | 60 s de plazo para descargar e instanciar DuckDB y perfilar 50 MB; tres consultas por columna | `Lector.plazoMs` (180 s para `datos`) y el perfil en 7 consultas para todas las columnas (`histogram()` en un recorrido). `lectores.test.ts`, `datos.test.ts` |
| 6 | La consulta convertía el resultado entero en el hilo principal | `maxFilas`: se convierten 200 y se cuenta el total. `datos.test.ts`, `Vista.test.tsx` |
| 7 | Consulta: archivos registrados para siempre, vista `datos` compartida (carrera entre dos elementos) y una consulta (`BEGIN`, `SET`) que dejaba la conexión tocada | Cada ejecución en su propia conexión, un archivo por consulta montada que se suelta al salir, y una ejecución a la vez. `Vista.test.tsx` |
| 8 | `_s` por debajo de 1 decía el valor en «ms» sin convertirlo | Se convierte (0,25 s → «250 ms»). `datos.test.ts` |
| 9 | Al perfilar salía la señal «analizando» | `Lector.senal`: `leyendo-datos` mientras deriva. `Lectores.test.tsx` |
| 10 | Muestra: la respuesta y la proporción de nulos mezclaban las filas del archivo con los recuentos de la muestra | «Unas N filas… En los primeros 50 MB hay…» (o «En las primeras N filas»); la proporción, sobre las filas perfiladas. `datos.test.ts`, `comparaciones/datos.test.ts` |
| 11 | Un CSV adjunto en Windows-1252 o UTF-16 fallaba | Se pasa a UTF-8 al perfilar y al consultar (`muestraCsv`). `datos.test.ts` |
| 12 | Detección: tabla GFM con `|-|`, log de Python (`17:40:00,123`) y CSV con campos de varias líneas | Las tres; también el detector de Markdown acepta `|-|`. `datos.test.ts`, corpus (`datos/26`, `log/26`, `markdown/26`) |
| 13 | `Infinity` dentro del SQL del histograma | Solo números finitos en el SQL. `datos.test.ts` |
| 14 | El resultado guardado no validaba las columnas (NaN) y el veredicto ignoraba los cambios de tipo | `columnas_tipo` en el resultado, validación de todas las cifras y aviso por tipo. `comparaciones/datos.test.ts`, `Vista.test.tsx` |
| 15 | Códigos sin traducir (`datos.sinBytes`), `tabla.parquet` suelto en la raíz, Parquet antiguos con `pendiente_lector` sin releer, accesibilidad | Errores con palabras; el archivo, fuera; `releerPendientes` al abrir el espacio (cualquier lector de binarios nuevo); región viva del resultado, nombres de columna como cabeceras de fila y ⌘ en Mac. `Vista.test.tsx`, `reprocesar.test.ts` |

### Decisiones de la verificación

| Decisión | Por qué |
|---|---|
| La extensión de Parquet (unos 3 MB por variante) va en el repositorio, en `public/duckdb/v1.5.4/` | Nada sale del navegador y funciona sin red; es el archivo oficial y firmado de la versión de DuckDB que trae el paquete (una prueba comprueba que la versión coincide). |
| `lectorDatos` pasa a la versión 2 | Los derivados guardados tenían fechas en milisegundos y la muestra con otra forma: se recalculan. |
| Los intervalos de una consulta salen vacíos (`null`) | apache-arrow no lee bien los intervalos de DuckDB: mejor nada que un valor falso. El perfil y la vista previa los escriben como texto de DuckDB. |
| «DuckDB, solo la primera vez» solo en la consulta | El perfil corre en el Worker de derivados y el hilo principal no sabe si allí DuckDB ya está listo; mientras deriva sale «Perfilando los datos» con `leyendo-datos`. |
| La prueba de rendimiento de la búsqueda va en su proyecto (`*.rendimiento.test.ts`) y `pnpm test` la corre después del resto | Mide tiempo de reloj: con todos los workers ocupados (más pruebas con DuckDB) medía la máquina (55–85 ms) y no la búsqueda (28 ms sola, igual antes y después). El umbral no cambia. |
| Los elementos de las pruebas de Importar llevan el resumen de verdad del lector Texto | Con el de mentira, la puesta al día del resumen en segundo plano escribía a destiempo y, con carga, cambiaba lo comparado («sin escribir nada», «idénticos»); lo que se comprueba no cambia. |
| `releerPendientes` solo lee un adjunto si su nombre o su tipo apuntan a un lector (no el genérico) | Así no lee entero cada binario pendiente (un vídeo, un ZIP) en cada apertura; un Parquet renombrado sin `.parquet` se queda pendiente (se puede volver a soltar). |
| `formaCsv` lee por índices | Con el corte por filas entre comillas era hasta 12 veces más lento en cada pegado; ahora unos 4 ms en un log de 230 KB y 9–16 ms en un CSV de 1,4 MB. |
