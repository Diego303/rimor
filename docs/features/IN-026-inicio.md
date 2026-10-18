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

- [ ] Feed por días («Hoy», «Ayer», fecha), lista virtual, carga incremental hacia atrás.
- [ ] `Mensaje`: icono, título, hora, vista previa de una línea, respuesta, acciones del lector y «Responder» y «Archivar». Borde naranja mientras está fresco.
- [ ] Segmentado «Todo / Sin clasificar · N».
- [ ] Mensajes de búsqueda (`?texto`) con hasta 5 resultados y «Abrir en Buscar».
- [ ] Mensajes de resurgimiento de ideas (IN-018).
- [ ] Triaje con teclado: `j`, `k`, `Enter`, `r`, `c`, `i` (oculto hasta v0.3), `e`, `f`, `t` y `x`.
- [ ] Estado vacío de primer uso con ejemplos de qué pegar.
- [ ] Compositor fijo abajo y encima de la barra inferior en el móvil.

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

