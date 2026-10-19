# IN-026 · Inicio: feed y triaje

## Objetivo y catálogo

La pantalla principal como en «Pantallas de Rimor»: lo capturado, por días, con lo que Rimor ha entendido, y el triaje con teclado. Catálogo: **ORG-01** (plan §9.1). Depende de IN-015 (compositor), IN-016 (respuestas), IN-017 (lectores) y la decisión **D17** (lista virtual con `@tanstack/react-virtual`). Fuera, como dice la §3: sesiones, «convertir en investigación» (la tecla `i` está oculta hasta v0.3) y Métricas en el raíl.

## Estado de partida

- `Inicio` tiene el compositor fijo abajo, la tarjeta de persistencia, `IdeasQueVuelven` y un vacío provisional.
- El repositorio tiene en memoria el frontmatter de todos los elementos (`elementos()`), avisa de cada cambio (`alCambiar`), y `actualizarElemento` escribe en turno. `sinClasificar(fm)` y el recuento del raíl ya existen (IN-007).
- `useRespuesta` compone la respuesta de un elemento con sus derivados (cola con prioridad); `RespuestaRimor` la pinta. Las respuestas traen sus acciones (`Respuesta.acciones`).
- El compositor anota las búsquedas `?texto` en `useCompositor.busquedas` para que el feed las pinte, y `responderA(ref)` pone el modo respuesta.
- Los estilos `.feed`, `.day`, `.msg`, `.msg.fresh`, `.mhead`, `.mprev`, `.rimor`, `.mact` y `.empty` ya están portados de la referencia (IN-002).
- La pantalla de referencia `SC.inicio`: cabecera «Inicio» con la fecha y el segmentado «Todo / Sin clasificar · N»; el feed con «Ayer» y «Hoy»; los mensajes con icono de tipo, título (botón), hora, vista previa en mono, la respuesta y la fila de acciones (las del lector, un hueco, «Responder» y «Archivar»); las búsquedas como mensaje con hasta 5 resultados y «Abrir en Buscar»; el vacío «Nada sin clasificar».

## Diseño

### Datos del feed (`src/rutas/inicio/feed.ts`, puro)

- `filasDelFeed(elementos, { filtro, ahora, zona })` → filas planas para la lista virtual: separadores de día (`Hoy`, `Ayer`, fecha) y mensajes, **en orden cronológico** (lo más reciente abajo, junto al compositor, como un chat). Filtro `todo` o `sinClasificar`. En `todo` no salen los archivados ni los de la papelera.
- Las búsquedas del compositor y las ideas que vuelven se intercalan en «Hoy» por su hora.
- **Carga incremental hacia atrás**: se empieza con los últimos 7 días que tengan algo (y al menos 50 mensajes); al acercarse al principio de la lista se añaden los 7 días anteriores, conservando la posición.
- «Fresco»: capturado en esta sesión hace menos de 10 minutos (o hasta que se abre).

### Lista virtual (D17)

`useVirtualizer` de `@tanstack/react-virtual` con alturas medidas (`measureElement`), anclado abajo: al abrir, el final del feed queda a la vista; al cargar días anteriores, se compensa el desplazamiento. Solo los mensajes visibles (más un margen) piden su respuesta (`useRespuesta`, prioridad `visible` para los de la pantalla).

### `Mensaje` (`src/rutas/inicio/Mensaje.tsx`)

Como `msgHTML`: icono de tipo (`IconoTipo`), título (botón que abre el elemento), hora, vista previa de una línea (la primera con contenido del original o el resumen legible del lector), la respuesta, las acciones del lector y, tras un hueco, «Responder» (modo respuesta del compositor) y «Archivar» (estado `archivado`; deshacer en el aviso). Borde naranja si está fresco; anillo de foco si está seleccionado con el teclado.

### Segmentado y vacío

- «Todo / Sin clasificar · N», con N del raíl.
- Primer uso (espacio vacío): ejemplos de qué pegar (un log, una traza, una URL, una idea, mediciones), como tarjetas que llenan el compositor al pulsarlas.
- Filtro sin resultados: «Nada sin clasificar» de la referencia.

### Búsquedas (`?texto`)

Mensaje de búsqueda con hasta 5 resultados y «Abrir en Buscar». Mientras no llegue el buscador completo (IN-032), busca en lo que el repositorio tiene en memoria: título, ref, colecciones, etiquetas y resumen legible, sin acentos ni mayúsculas, con todas las palabras.

### Triaje con teclado (`src/rutas/inicio/triaje.ts`)

Con el feed enfocado (y nunca dentro de un campo de texto):

| Tecla | Acción |
|---|---|
| `j` / `k` | Siguiente / anterior (se desplaza para que quede a la vista) |
| `Enter` | Abrir |
| `r` | Responder (modo respuesta del compositor, que lo enfoca) |
| `c` | Añadir a colección: un cuadro con las colecciones existentes y autocompletado; escribe `colecciones` |
| `i` | Oculta hasta v0.3 |
| `e` | Archivar (sale de «Sin clasificar»), con deshacer |
| `f` | Fijar / soltar (`fijado`) |
| `t` | Cambiar tipo: lista de lectores; reprocesa con el elegido y suma `correccionesDeTipo` |
| `x` | Seleccionar / quitar de la selección; una barra dice cuántos hay y `Esc` la vacía (comparar y agrupar llegan con IN-028 e IN-030) |

Los atajos se registran en la ayuda de «?» (IN-008).

### Compositor

Fijo abajo (ya lo está) y, en el móvil, encima de la barra inferior.

## Tareas

- [x] Feed por días («Hoy», «Ayer», fecha), lista virtual, carga incremental hacia atrás.
- [x] `Mensaje`: icono, título, hora, vista previa de una línea, respuesta, acciones del lector y «Responder» y «Archivar». Borde naranja mientras está fresco.
- [x] Segmentado «Todo / Sin clasificar · N».
- [x] Mensajes de búsqueda (`?texto`) con hasta 5 resultados y «Abrir en Buscar».
- [x] Mensajes de resurgimiento de ideas (IN-018).
- [x] Triaje con teclado: `j`, `k`, `Enter`, `r`, `c`, `i` (oculto hasta v0.3), `e`, `f`, `t` y `x`.
- [x] Estado vacío de primer uso con ejemplos de qué pegar.
- [x] Compositor fijo abajo y encima de la barra inferior en el móvil.

## Pruebas previstas

- `filasDelFeed`: días en la zona local (medianoche), orden, filtro, archivados fuera, búsquedas e ideas intercaladas, ventana de días y carga hacia atrás.
- Mensaje: título, hora, vista previa, respuesta, acciones, «Responder» y «Archivar» (con deshacer), fresco.
- Triaje completo con teclado (happy-dom, sin Playwright por ahora, como pide el autor): `j`/`k`, `Enter`, `r`, `c`, `e`, `f`, `t`, `x` y `Esc`; nada se dispara dentro de un campo.
- 5.000 elementos: se pintan solo los visibles (unas decenas de nodos) y preparar las filas cuesta menos de 50 ms. La medida de desplazamiento fluido en un navegador real queda para cuando se use Playwright.
- Búsqueda en memoria: todas las palabras, sin acentos; hasta 5; «Abrir en Buscar».

## Criterios de aceptación

- Coincide con la pantalla Inicio de la referencia, salvo lo que la §3 aplaza; `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Respuestas de 5.000 elementos | Solo las de los mensajes montados por la lista virtual; la cola deduplica y prioriza lo visible |
| `c` y `t` dependen de pantallas posteriores (colecciones IN-033, corregir tipo IN-027) | Se hacen aquí con lo mínimo (escribir `colecciones`, reprocesar con otro lector); IN-027 e IN-033 los reutilizan |
| Buscar antes de IN-032 | Búsqueda en memoria sencilla, que IN-032 sustituye por el índice |
| Prueba de extremo a extremo sin Playwright | Integración en happy-dom con el teclado; registrado para cuando se active Playwright |

## Autorrevisión

Cubre las ocho tareas, la prueba de triaje y la de 5.000 elementos (adaptadas: sin Playwright, como pide el autor). Lo que depende de otras IN (hilos IN-030, colecciones IN-033, corregir el tipo IN-027, comparar IN-028, buscador IN-032) se hace aquí con lo mínimo y reutilizable. Lección de las IN anteriores: el feed es una pantalla de lectura y triaje; todo lo que calcula (filas, días, búsqueda) va en módulos puros con pruebas, y la vista solo pinta.

## Cambios durante la implementación

- Dependencia nueva `@tanstack/react-virtual` 3.14.13 (y `@tanstack/virtual-core` 3.17.11), publicadas hace más de dos semanas. Si el contenedor o una fila miden 0 (antes de maquetar), la lista usa el alto de la ventana y el estimado: nunca una lista vacía ni un bucle de medidas.
- El módulo puro se llama `filas.ts` (en `/mnt/d` los nombres no distinguen mayúsculas: `feed.ts` chocaba con `Feed.tsx`).
- **Los atajos leen el feed y la selección de ahora** (una referencia que se actualiza en cada pintado), no los del momento en que se registraron: una tecla pulsada justo después de un cambio actúa sobre lo que se ve.
- Cambiar tipo (`t`) va en `captura/reprocesar.ts` (`cambiarTipo`, `sePuedeCambiar`): solo entre lectores de texto; ref nueva con la vieja en `alias`; suma `correccionesDeTipo`. IN-027 lo reutiliza.
- `useElemento` lee el elemento completo de cada mensaje montado (y recuerda los últimos 300) para la vista previa y la respuesta.
- Lo fresco (borde naranja) se guarda en `estado/frescos.ts`: lo capturado en esta sesión, 10 minutos o hasta abrirlo.
- Las acciones de las respuestas que el feed sabe hacer: `coleccion:X` y `no`; las de hilos llegan con IN-030.
- `Dialogo` nuevo en los componentes (el `<dialog>` nativo de la ayuda de atajos, reutilizable).
- La búsqueda del feed busca en memoria (título, ref, tipo, colecciones, etiquetas y resumen legible) hasta que llegue IN-032.
- Pruebas: Inicio, la carcasa y la app cargan Inicio una vez antes de sus pruebas (con todos los lectores, su primera transformación en `/mnt/d` tarda segundos); el corpus de captura va en una prueba por carpeta.


## Verificación

**`pnpm verificar`** (2026-10-19): tipos 0 errores; Biome, colores y textos, OK; Vitest 59 archivos y 995 pruebas, OK; construcción OK; carga inicial 212,6 KB.

| Criterio | Evidencia |
|---|---|
| Feed por días, lista virtual, carga hacia atrás | `filas.test.ts` (días locales, orden, filtros, búsquedas e ideas sin quitar días, ventana); `Feed.test.tsx` con un contenedor que se desplaza: al montar no carga nada y queda abajo; al llegar arriba, una tanda y la vista se queda donde estaba; con 5.000 mensajes monta 12 filas |
| Mensaje | Prueba de Inicio: icono, título, hora, vista previa, respuesta, acciones en la misma fila que «Responder» y «Archivar», fresco |
| «Todo / Sin clasificar · N» | Prueba de Inicio |
| Búsquedas con 5 resultados y «Abrir en Buscar» | Prueba de Inicio y de `buscarEnMemoria`; resultados como filas de elemento (`itemRow`) |
| Ideas que vuelven | En «Hoy», solo en «Todo» |
| Triaje con teclado | Prueba de Inicio de punta a punta (happy-dom, sin Playwright): `j`, `k`, `Enter`, `r`, `c`, `e`, `f`, `t`, `x`, `Esc`; nada dentro de un campo ni con un diálogo abierto; `Enter` sobre un botón es del botón |
| Primer uso | Ejemplos que llenan el compositor |
| 5.000 elementos sin tareas de más de 50 ms | Preparar las filas, el mejor de tres por debajo de 50 ms; la lista monta unas decenas de nodos. El desplazamiento fluido en un navegador real queda para cuando se use Playwright |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Carga hacia atrás en cascada y vista sin anclar**: los días anteriores se piden desde el desplazamiento del contenedor (nunca en el primer pintado), una tanda cada vez, y lo añadido arriba se compensa en el desplazamiento; el anclaje abajo solo cuando llega una fila nueva al final.
2. **`Enter` se quedaba la tecla sobre cualquier botón**: los atajos pueden decir cuándo valen (`cuando`); `Enter` solo con algo seleccionado y fuera de botones, enlaces y campos; `Esc` solo con algo marcado.
3. **El día más antiguo desaparecía con una búsqueda o ideas hoy**: los días cargados se cuentan por sus mensajes.
4. **`cambiarTipo` liberaba la ref vieja**: el repositorio indexa los alias (siguen llevando al elemento, también tras releer los archivos) y `refs()` los incluye.
5. **`cambiarTipo` guardaba con un lector que fallaba y mezclaba metadatos**: sin borrador no se guarda; las claves propias del lector anterior se quitan; el estado se conserva si es común o vale en el tipo nuevo; el alias no contiene la ref vigente; se escribe en turno y no pisa una edición hecha mientras se leía.
6. **El feed volvía a lo seleccionado cada minuto**: solo cuando cambia la selección.
7. **Respuestas encoladas de lo que ya no se ve**: se piden con prioridad `visible` y se retiran de la cola al desmontarse el mensaje.
8. **Resultados de búsqueda distintos de la referencia**: `FilaElemento` (icono, título en negrita, resumen y fecha), reutilizable.
9. **Acciones del lector en otra fila**: en la de «Responder» y «Archivar», antes del hueco.
10. **Leves**: sin «Cargando días anteriores…»; el margen de la lista se vuelve a medir si cambia la columna; la caja de colección empieza vacía cada vez; en una pestaña que solo lee no se ofrecen «Responder», «Archivar» ni las acciones del lector; si lo seleccionado desaparece, la selección pasa al vecino y las marcas de lo que ya no está se quitan; lo fresco va por id (sobrevive a un cambio de tipo); la búsqueda no casa con el nombre interno del tipo y sí con el traducido; sin original, la vista previa es el resumen legible; el seleccionado recibe el foco (un lector de pantalla lo anuncia), los mensajes llevan `aria-posinset` y `aria-setsize`, y solo lo fresco se anuncia al llegar su respuesta; una acción que falla se puede reintentar; `alArchivar` estable.

Sin cambiar: «No» en una respuesta se recuerda en la sesión, no en el archivo.

Añadido para las siguientes IN: estados ligeros comunes en `espacio/estados.ts` y `Lector.estados` (los propios del tipo; la idea declara los suyos), que IN-027 usa.
