# IN-024 · Lector Documento Markdown

## Objetivo y catálogo

Un documento de trabajo (plan, especificación, notas largas) con su índice, cuántas palabras tiene y cómo van sus tareas. Catálogo: **LEC-08** (plan §8.5). Depende de IN-017. El diff por secciones y las marcas de cambio en el índice son de IN-029; aquí el índice deja el hueco para ellas.

## Estado de partida

- `markdownAHast` (IN-009) ya parsea con remark-parse y remark-gfm y sanea; `MarkdownSeguro` lo pinta sin `dangerouslySetInnerHTML`. Los encabezados no llevan `id`.
- El tipo `markdown` (ref `DOC-MD-0004`) existe en `@rimor/formato`; `/md` y `/doc` ya lo fuerzan.
- Pantalla de referencia `SC.md`: tarjeta con «7 de 22 tareas» en negrita y el porcentaje en `mono xs muted` a la derecha; `.meter`; lista de secciones (`.list`, filas `row` con `justify-content: space-between`, `padding: 5px 0` y borde inferior `--line-2`) con el título en `sm` y `hechas/total` en `mono xs muted`; las marcas «añadida», «modificada», «eliminada» (IN-029). Plegado «Ver «3. Streaming»» con la sección renderizada (`.dp`, tareas como `label.chk` con su casilla deshabilitada) y plegado «Versiones» (IN-029). En la cabecera, «2.140 palabras».

## Diseño

### `src/lectores/markdown/analisis.ts` (puro; se carga solo al derivar)

`analizarMarkdown(texto)` con remark-parse y remark-gfm (el mismo parser que pinta) recorre el árbol mdast:

- **Secciones**: todos los encabezados con `{ nivel, titulo, ancla, tareas: { hechas, total }, palabras }`. El índice muestra los del nivel más alto presente y el siguiente; las tareas y palabras de un subencabezado más profundo suman en su sección del índice.
- **Ancla estable**: `anclaDe(titulo)` = título en minúsculas, sin acentos ni signos, espacios a guiones (`slug` de `@rimor/formato`); repetidas, `-2`, `-3`… en orden. La misma función pone el `id` (`rimor-<ancla>`) a los encabezados al pintar, para que el índice lleve a su sitio.
- **Palabras**: en el texto que se lee (párrafos, listas, tablas, citas, encabezados y código en línea); sin los bloques de código ni el HTML.
- **Tareas**: elementos de lista con casilla (`- [ ]`, `- [x]`), por sección y en total.
- **Enlaces**: los `link` y autoenlaces (URL, sin repetir, hasta 50) y las menciones `[[REF]]`.
- **Bloques de código**: cuántos y en qué lenguajes.

### Detección (`detectar`, barata, sin parser)

Señales por línea: encabezados ATX (`# …`), tareas, vallas de código, tablas (fila `|…|` con separador `|---|`), listas y enlaces Markdown. **0,75** con un encabezado y al menos otra señal distinta, o con tres señales distintas; **0,7** con dos o más encabezados y 200 caracteres de texto; si no, 0. Por debajo de Prompt (`CLAUDE.md` 0,85 y prompts con variables 0,8) y por encima de Idea (que solo toma textos cortos) y Texto (0,1). Se mira el principio (20.000 caracteres).

### El lector (`src/lectores/markdown/`)

- `leer`: título del primer encabezado (o la primera línea); resumen provisional `{ palabras }` (recuento rápido).
- `derivar` (con `import()` del análisis: remark no entra en la carga inicial).
- `resumen`: `{ secciones, palabras, tareas_hechas, tareas_total }`; `resumenLegible`: «6 secciones · 2.140 palabras · 7/18 tareas».
- **Respuesta**: «Documento con 6 secciones y 18 tareas (7 hechas).»; sin tareas, «Documento con 6 secciones y 2.140 palabras.»; sin secciones, «Documento de 2.140 palabras.».
- **Cifras**: `tareas_hechas`, `tareas_total`, `palabras`.
- `textoIndexable`: títulos de las secciones.

### Vista

1. Tarjeta de progreso (si hay tareas): «7 de 18 tareas» y el porcentaje; `Medidor`; índice con `hechas/total` por sección (si la sección no tiene tareas, vacío). Sin tareas, la tarjeta lleva solo el índice. Cada sección del índice es un botón que lleva a su encabezado en el documento (desplazamiento sin cambiar la ruta).
2. Tarjeta con el documento renderizado y saneado (`MarkdownSeguro` con anclas).
3. Plegado «Detalles»: palabras, secciones, enlaces (los primeros, con su dominio), bloques de código por lenguaje y cifras citables.

## Corpus

- `fixtures/markdown/`: planes y especificaciones reales (con tareas, tablas, código, encabezados repetidos y Setext) con lo esperado.
- `fixtures/deteccion/markdown/`: 25 para la matriz.

## Tareas

- [ ] Deriva índice de secciones (ancla estable por título normalizado), palabras, tareas por sección y en total, enlaces y bloques de código.
- [ ] Vista: progreso de tareas, índice (con el hueco para las marcas de IN-029), documento renderizado y saneado.
- [ ] Cifras: `tareas_hechas`, `tareas_total`, `palabras`.
- [ ] Respuesta: «Documento con 6 secciones y 18 tareas (7 hechas).»

## Pruebas previstas

- Secciones, anclas (con repetidos y acentos), palabras (sin código), tareas por sección (con subencabezados) y en total, enlaces y bloques de código en el corpus.
- Las anclas del índice coinciden con los `id` de los encabezados pintados.
- Respuesta en es y en; reglas de estilo; cifras.
- Vista (happy-dom): progreso, índice con `hechas/total`, documento saneado, ir a una sección.
- Matriz con la carpeta `markdown`; textos, ideas, prompts y `CLAUDE.md` no cambian.

## Criterios de aceptación

- Las pruebas de arriba; `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Un texto con un par de listas no es un documento | Hace falta un encabezado y otra señal, o tres señales |
| `CLAUDE.md` y prompts con encabezados | Prompt puntúa más (0,85 y 0,8); el documento se queda en 0,75 |
| Encabezados en HTML crudo (`<h2>`) | No entran en el índice (el análisis lee el Markdown); se pintan sin ancla |
| El parser pesa | Se carga solo al derivar (Worker) y al pintar (vista diferida) |

## Autorrevisión

Cubre las cuatro tareas. Versiones, diff por secciones y marcas en el índice son de IN-029 (CMP-02). Con lo aprendido en IN-021 a IN-023: la detección lee las líneas a mano o con expresiones sin retroceso (nada de `\s+(.+?)\s*$`), mira solo el principio del texto y se prueba con el detector real contra los demás corpus y contra documentos reales del disco; los documentos con varios encabezados que no son prompts ya dan 0 en Prompt (IN-023), así que no compiten.
