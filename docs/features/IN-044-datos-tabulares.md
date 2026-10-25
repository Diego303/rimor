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

- [ ] Carga diferida de DuckDB-WASM en un Worker, con `<Senal estado="cargando">` y «DuckDB, solo la primera vez».
- [ ] El estado `leyendo-datos` en `senal.css`, usado al perfilar o consultar.
- [ ] CSV, TSV y Parquet como adjuntos.
- [ ] Perfil por columna: tipo, nulos, únicos, mínimo, máximo, media, histograma y atípicos.
- [ ] Vista previa de 5 filas; consulta SQL plegada con un editor CodeMirror y el modo SQL.
- [ ] Gráfico rápido (con IN-058).
- [ ] Comparación de dos conjuntos: filas, columnas y cambios de distribución.
- [ ] Límite: por encima de lo medido en F0-5, aviso y muestra.
- [ ] Respuesta «2400 filas y 6 columnas. Hay 17 latencias de 30 s y 20 nulos en bytes.».

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
