# IN-032 · Búsqueda

## Objetivo y catálogo

Encontrar cualquier cosa del espacio escribiendo: texto con tolerancia a erratas y prefijos, más filtros con la sintaxis del Anexo G del plan, con resultados agrupados por tipo y resaltados. Catálogo: **BUS-01** (búsqueda de texto completo) y **BUS-02** (filtros con sintaxis). Depende de IN-006 (caché e índice en IndexedDB), IN-012 (`textoIndexable` de los lectores) y F0-8 (MiniSearch).

## Estado de partida

- F0-8 decidió: **MiniSearch en un Worker**; campos `titulo` (×3), `ref` (×3), `etiquetas` (×2), `notas`, `cuerpo` (primeros 4 KB) y `textoIndexable` (primeros 4 KB); sin acentos ni mayúsculas; difuso solo en términos de más de 3 letras (0,2) y prefijo solo en el último término con 2 letras o más; como mucho 50 resultados agrupados por tipo; **índice en IndexedDB comprimido con gzip**; la app no espera al índice (mientras, «Preparando la búsqueda…»), e indexar desde cero va en segundo plano con la señal «indexando» y el recuento.
- La caché del espacio ya tiene su almacén `indice` (`guardarIndice`, `indice`) y `comprimir`/`descomprimir` (IN-006). Cada lector tiene `textoIndexable`.
- La búsqueda `?texto` del compositor pinta su mensaje en Inicio con una búsqueda provisional en memoria (`buscarEnMemoria`, IN-026). La ruta `/buscar?q=` existe y la pantalla es un hueco. El contador `busquedasConResultado` existe (IN-016).
- La referencia (`SC.buscar`): «Buscar», una caja (icono y campo en mono), unas píldoras de filtros rápidos y «Limpiar»; «N resultados»; una tarjeta por tipo («Error · 2») con filas `itemRow` (título resaltado, «coincide dentro» y el resumen), y el plegado «Afinar» con facetas (tipo, colección, etiqueta) que añaden su filtro; sin resultados, «Sin resultados · Quita algún filtro o prueba otra palabra».

## Diseño

### La consulta (`src/busqueda/consulta.ts`, TS puro)

`analizarConsulta(texto, { ahora })` → palabras, frases exactas (`"read timeout"`), `tipo:` (varios con comas; nombres del tipo, alias del compositor y plurales: `tipo:errores`, `tipo:md`), `en:` (colección o investigación), `#etiqueta`, `desde:` y `hasta:` (`AAAA-MM-DD`, `hoy`, `ayer` y `semana`: los últimos 7 días), `estado:` (el visible: «nuevo» sin estado), `nivel:` (logs con errores o avisos), `huella:` (prefijo de la huella de un error), `dominio:` (enlaces de ese dominio o sus subdominios) y `-excluir`. Sin acentos ni mayúsculas. Un filtro desconocido (`foo:bar`) es una palabra. Los filtros se comprueban sobre el frontmatter en memoria (`coincideFiltros`), sin abrir archivos.

### El índice (`src/busqueda/indice.ts` y `src/workers/busqueda.worker.ts`)

- `IndiceBusqueda` envuelve MiniSearch con los campos y las opciones de F0-8 y guarda, por elemento, la **clave** de lo indexado (`modificado`, `hash` y versión del lector): así, al abrir, solo se reindexa lo que cambió. `exportar` y `cargar` (con su versión: uno de otra versión se descarta y se rehace).
- `buscarTexto(palabras)`: todas las palabras (AND) con difuso y prefijo, y para cada resultado su puntuación, los términos que casan y **si casan solo dentro del contenido** (cuerpo, notas o lo derivado; no en el título, la ref o las etiquetas).
- En un Worker (Comlink), con la misma interfaz en el hilo principal si no hay Worker (pruebas, navegadores raros).

### El motor (`src/busqueda/motor.ts`) y su proveedor

- `MotorBusqueda` mantiene el índice al día: al abrir, carga el guardado de la caché; después indexa lo que falta o cambió (lee el archivo para el cuerpo y las notas y pide los derivados a la cola, con prioridad de fondo, para `textoIndexable`) y quita lo que ya no está (borrado o en la papelera); vuelve a hacerlo tras los cambios del espacio (agrupados). Guarda el índice comprimido (solo la pestaña que escribe), agrupando las escrituras. Expone su estado («preparando», «indexando N de M», «listo»).
- `buscar(texto)`: analiza; filtra el frontmatter; si hay palabras, las busca en el índice; las frases exactas se comprueban leyendo los candidatos mejor puntuados; `-palabra` quita los que la contienen. Sin palabras, lo filtrado de lo más reciente a lo más antiguo. **Ranking**: la relevancia de MiniSearch, con un empujón a lo fijado (×1,25) y a lo reciente (hasta ×1,25 lo de hoy, menos cuanto más antiguo). Devuelve el total y hasta 50, con los términos para resaltar.
- `ProveedorBusqueda` (en la app, dentro del de lectores) y `useBusquedaOpcional()`.

### Pantalla Buscar (`/buscar?q=`)

Como `SC.buscar`: la caja con el icono (en mono, enfocada al entrar), las píldoras de filtros rápidos sacadas de lo que hay (los dos tipos más frecuentes, la colección y la etiqueta más usadas) y «Limpiar»; la consulta va en la dirección (`?q=`). «N resultados», una tarjeta por tipo con filas como `itemRow`: el título con lo que casa resaltado (`mark`), «coincide dentro» si solo casa en el contenido y el resumen del lector; «Afinar» plegado con las facetas de los resultados (tipo, colección, etiqueta), que añaden su filtro. Mientras se prepara el índice, «Preparando la búsqueda…» con su progreso.

### Desde el compositor y el contador

El mensaje de una búsqueda `?texto` en Inicio usa el motor (y la búsqueda en memoria solo si no lo hay). Abrir un resultado (en Buscar o en ese mensaje) cuenta una búsqueda con resultado abierto (`busquedasConResultado`), una vez por búsqueda.

## Tareas

- [x] MiniSearch en un Worker: título, cuerpo, notas, etiquetas, ref y `textoIndexable` de cada lector; tolerancia a erratas y prefijos.
- [x] Analizador de la sintaxis del Anexo G del plan: texto, frase exacta, `tipo:`, `en:`, `#`, `desde:` y `hasta:` (con `hoy` y `semana`), `estado:`, `nivel:`, `huella:`, `dominio:` y `-excluir`. Sin acentos ni mayúsculas en la comparación.
- [x] Pantalla Buscar: caja, sugerencias de filtros, resultados agrupados por tipo con resaltado y «coincide dentro del contenido».
- [x] Ranking: relevancia, más un empujón a lo fijado y a lo reciente.
- [x] Búsqueda desde el compositor con `?` (IN-015).
- [x] Contador de búsquedas con resultado abierto (IN-016).

## Pruebas previstas

- El analizador con 50 consultas (cada filtro, combinaciones, comillas, guiones, acentos, fechas relativas, filtros desconocidos).
- Índice: campos, difuso y prefijo como F0-8, «coincide dentro», exportar y cargar (y descartar uno de otra versión), poner y quitar.
- Motor: indexar al abrir, reindexar solo lo cambiado, quitar lo borrado o en la papelera, persistir, filtros, frases, exclusiones y ranking.
- Rendimiento: búsqueda < 50 ms en 10.000 elementos.
- Pantalla: caja, píldoras, grupos, resaltado, «coincide dentro», facetas, sin resultados, la consulta en la dirección; Inicio con `?`; el contador.

## Criterios de aceptación

- El analizador pasa las 50 consultas y la búsqueda tarda menos de 50 ms en 10.000 elementos. `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Frases exactas sin guardar el texto en el índice | Se buscan sus palabras en el índice y se comprueban leyendo los mejores candidatos: el índice no duplica 4 KB por elemento en memoria. |
| Indexar desde cero un espacio grande | En segundo plano, con progreso; los derivados que falten se calculan con prioridad de fondo y quedan en su caché. |
| Qué se busca | Los elementos (no las comparaciones ni los hilos, que se abren desde sus fuentes): lo que pide BUS-01. |
| Dos pestañas | Solo la que escribe guarda el índice; la otra lo mantiene en memoria a partir del guardado. |

## Autorrevisión

Cubre las seis tareas y las dos pruebas del plan. Aplica F0-8 tal cual (campos, opciones, Worker, gzip, no esperar al índice) y lo aprendido: la organización no toca `modificado` (la clave del índice usa `modificado` y `hash`, así que tampoco hace falta reindexar por mover una colección: el filtro va sobre el frontmatter de ahora).

## Implementación

- `src/busqueda/consulta.ts`: `analizarConsulta` (Anexo G: palabras, frases, `tipo:` con nombres, alias, plurales y los nombres en cada idioma, `en:`, `#`, `desde:`/`hasta:` con `hoy`, `ayer` y `semana`, `estado:`, `nivel:`, `huella:`, `dominio:` y `-excluir`; también las claves en inglés) y `coincideFiltros` sobre el frontmatter.
- `src/busqueda/contrato.ts`: lo común sin MiniSearch (documentos, aciertos, `ApiIndice`, `claveIndice`, `normalizarBusqueda`), para que la carga inicial no lleve el índice.
- `src/busqueda/indice.ts`: `IndiceBusqueda` sobre MiniSearch con los campos y opciones de F0-8; `buscar(palabras, sin)` excluye las palabras sueltas en la misma pasada (`AND_NOT`); `conPalabras` sin difuso ni prefijo; `exportar` y `cargar` (por partes, con versión). `src/workers/busqueda.worker.ts` y `src/busqueda/cliente.ts` (Worker con respaldo en el hilo, cargado en diferido).
- `src/busqueda/motor.ts`: `MotorBusqueda` (carga del guardado, sincronización por tandas con progreso y lo más reciente primero, quitar lo borrado o en la papelera, guardado comprimido agrupado y solo en la pestaña que escribe, búsqueda con filtros, palabras, frases comprobadas en los 200 mejores, exclusiones, ranking y facetas sobre todos los que cumplen).
- `src/busqueda/Busqueda.tsx`: `ProveedorBusqueda` (en `App` y en `pruebas/app.tsx`), `useBuscar` (gana la última consulta; se repite tras cada cambio y al acabar de indexar), `useEstadoBusqueda` y `useContarAbierto`. `resaltar.ts` y `Resaltado.tsx`.
- `src/rutas/buscar/Buscar.tsx`: la pantalla; `FilaElemento` acepta título y resumen pintados. `MensajeBusqueda` usa el motor (la búsqueda en memoria queda de respaldo).
- Pruebas: `consulta.test.ts` (50 consultas y los filtros), `indice.test.ts`, `motor.test.ts` (también el rendimiento con 10.000 elementos), `resaltar.test.ts` y `rutas/buscar/Buscar.test.tsx` (pantalla e Inicio con el contador).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El rendimiento se mide en el caso realista de F0-8 (vocabulario de 20.000 palabras con frecuencias de Zipf), en caliente y con la mediana de 5 | Es el criterio que fijó F0-8; en el caso pesimista (todo casa con todo) MiniSearch pasa de 50 ms, como ya midió F0-8. |
| La clave del índice suma título, ref y etiquetas a `modificado`, `hash` y el lector | Un cambio de título o etiquetas que no tocara `modificado` dejaría el índice desfasado; mover de colección sigue sin reindexar. |
| Las palabras excluidas van en la misma pasada del índice (`AND_NOT`); las frases excluidas se comprueban leyendo | Una sola pasada: «error -staging» cabía justo en los 50 ms con dos. |
| Las facetas cuentan todos los que cumplen la consulta, no solo los 50 devueltos | Una faceta debe decir cuántos quedarían al añadirla. |
| Cada visita a Buscar es otra búsqueda para el contador; en Inicio, cada mensaje cuenta una vez | Es lo más cercano a «una búsqueda con resultado abierto». |
| Filtros rápidos: tipo más frecuente, colección y etiqueta más usadas, segundo tipo y excluir la segunda etiqueta | Las cinco píldoras de la referencia, sacadas de lo que hay. |

