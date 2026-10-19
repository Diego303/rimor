# IN-027 · Vista de elemento, estados, fijar y papelera

## Objetivo y catálogo

La pantalla de un elemento: lo que es, lo que dice su lector y lo que se puede hacer con él, todo editable en el sitio, con un clic o con el teclado, sin formularios. Catálogo: **VIS-01** (vista de elemento), **ORG-04** (estados ligeros y fijar) y **ORG-07** (papelera). Depende de IN-012 (contrato y vistas de los lectores) e IN-008 (carcasa).

## Estado de partida

- La ruta `/e/$ref` es un hueco. `VistaElemento` (IN-012) ya pinta la vista de un lector con su límite de errores y «analizando» mientras deriva; las vistas de los 11 lectores existen.
- El repositorio tiene `actualizarElemento` (en turno), `moverAPapelera`, `restaurar`, `vaciarPapelera`, `guardarElemento` (que renombra si cambia el título o la ref) y `leerElemento`.
- `cambiarTipo` y `sePuedeCambiar` (IN-026) reprocesan un elemento con otro lector (sin mezclar sus claves propias), dejan la ref vieja en `alias` (que el repositorio sigue resolviendo); el contador `correccionesDeTipo` existe (IN-016).
- Estados ligeros comunes en `espacio/estados.ts` (`en-uso`, `resuelto`, `archivado`; sin estado es «nuevo») y `Lector.estados` para los propios (la idea declara los suyos) (IN-026). `Dialogo` y `FilaElemento` en los componentes (IN-026).
- Las vistas de log, error, mediciones, prompt, Markdown y código tienen su plegado «Detalles» con sus filas y sus cifras.
- La pantalla de referencia (`head`, `details`, `kv`, `cifras`): fila de chips (tipo y estado), título `h2` y línea de meta («Pegado hoy a las 17:49 · Rust»); la vista del lector; plegados «Detalles» con `dl.kv` y las cifras citables.

## Diseño

### Cabecera común (`src/rutas/elemento/Cabecera.tsx`)

- `ChipTipo` + `Estado` (chip) a la izquierda; a la derecha, un único control: el menú de acciones del elemento (fijar, cambiar tipo, papelera).
- **Título editable en el sitio**: un botón con el título; al pulsarlo (o `Enter` sobre él) pasa a ser un campo; `Enter` guarda, `Esc` cancela. Guarda con `actualizarElemento` (el archivo se renombra solo).
- Línea de meta: «Pegado hoy a las 17:49 · Rust» (origen y fecha relativa; el resumen legible del lector).

### Cuerpo

`VistaElemento` del lector (con su límite de errores y la espera de los derivados). Un elemento en la papelera se ve con el aviso «En la papelera» y «Restaurar».

### Notas del usuario

El cuerpo del `.md` (`notas`) con un editor simple: un `textarea` que crece, con guardado al salir del campo y con `Ctrl+Enter`; vacío, un botón «Añadir una nota».

### Estados ligeros

`nuevo` (sin estado), `en-uso`, `resuelto`, `archivado`, más los propios de cada tipo (`Lector.estados`; la idea: `semilla`, `explorando`, `aparcada`, `descartada`, `convertida`). El chip de estado de la cabecera es un botón: abre la lista de estados y uno se elige con un clic (o con `s` en la pantalla).

### Detalles comunes (en el mismo plegado «Detalles» de la vista)

Como en la referencia, cada pantalla tiene **un solo** plegado «Detalles»: las filas propias del lector y, después, lo común. La pantalla pasa a la vista lo común (`PropsVista.detalles`) y la vista lo pone dentro de su «Detalles» (`DetallesDelElemento`), en lugar de su bloque de cifras; una vista sin filas propias pinta solo lo común.

Lo común, en `dl.kv`: referencia (y alias), origen y fecha completa, secretos ocultados (si los hay), colecciones y etiquetas (añadir y quitar en el sitio, con autocompletado), estado, tipo con **«Cambiar tipo»** (lista de lectores de texto; reprocesa y suma una corrección), **«Ver original»** (el texto tal cual en un diálogo, o descargar el adjunto) y las cifras citables del lector (con su contexto, para las que dependen de otros elementos).

### Fijar, papelera, restaurar y vaciar

- **Fijar** / soltar (`fijado`), con la tecla `f` en la pantalla.
- **Mover a la papelera** (`#` o `Supr`): vuelve a Inicio y avisa con «Deshacer» (restaura).
- **Papelera** (`/papelera`, desde «Espacios y papelera» de Datos y copias, como la referencia): lista de lo que hay (`FilaElemento`) con «Restaurar» y **«Vaciar la papelera»**: primero se descarga un ZIP con todo lo que hay en ella (fflate 0.8.3, el mismo formato que usará IN-035) y solo después se borra; si el ZIP no se puede hacer, no se borra nada. IN-035 sustituirá la copia de la papelera por su ZIP automático completo.

### Atajos de la pantalla

`e` editar título, `s` estado, `t` cambiar tipo, `f` fijar, `n` nota, `Supr` papelera. Una ref antigua (un alias) en la dirección lleva a la vigente.

## Tareas

- [x] Cabecera común: chip de tipo, estado, título editable en el sitio y línea de meta.
- [x] Cuerpo: la `Vista` del lector.
- [x] Detalles comunes plegados: colecciones, etiquetas, origen, secretos ocultados, ref, cifras citables y «Ver original».
- [x] Corregir el tipo en un clic (reprocesa con el otro lector y suma una corrección al contador).
- [x] Notas del usuario (cuerpo del `.md`) con editor simple.
- [x] Estados ligeros (nuevo, en uso, resuelto, archivado) y los propios de cada tipo.
- [x] Fijar, mover a la papelera, restaurar y vaciar la papelera (con ZIP previo).

## Pruebas previstas

- Cabecera: chips, meta, título editado en el sitio (Enter, Esc, vacío no se guarda) y archivo renombrado.
- Detalles: colecciones y etiquetas añadidas y quitadas, cifras, «Ver original»; cambiar tipo con la corrección contada.
- Notas: guardar al salir y con `Ctrl+Enter`; vacío.
- Estados: comunes y propios del tipo.
- Papelera: mover (con deshacer), restaurar, vaciar con ZIP previo (y sin borrar si el ZIP falla); el ZIP contiene los archivos de la papelera.
- Atajos de la pantalla; pestaña de solo lectura sin ediciones.

## Criterios de aceptación

- Todo se edita sin formularios: en el sitio, con un clic o con teclado. `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Vaciar la papelera antes de IN-035 | ZIP de la papelera con fflate antes de borrar (dependencia que IN-035 necesita igualmente) |
| Estados propios de cada tipo | Los declara el lector (`estados`); los comunes valen para todos |
| Editar el título renombra el archivo | Lo hace el repositorio en turno; la ref y el id no cambian |
| Elementos de otra pestaña o borrados mientras se ven | La pantalla se suscribe a los cambios del espacio y relee; si ya no existe, «No encontrado» |

## Autorrevisión

Cubre las siete tareas. Lo aprendido en IN-021 a IN-026 que aplica aquí: las ediciones van en turno (`actualizarElemento`) y no pisan lo que cambió mientras tanto; los atajos de pantalla leen el estado del momento; las pruebas de pantalla cargan sus módulos antes (el disco es lento); y lo visual sigue la referencia: un solo «Detalles» por pantalla.

## Implementación

- **Pantalla** (`src/rutas/elemento/`): `Elemento.tsx` resuelve la ref (un alias o el id llevan a la vigente con `replace`) y pinta `PantallaElemento`; `useElementoVivo` relee el archivo cuando su frontmatter cambia en el repositorio (cada guardado deja un objeto nuevo; moverlo cambia la ruta), también desde Inicio u otra pestaña. `Cabecera.tsx` (chips, título, meta y acciones), `Comunes.tsx` (filas comunes de «Detalles» y `sugerir`), `Notas.tsx`, `Dialogos.tsx` (estado y original) y `estados.ts` (nombre de un estado en el idioma).
- **Un solo «Detalles»**: `src/lectores/DetallesElemento.tsx` con `ContextoDetalles` (las filas comunes que pone la pantalla), las filas propias del lector como hijos, un `anexo` (los estadísticos por serie de Mediciones, el frontmatter de Markdown) y las cifras (`cifrasDe`). Las once vistas lo usan y sus textos `detalles`, `cifras` y `sintaxisCifra` pasan a `lectores.*`. `VistaElemento` lo pinta también con el original cuando el lector falla o no tiene vista (para poder cambiarle el tipo).
- **Edición en el sitio**: `src/ui/componentes/EnSitio.tsx` (título, colecciones, etiquetas): el nombre del botón es lo que se ve y lo que hace va en `title`; `Enter` o salir guardan una sola vez, `Esc` cancela sin llegar a los atajos; las sugerencias completan la última palabra sin terminar la edición.
- **Ediciones comunes**: `src/espacio/ediciones.ts` (puras: `conFijado`, `conEstado`, `conColecciones`, `conEtiquetas`, `listaDeTexto`, `tituloNuevo`, `limpiarColeccion`, `limpiarEtiqueta`) y `useEdicion` (en turno, con `modificado`). Inicio pasa a usarlas. Fijar alterna lo que hay al escribir, no lo pintado.
- **Estados**: `espacio/estados.ts` suma `estadoVisible`, `estadosPosibles` y `tonoDeEstado`; el contrato, `Lector.estadosElegibles` (la idea no deja elegir «convertida» a mano).
- **Papelera**: el repositorio suma `enPapelera()`, `copiaDePapelera()` (los archivos, y qué elementos y adjuntos entraron) y `vaciarPapelera(copia)`, que borra cada elemento en su turno y solo si sigue en la papelera, y cada adjunto copiado solo si ya no lo usa nadie; `espacio/papelera.ts` hace el ZIP (fflate 0.8.3, `zipSync`, texto comprimido y adjuntos tal cual) con `prepararCopia`. Vaciar va en dos pasos en el diálogo: «Descargar el ZIP» y, después, «Vaciar la papelera». Ruta `/papelera`; Datos y copias suma «Espacios y papelera».
- **Editar desde las vistas**: `PropsVista.editable` (la pantalla dice que no en la papelera); las vistas de idea, error y prompt lo miran además de la pestaña de solo lectura.

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El estado va en el chip de la cabecera, no también en «Detalles» | Ya se ve y se cambia arriba con un clic (`s`); repetirlo abajo sería duplicar el mismo control. |
| A la derecha de la cabecera, dos iconos (fijar y papelera) en lugar de un menú | Un clic, como pide la aceptación; la referencia no muestra menú y el tipo se cambia desde «Detalles». |
| ZIP de la papelera en el hilo principal (`zipSync`) | Es pequeño y raro; IN-035 lo cambiará por su ZIP en streaming en un Worker. |
| Vaciar borra solo lo que entró en el ZIP | Si algo llega a la papelera mientras se hace la copia, no se pierde sin copia. |
| Vaciar en dos pasos (descargar el ZIP, después vaciar) | El navegador no dice si una descarga se guardó (ni si la bloqueó o se canceló): borrar justo después de pedirla podría dejar la papelera vacía sin copia. La descarga va con el clic del usuario. |
| «Detalles» antes de la vista solo con «Analizando» a la vista (más de 400 ms) | En un análisis rápido el plegado aparecería y se volvería a montar con la vista al instante, y se perdería una edición empezada. |
| `Supr` y también `#` para la papelera | En un teclado sin Supr (portátiles Mac). |
| Los nombres de los estados propios, en minúsculas | Como los chips de la referencia (`nuevo`, `semilla`). |
| Dos pruebas antiguas esperan al estado final en vez de a ticks fijos (cola de derivados, compositor) y la de estilo de las respuestas sobre el corpus tiene 30 s | Fallaban solo con la máquina saturada (carga 24); lo que comprueban no cambia. |

## Pruebas

`ediciones.test.ts` (ediciones y estados), `papelera.test.ts` (ZIP, borrar solo tras entregarlo, nombre), `repositorio.test.ts` (lista, archivos y vaciado selectivo con adjuntos), `EnSitio.test.tsx`, `formatos.test.ts` (`diasDesde`), `Elemento.test.tsx` (cabecera, título, estados con teclado, fijar dos veces, «Detalles» con colecciones, etiquetas, original y cambiar tipo con su alias, notas, estados de una idea, papelera con deshacer, solo lectura de verdad con el cerrojo ocupado, ref que no existe) y `Papelera.test.tsx` (desde Datos, lista y restaurar, vaciar con ZIP y sin borrar si falla).

## Verificación

**`pnpm verificar`**: en verde, 64 archivos y 1030 pruebas; carga inicial 216,0 KB de 300. Las pruebas de la carcasa y de la pantalla precargan las pantallas a las que llevan y esperan al desmontar: la carga en diferido de una ruta terminaba después de la prueba («window is not defined»).

**Criterios y tareas, con su evidencia:**

| Tarea o criterio | Evidencia |
|---|---|
| Cabecera común: chips, estado, título en el sitio y meta | `Elemento.test.tsx` «cabecera…»: chips, «Pegado hoy a las…», `e` + Enter guarda y renombra el archivo, Esc y vacío no guardan |
| Cuerpo: la `Vista` del lector | `Elemento.test.tsx` (vistas de Texto e Idea en la pantalla), `vistas-lectores.test.tsx` |
| Detalles comunes plegados | `Elemento.test.tsx` «Detalles…» (colecciones con sugerencia, etiquetas, secretos, referencia y alias, «Ver original»); `Lectores.test.tsx` (un solo «Detalles», también mientras deriva) |
| Corregir el tipo en un clic con la corrección contada | `Elemento.test.tsx` «Detalles…»: «Cambiar tipo» → Idea, `/e/IDE-0001`, alias y `correccionesDeTipo` = 1; la ref vieja lleva a la nueva |
| Notas con editor simple | `Elemento.test.tsx` «notas…»: Ctrl+Intro, Esc, salir del campo |
| Estados comunes y propios | `Elemento.test.tsx` «estados propios…» (idea sin «convertida»; un estado común en una idea se nombra), `ediciones.test.ts` |
| Fijar, papelera, restaurar y vaciar con ZIP previo | `Elemento.test.tsx` «papelera…» y `f` dos veces; `Papelera.test.tsx` (dos pasos, sin descarga no se vacía); `repositorio.test.ts` y `papelera.test.ts` |
| Todo sin formularios: en el sitio, un clic o teclado | Atajos `e s t f n Supr #`; chip de estado y listas de botones; `EnSitio.test.tsx` |
| Solo lectura | `Elemento.test.tsx` con el cerrojo ocupado de verdad; en la papelera, las vistas de idea, error y prompt no editan (`Elemento.test.tsx`, `vistas-lectores.test.tsx`) |

**Revisión independiente** (subagente con contexto limpio, corrección y aceptación). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | Restaurar mientras se vaciaba rompía el índice y borraba el adjunto | `vaciarPapelera` borra cada elemento en su turno y solo si sigue en la papelera; los adjuntos, solo los copiados y sin uso; «Restaurar» desactivado durante el vaciado. `repositorio.test.ts` «restaurar mientras se vacía» (en los dos órdenes) |
| 2 | Un elemento en la papelera se editaba desde las vistas de idea, error y prompt | `PropsVista.editable`; pruebas en `Elemento.test.tsx` y `vistas-lectores.test.tsx` |
| 3 | Se borraba sin saber si el ZIP llegó a descargarse | Dos pasos (descargar con el clic del usuario, después vaciar); `Papelera.test.tsx` |
| 4 | Una idea con estado común enseñaba la clave cruda | `nombreDeEstado` (ahora en `lectores/nombreEstado.ts`) y segmentado sin marcar; `Elemento.test.tsx` |
| 5 | Elegir una sugerencia borraba lo escrito antes de una coma | `completarUltima` separa también por comas; `EnSitio.test.tsx` |
| 6 | Guardar colecciones o etiquetas pisaba lo añadido mientras tanto | `aplicarCambios` (solo lo añadido y quitado respecto a lo que había al empezar); `ediciones.test.ts` |
| 7 | Sin «Detalles» mientras el lector analiza | Se pinta con «Analizando» a la vista; `Lectores.test.tsx` |
| 8 | Esc durante una composición de IME cancelaba la edición | Esc (y Ctrl+Intro en notas) no actúan durante la composición; `EnSitio.test.tsx` |
| 9 | Si el borrado fallaba a medias, el índice y el aviso mentían | Cada elemento sale del índice al borrarlo; aviso propio («No se pudo vaciar del todo…») |
| 10 | «Fijar/Soltar» con `aria-pressed` se leía «Soltar, pulsado»; faltaba `#` | Nombre fijo «Fijar» con `aria-pressed` y ayuda emergente; `#` además de `Supr` |

