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

- [ ] Cabecera común: chip de tipo, estado, título editable en el sitio y línea de meta.
- [ ] Cuerpo: la `Vista` del lector.
- [ ] Detalles comunes plegados: colecciones, etiquetas, origen, secretos ocultados, ref, cifras citables y «Ver original».
- [ ] Corregir el tipo en un clic (reprocesa con el otro lector y suma una corrección al contador).
- [ ] Notas del usuario (cuerpo del `.md`) con editor simple.
- [ ] Estados ligeros (nuevo, en uso, resuelto, archivado) y los propios de cada tipo.
- [ ] Fijar, mover a la papelera, restaurar y vaciar la papelera (con ZIP previo).

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

