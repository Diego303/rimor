# IN-017 · Lector Texto y lector genérico de archivo

## Objetivo y catálogo

La red de seguridad, y el primer lector que valida el contrato. Catálogo: **LEC-01**. Depende de IN-012 (contrato, registro, plantilla) e IN-016 (respuestas).

## Estado de partida

- Contrato `Lector<D>`, `definirTextos`, registro con `ORDEN_DETECCION` (Texto en el puesto 17, Archivo en el 2) y la plantilla.
- El detector manda los binarios al lector `archivo` (si no hay uno propio) y lo que nadie reconoce a `texto` (IN-013). La captura guarda los binarios como adjunto por hash (IN-014).
- `MarkdownSeguro` (IN-009) para pintar Markdown pegado; `fmtBytes` (IN-003).
- La respuesta de la pantalla de referencia para un texto: «Texto. Menciona «streaming» y «gateway». ¿Lo añado a la colección gateway?» con [Sí, a gateway] [No]; su resumen en el feed: «Texto · 6 líneas».

## Diseño

### `src/lectores/texto/`

- `detectar`: 0,1 con texto (nunca gana por sí mismo: llega por defecto, IN-013); 0 sin texto.
- `leer`: título de la primera línea con contenido, sin marcas de Markdown al principio (`#`, `-`, `*`, `>`, `1.`), recortado a 120; original tal cual; resumen provisional `{ lineas }`.
- `derivar`: `{ lineas, palabras, enlaces, menciones }`. **Enlaces**: URL `http(s)://` del texto, sin repetir y sin la puntuación final pegada (`).,;`). **Menciones**: refs de Rimor (`LOG-0042`, `DOC-MD-0004`…) reconocidas con `analizarRef`, sin repetir.
- `resumen`: `{ lineas, palabras, enlaces: n, menciones: [...] }`; `resumenLegible`: «6 líneas · 2 enlaces».
- `respuesta` (como mucho dos frases, sin «!»):
  - con una colección candidata (contexto): «Texto guardado. ¿Lo añado a la colección gateway?» con [Sí, a gateway] (principal) y [No];
  - si no, con menciones: «Texto guardado. Menciona ERR-0015 y LOG-0042.» (refs como fragmentos);
  - si no: «Texto guardado.»
- `cifras`: `lineas`, `palabras`; `textoIndexable`: los enlaces.
- `Vista.tsx`: el texto con `MarkdownSeguro` en una tarjeta y, debajo, enlaces (abren en otra pestaña con `rel="noopener noreferrer"`) y menciones (enlaces a `#/e/REF`).
- `Tarjeta.tsx`: las tres primeras líneas en `sm muted`.

### `src/lectores/archivo/`

- `detectar`: 0 (llega por el atajo de binarios).
- `leer`: título = nombre del archivo; `original: null` (adjunto por hash, lo guarda la captura); resumen `{ nombre, tam, mime }`; `metadatos: { pendiente_lector: true }`, la marca para reprocesarlo cuando llegue su lector (lo hará quien registre ese lector: imagen y PDF en v0.3).
- `derivar`: `{ nombre, tam, mime }` del `frontmatter.adjunto`.
- `respuesta`: «Archivo de 2,4 MB guardado. Rimor aún no sabe leer este tipo.»; `resumenLegible`: «2,4 MB · application/zip».
- `Vista.tsx`: nombre, tamaño y tipo MIME en una lista `kv`, y **Descargar el original**: lee el adjunto del almacén (`Repositorio.leerAdjunto`, nuevo) y lo descarga con su nombre (Blob y `URL.createObjectURL`, que se revoca al acabar).
- `Tarjeta.tsx`: tamaño y tipo.

### Registro y corpus

- `LECTORES = [lectorArchivo, lectorTexto]` (puestos 2 y 17 del Anexo D).
- `fixtures/deteccion/archivo/`: 25 binarios reales y pequeños (PNG, GIF, JPEG, WebP, PDF, ZIP, gzip, SQLite, Parquet, WebAssembly, ELF, clase de Java, MP3, WAV, ICO, TTF/WOFF, `.xlsx`, `.docx`, tar, bzip2, 7z…), generados con un script en `scripts/` para que se puedan rehacer. Con ellos, la matriz mide texto y archivo.

## Tareas

- [x] Texto: renderiza Markdown saneado; extrae enlaces y menciones de refs; título de la primera línea.
- [x] Archivo genérico: adjunto por hash; muestra nombre, tamaño y tipo MIME; descarga del original; marca «pendiente de lector».
- [x] Respuestas: «Texto guardado.» · «Archivo de 2,4 MB guardado. Rimor aún no sabe leer este tipo.»

## Pruebas previstas

- Texto: título sin marcas, enlaces sin puntuación final ni repetidos, menciones solo de refs válidas, resumen, las tres variantes de respuesta en es y en, vista con Markdown saneado (un `<script>` pegado no se ejecuta) y enlaces.
- Archivo: lectura con la marca, respuesta con el tamaño formateado, vista con la descarga (el Blob tiene los bytes del adjunto).
- Captura de punta a punta con el registro real: un texto cualquiera y un binario cualquiera se guardan y se encuentran por su ref; la matriz de detección con los dos corpus.
- Las reglas de estilo y las instantáneas de IN-016 los cubren solas (recorren `REGISTRO`).

## Criterios de aceptación

- Cualquier cosa que no reconozca otro lector se guarda y se encuentra (prueba de captura con el registro real: texto, binario y archivo vacío de MIME).
- `pnpm verificar` en verde; `pnpm deteccion` con texto y archivo al 100 %.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| ¿Dónde va la marca «pendiente de lector»? | Clave propia del frontmatter `pendiente_lector: true` (se conserva al reescribir) |
| La vista de Texto pinta Markdown pegado | Siempre con `MarkdownSeguro` (IN-009): sin scripts, sin imágenes remotas |
| Binarios del corpus en el repositorio | Pequeños (menos de 2 KB cada uno) y regenerables con su script |

## Autorrevisión

Cubre las tres tareas y la aceptación. Es el primer uso real de la plantilla: si algo del contrato no encaja, se corrige aquí y se anota.

## Cambios durante la implementación

- **Corrección pendiente de IN-013:** el cargador del corpus en `deteccion.test.ts` seguía leyendo solo `.txt` (la sustitución del hallazgo 4 de su revisión no se aplicó porque el formateador había cambiado el texto). Ahora un archivo con otra extensión entra como archivo soltado; con él, la matriz mide texto y archivo (50 ejemplos, 100 %).
- `Repositorio.leerAdjunto(ruta)` para la descarga; leer no necesita el cerrojo.
- `useAvisosOpcional()` en `Avisos.tsx`: las vistas se pintan también sin proveedor de avisos.
- El corpus de binarios lo genera `scripts/corpus-archivos.mjs` (cabeceras reales de 25 formatos, de 14 a 512 bytes).
- La instantánea de respuestas usa el primer ejemplo de la carpeta de cada lector, también si es un archivo (como adjunto).

