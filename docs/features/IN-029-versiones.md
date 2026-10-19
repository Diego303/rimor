# IN-029 · Versiones e historial

## Objetivo y catálogo

Que pegar otra vez un prompt, un documento Markdown o un código que ya estaba no cree un elemento suelto, sino su **versión nueva**, con lo que cambió a la vista; y que nada de lo que el usuario edita se pierda: cada versión anterior queda en `historial/` y se puede restaurar. Catálogo: **CMP-02** (versiones con diff) y **DAT-08** (historial por elemento). Depende de IN-005 (repositorio), IN-023 (Prompt) e IN-024 (Markdown).

## Estado de partida

- El frontmatter ya admite `version` (entero ≥ 1; sin él, 1). `rutaHistorial(ref, fecha)` da `historial/PRM-0012/2026-10-17T18-05-12.md`, y el repositorio tiene `guardarEnHistorial` (sin pisar: `-2`, `-3`…), `leerHistorial` y `borrarDeHistorial`. En `historial/REF/` ya viven los resultados de los prompts (`resultado-2026-10-17.md`, IN-023).
- La captura (`captura/flujo.ts`) detecta el tipo, evita el duplicado exacto (mismo hash) y crea el elemento; Inicio pinta lo capturado por días y las búsquedas de la sesión como filas propias del feed (`compositor.busquedas`).
- La referencia: el prompt tiene `v1 · v2` en la cabecera y el plegado «Cambios de la versión 1 a la 2» con el diff por líneas (`+`/`−`); el documento Markdown dice «Versión 3, pegada ayer a las 16:30 · 2.140 palabras», marca en su índice las secciones «añadida» y «modificada», tacha la «eliminada», resume «Desde la versión 2: 1 sección añadida, 1 modificada, 1 eliminada y 2 tareas marcadas.» y tiene el plegado «Versiones» con cada una y su fecha.

## Diseño

### Historial en el repositorio

`Repositorio.guardarConHistorial(refOId, cambio, motivo)`: en el turno del elemento, lee el actual y, si `cambio` lo cambia, **guarda primero el actual entero en `historial/REF/fecha.md`** (el mismo `.md`, con `historial: { motivo, reemplazado }` añadido a su frontmatter) y después el nuevo. Si cambia el original, el nuevo sube `version`; si solo cambian las notas o el título (una edición), queda la copia en el historial con la misma versión. Es lo que usan la captura de una versión, restaurar y las ediciones del usuario (título y notas; lo usará también la importación al fusionar, IN-036). Los cambios ligeros (estado, fijar, colecciones, etiquetas, el resumen de un lector) no dejan copia.

- `versiones(refOId)`: lo que hay en `historial/` del elemento (también bajo sus alias: tras cambiar el tipo cambia la ref), solo las copias (nombre con fecha; no los resultados de los prompts), de la más reciente a la más antigua, con su versión, fecha y motivo.
- `leerVersion(ruta)`: el elemento de una copia.

### Captura de una versión nueva (`captura/versiones.ts` y el flujo)

- Tipos con versiones: **prompt, markdown y código**. Tras el duplicado exacto, si no se pidió guardarlo aparte, se busca un elemento del mismo tipo con el **mismo título** (sin mayúsculas ni espacios de más) o con una **similitud > 0,6** (Jaccard de *shingles* de tres palabras, sobre los primeros 200 KB) entre los 200 modificados más recientemente de ese tipo (fuera de la papelera; los guardados como adjunto no). Gana el más parecido.
- Si lo hay, la captura es su **versión nueva**: `guardarConHistorial` con el original nuevo, su hash, los secretos ocultados de ahora y las colecciones y etiquetas de la indicación sumadas; el título, las notas y lo demás se quedan. Se deriva en segundo plano como cualquier captura.
- El resultado de la captura es `{ tipo: 'version', elemento, version, copia }`. **Deshacer** la devuelve a la versión anterior (la copia vuelve a ser el elemento y se borra del historial), si nadie la cambió después.
- En Inicio, como las búsquedas, la versión es una fila del feed en su momento (`compositor.versiones`, de la sesión): el mensaje con su título y la respuesta «Lo he guardado como su versión 2.», con **«Ver cambios»** (abre el elemento) y **«Guardar aparte»** (deshace y lo guarda como elemento nuevo). El aviso efímero dice lo mismo con «Deshacer».

### Diff (`src/versiones/`, TS puro)

- `diff.ts`: **diff por líneas con Myers** (O(ND), recortando antes el principio y el final comunes): operaciones `=`, `+` y `−`, y `aplicar(antigua, diff)`, que da la nueva (propiedad probada con fast-check). Para pintarlo, las líneas iguales se pliegan dejando tres de contexto («… 12 líneas iguales»).
- `secciones.ts`: **diff por secciones de Markdown** sin parser (barato, en el hilo principal): los encabezados ATX y Setext fuera de los bloques de código, al nivel del índice (sin el título del documento) con sus subsecciones dentro, y las tareas `- [ ]` / `- [x]` de cada una. Por título: **añadidas**, **eliminadas**, **modificadas** (cambia su texto) y **tareas marcadas** (sin marcar en la anterior y marcadas en la nueva).

### Pantalla

- Meta: «Versión 3, pegada ayer a las 16:30 · 2.140 palabras» si la versión es mayor que 1.
- Plegado **«Cambios de la versión 2 a la 3»** (entre la versión de contenido anterior y la actual) con el diff por líneas, como la referencia.
- En Markdown, la vista recibe la versión anterior (por contexto, como «Detalles») y marca en su índice las secciones añadidas y modificadas, pone las eliminadas tachadas y escribe el resumen «Desde la versión 2: …».
- Plegado **«Versiones (N)»** (como el de la referencia, en `dl.kv`): cada una con su fecha y si fue una edición, «Ver cambios» (su diff con la actual, en un diálogo) y **«Restaurar esta versión»**: un diálogo de confirmación y, al confirmar, `guardarConHistorial` con su contenido (original, título y notas; lo demás se queda), `<Senal estado="guardado" veces={1}>` y el aviso «Restaurada como versión 4».
- Las ediciones de título y notas de la pantalla pasan por `guardarConHistorial` (motivo «edición»).

## Tareas

- [x] Al capturar un prompt, Markdown o código muy parecido a uno existente (mismo título o similitud > 0,6 por *shingles*), se propone «guardar como versión nueva» (la respuesta lo dice: «Lo he guardado como su versión 2») con deshacer.
- [x] La versión anterior va a `historial/REF/fecha.md`; el elemento sube `version`.
- [x] Diff por líneas (LCS o Myers) y, en Markdown, diff por secciones: añadidas, quitadas, modificadas y tareas marcadas.
- [x] Lista de versiones y «Restaurar esta versión», con `<Senal estado="guardado" veces={1}>` al confirmar.
- [x] Cualquier edición del usuario sobre un elemento también deja versión (lo usa la importación al fusionar).

## Pruebas previstas

- Propiedad: aplicar el diff a la versión antigua da la nueva (fast-check, textos con líneas repetidas, vacíos y finales sin salto). Casos: iguales, todo nuevo, todo quitado, un cambio en medio, textos grandes.
- Secciones: añadidas, eliminadas, modificadas y tareas marcadas; encabezados dentro de bloques de código; Setext; el título del documento; sin encabezados.
- Similitud: mismo título; > 0,6 y ≤ 0,6; otro tipo no; la papelera no.
- Repositorio: `guardarConHistorial` (copia, versión, sin copia si no cambia), `versiones` (también bajo un alias, sin los resultados de los prompts), en turno.
- Captura: pegar un prompt casi igual crea la versión 2 con su copia en el historial; deshacer la devuelve; guardar aparte crea otro elemento; un código distinto no.
- Pantalla: meta, «Cambios de la versión 1 a la 2», índice de Markdown marcado y su resumen, lista de versiones, restaurar con su señal, ediciones que dejan copia.

## Criterios de aceptación

- Aplicar el diff a la versión antigua da la nueva. `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| «Se propone» frente a guardarlo directamente | Se guarda como versión y se dice, con deshacer y «Guardar aparte» (lo que pide la tarea: «Lo he guardado como su versión 2» con deshacer). |
| Qué es una edición que deja versión | Título y notas (lo que escribe el usuario), restaurar y la versión capturada. Lo ligero (estado, fijar, colecciones, etiquetas) no: llenaría el historial de copias sin valor. |
| ¿Una edición sube el número de versión? | No: la versión cuenta el contenido (el original); una edición deja su copia con la misma versión, y se ve en la lista como edición. |
| Buscar parecidos sin leer todo el espacio | Solo el mismo tipo, los 200 más recientes y los primeros 200 KB de cada uno; el mismo título se mira en memoria. |
| Diff de textos grandes | Myers con principio y final comunes recortados; el pintado pliega lo igual. |
| Diff por secciones sin el parser de Markdown | Un divisor de líneas propio (ATX, Setext, bloques de código): barato y suficiente para comparar títulos, texto y tareas. |

## Autorrevisión

Cubre las cinco tareas y la prueba de propiedad. Lo aprendido que aplica: las escrituras van en turno y deshacer no actúa si el elemento cambió después; un solo «Detalles» por pantalla y los plegados como la referencia; lo de otras pestañas llega por `alCambiar`; las pruebas de pantalla precargan sus módulos.

## Implementación

- **Diff** (`src/versiones/`): `diff.ts` (Myers con el rastro en ventanas, O(D²) en memoria y con un tope de 2.000 cambios, por encima del cual el tramo central va como quitado y añadido; `aplicar`, `recuentoDiff`, `plegar` con tres líneas de contexto), `secciones.ts` (`seccionesDe`, `diffSecciones`, `claveSeccion`: marcar una tarea no cuenta como modificar la sección) y `parecido.ts` (*shingles* de tres palabras sin acentos, Jaccard).
- **Repositorio**: `guardarConHistorial` (copia entera con `historial: { motivo, reemplazado }`, versión nueva solo si cambia el original), `versiones` (también bajo los alias; solo los nombres con fecha) y `deshacerHistorial` (si el elemento sigue con ese hash, versión y ref).
- **Captura**: `captura/versiones.ts` (`anteriorDe`: mismo título no genérico con un parecido mínimo de 0,2, o parecido > 0,6 entre los 200 más recientes de su tipo) y el paso 6b de `flujo.ts`, que devuelve `{ tipo: 'version', capturado, version, copia }`; `EntradaCaptura.aparte`; `deshacerVersion`. `Captura.tsx` la anota para el feed y avisa con «Deshacer»; `MensajeVersion.tsx` en Inicio («Ver cambios», «Guardar aparte»).
- **Pantalla**: `Versiones.tsx` (`useVersiones`, `DiffLineas`, `CambiosDeVersion`, `ListaVersiones` con «Ver cambios» y «Restaurar esta versión», la señal «guardado» al restaurar); `ContextoVersion` para la vista de Markdown, que marca su índice y escribe «Desde la versión N: …»; la meta «Versión N, pegada…»; título y notas con `editarConHistorial`.
- **Respuestas**: `Contexto.versiones` se rellena con las versiones anteriores (pendiente anotado desde IN-016).
- **Pruebas**: `versiones.test.ts` (propiedad con fast-check, 500 casos; secciones como la referencia; parecido), `repositorio.test.ts`, `captura/versiones.test.ts` (versión 2, duplicado, deshacer, aparte, otro tipo, mismo título) y `rutas/elemento/Versiones.test.tsx` (pantalla del prompt con restaurar y edición, índice de Markdown, el mensaje de Inicio con «Guardar aparte»).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Con el mismo título, también un parecido mínimo (0,2) | Los títulos de código y de prompt salen del contenido: dos distintos pueden llevar el mismo y no ser el mismo. |
| El título genérico del lector («Prompt», «Código») no cuenta como mismo título | Lo pone el lector cuando no encuentra otro. |
| «Versión N, pegada…» con la fecha de la última modificación | Es cuando llegó la versión actual; una edición posterior la mueve, como mueve `modificado`. |
| Restaurar trae el texto, el título y las notas de la copia; el estado, las colecciones y lo demás se quedan | Es lo que se versiona; lo demás es de organización y es de ahora. |
| Dos documentos distintos hechos con la misma plantilla (actas, informes) pueden pasar de 0,6 y tomarse por versiones | Es el umbral del plan; por eso la versión se dice en el feed con «Guardar aparte» y «Deshacer». La prueba del corpus de detección los captura aparte. |
| Myers con tope de cambios | El rastro crece como D²; por encima del tope el diff sigue siendo correcto (la propiedad se cumple), aunque no mínimo. |

