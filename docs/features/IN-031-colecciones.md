# IN-031 · Colecciones y etiquetas

## Objetivo y catálogo

Agrupar a mano (colecciones, un elemento puede estar en varias) y etiquetar sin esfuerzo (lo que Rimor infiere más lo que el usuario escribe con `#`). Catálogo: **ORG-02** (colecciones) y **ORG-03** (etiquetas inferidas y manuales). Depende de IN-014 (captura) e IN-008 (carcasa).

## Estado de partida

- Cada elemento guarda sus `colecciones` y `etiquetas` en el frontmatter; el compositor ya acepta `@colección` y `#etiqueta`, Inicio añade a una colección con `c` y la pantalla del elemento las edita en el sitio (IN-026, IN-027).
- El raíl pinta las colecciones con su recuento, sacadas de los elementos (`resumenParaCarcasa`): una colección vacía no existe y el orden es alfabético.
- `@rimor/formato` tiene `coleccionesSchema` (`colecciones.json`: `id`, `nombre`, `orden`, `creado`); nada lo lee ni lo escribe.
- La respuesta del lector Texto ya propone «¿Lo añado a la colección gateway?» con las candidatas del contexto (`coleccionesCandidatas`: por etiquetas compartidas y, si no, por palabras del título); los demás lectores no.
- `/c/$coleccion` es un hueco.

## Diseño

### `colecciones.json` (`src/espacio/colecciones.ts`)

- Un registro con el **orden** y la fecha de cada colección; el `id` es el nombre que llevan los elementos (lo que ya se escribe con `@gateway`).
- Al abrir y con cada cambio (en la pestaña que escribe), se **sincroniza**: una colección que aparece en un elemento y no está en el registro (creada al vuelo con `@nueva`, desde Inicio, desde el elemento o al importar) entra al final.
- Operaciones: **crear** (vacía), **renombrar** (el registro y, en segundo plano, el frontmatter de sus elementos, cada uno en su turno; sin tocar `modificado`, como el hilo: es organización), **borrar** (sale del registro y de sus elementos, que se quedan) y **mover** arriba o abajo (el orden del raíl).
- Lo lee y escribe el espacio (`EspacioAbierto.colecciones`), como el estado de cuidado; la otra pestaña lo relee.

### Raíl

Las colecciones del registro en su orden, con su recuento (las vacías, con 0).

### Pantalla de colección (`/c/$coleccion`)

Lista simple (el panel visual llega en IN-052): el nombre (editable en el sitio: renombrar), «N elementos», los elementos de lo más reciente a lo más antiguo con `FilaElemento`, y a la derecha **subir**, **bajar** y **«Borrar la colección»** (con confirmación: «los elementos se quedan»). Una colección que no existe: «No encuentro esta colección».

### Etiquetas inferidas (`src/captura/etiquetas.ts`)

Al capturar, junto a las manuales (`#` del compositor): los **hashtags** del texto (`#palabra`; no los encabezados de Markdown, ni los colores `#fff`, ni `#123`, ni lo que va en bloques de código), los **dominios** de sus enlaces (`github.com`), los **paquetes** de los enlaces a npm, PyPI, crates.io y pkg.go.dev, el **lenguaje** que dice su lector (código, error) y los **niveles** de un log que tiene errores o avisos (`error`, `warn`). Como mucho ocho, en minúsculas y sin repetir; se guardan con las demás (se pueden quitar a mano).

### Sugerencia de colección en la respuesta

La composición de la respuesta (`componer`) la añade a la de cualquier lector cuando ese lector no propone nada, el elemento no está en ninguna colección, el contexto tiene una candidata y cabe sin pasar de dos frases: «¿Lo añado a la colección gateway?» con «Sí, a gateway» y «No». El lector Texto la sigue dando con su propia frase.

## Tareas

- [x] `colecciones.json`: crear, renombrar (reescribe el frontmatter de sus elementos en segundo plano), borrar (los elementos quedan) y ordenar.
- [x] Crear al vuelo con `@nueva` desde el compositor.
- [x] Etiquetas inferidas: hashtags, paquetes, dominios, lenguajes y niveles de log; manuales con `#`.
- [x] Raíl con las colecciones y su recuento; lista simple de cada colección (el panel visual llega en IN-052).
- [x] Sugerencia de colección en la respuesta («¿Lo añado a la colección gateway?»), por coincidencia de etiquetas y palabras.

## Pruebas previstas

- Registro: leer uno que falta o es ilegible (no se pisa), sincronizar, crear, renombrar (los elementos cambian, sin `modificado`), borrar (los elementos se quedan sin ella), mover; solo lectura.
- Etiquetas: cada fuente y lo que no cuenta (encabezados, colores, números, código); el límite; la captura las guarda con las manuales.
- Raíl en el orden del registro, con las vacías.
- Pantalla: lista, renombrar en el sitio, subir y bajar, borrar con confirmación.
- Respuesta: la sugerencia en un lector que no propone nada, y no si ya está en una colección o pasaría de dos frases; el estilo de todas las respuestas sigue en regla.

## Criterios de aceptación

- `pnpm verificar` en verde; las respuestas siguen cumpliendo las reglas de estilo.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Registro y elementos pueden no coincidir (otra herramienta, importación) | Los elementos mandan: lo que falta en el registro se añade; una colección del registro sin elementos sigue (vacía) hasta que se borre. |
| Renombrar muchas | En segundo plano y en turno por elemento; el registro se cambia primero, así que el raíl y la pantalla siguen al nombre nuevo. |
| ¿Inferidas aparte de las manuales? | Juntas: una etiqueta es una etiqueta; si sobra, se quita a mano y no vuelve (se infieren solo al capturar). |
| Sugerencia en todos los lectores | Solo si el lector no propone ya otra cosa y cabe en dos frases. |

## Autorrevisión

Cubre las cinco tareas. Aplica lo aprendido: organización sin tocar `modificado`, escrituras en turno, lo de otra pestaña por la relectura, textos por i18n y pruebas de pantalla con `pruebas/app.tsx` y `pruebas/fechas.ts`.

## Implementación

- `src/espacio/colecciones.ts`: operaciones puras (`sincronizar`, `crear`, `renombrar` (junta si ya existe), `borrar`, `mover`, `ordenadas`) y `GestorColecciones` (lee y escribe `colecciones.json` en orden; no pisa uno ilegible; solo escribe la pestaña que escribe; renombrar y borrar reescriben los elementos en su turno sin tocar `modificado`, y lo que se está renombrando no vuelve al registro por una sincronización a mitad). `leerColecciones` en `@rimor/formato`.
- `abrir.ts`: `EspacioAbierto.colecciones`; sincroniza al abrir y tras cada tanda de cambios de elementos (`@nueva` del compositor, `c` en Inicio, el elemento, la importación); se relee con lo de otra pestaña.
- Raíl: `resumenParaCarcasa` con el registro (orden y vacías, con su recuento).
- `src/rutas/coleccion/Coleccion.tsx`: lista, renombrar en el sitio, «Subir»/«Bajar», «Borrar la colección» con confirmación.
- `src/captura/etiquetas.ts` (`etiquetasInferidas`) y su uso en la captura (también en una versión nueva).
- `componer`: la sugerencia de colección para cualquier lector que no proponga nada.
- Las sugerencias de colecciones de Inicio y del elemento incluyen las del registro.
- Pruebas: `colecciones.test.ts`, `etiquetas.test.ts` (también la captura), `componer.test.ts` y `rutas/coleccion/Coleccion.test.tsx` (raíl, lista, renombrar, bajar, borrar).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| «Subir» y «Bajar» con texto en vez de iconos | No hay iconos de flecha en el juego de la referencia; un texto dice lo que hace. |
| Renombrar a una colección que ya existe las junta | Es lo que pasaría al escribir el mismo nombre en los elementos; no hay dos con el mismo nombre. |

