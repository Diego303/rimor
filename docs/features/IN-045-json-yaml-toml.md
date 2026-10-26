# IN-045 · JSON, YAML y TOML con comparación estructural

## Objetivo y catálogo

Que una configuración o un documento de datos pegado o soltado en JSON, YAML o TOML se entienda y se compare por su estructura y no por su texto: un árbol plegable con la ruta al valor elegido, el esquema inferido y la respuesta «TOML con 34 claves.». Si es la versión nueva de una que ya estaba: «Frente a la versión del 9 oct cambian 2: `stream_timeout_ms` y `client`.». Y la **comparación estructural** de dos (claves añadidas, quitadas y cambiadas) como elemento Comparación. Catálogo: **LEC-12** y **CMP-03** (plan §8.7). Depende de IN-028 (comparaciones).

## Estado de partida

- El tipo `json` (prefijo `JSN`, icono «llaves», clase `k-cod`) existe en `@rimor/formato` y en los iconos; `ORDEN_DETECCION` reserva el puesto 7 («se analiza sin errores»). No hay lector: hoy un JSON pegado es Código o Texto.
- La referencia dibuja la tarjeta del feed (`JSN-0006`: «config.gateway.toml (staging)», resumen «TOML · 34 claves») y su respuesta «TOML con 34 claves. Frente a la versión del 9 oct cambian 2: `stream_timeout_ms` y `client`.» con «Ver cambios» (comparación estructural). No dibuja la pantalla del elemento: se compone con sus piezas (tarjetas, `kv`, plegables, tablas, `pre` en mono).
- Versiones (IN-029): `TIPOS_CON_VERSIONES` (prompt, markdown, codigo) decide qué tipos guardan versiones al capturar; el mensaje del feed es genérico («Lo he guardado como su versión 2.») y la pantalla da a la vista la versión anterior (`ContextoVersion`).
- Comparaciones (CMP-01, IN-044): clases `logs`, `mediciones` y `datos`, cada una con su cálculo puro, su resultado guardado y su vista.
- `yaml` 2.9.1 ya va en la carga inicial (frontmatter de `@rimor/formato`). No hay analizador de TOML.

## Diseño

### Analizar (`src/lectores/json/analisis.ts`, TS puro)

- `analizar(texto, pista?)` → `{ formato: 'json' | 'yaml' | 'toml', valor }` o `null`. JSON con `JSON.parse` (empieza por `{` o `[`); TOML con `smol-toml` 1.9.1 (nueva dependencia, exacta; las fechas TOML pasan a texto ISO); YAML con `yaml` (varios documentos separados por `---` se aceptan como una lista; las fechas y lo que no es JSON, a texto). `pista` es la extensión del archivo (`.json`, `.yaml`, `.yml`, `.toml`) cuando se suelta.
- **Qué cuenta como YAML o TOML** (casi cualquier texto es un YAML válido: un escalar, una lista de Markdown): solo una **mapa** (o una lista de mapas) con al menos 2 claves; claves con forma de identificador (sin espacios, la gran mayoría); valores que no son prosa (si la mitad de los textos tiene 5 palabras o más, es un prompt o una nota, no una configuración). TOML, además, con al menos 2 pares `clave = valor` o una tabla `[seccion]`.
- Confianza: JSON 0,97 (como la referencia); TOML 0,92 con tabla y 0,85 sin ella; YAML 0,85, y 0,9 con varios niveles o un `---` inicial de documento. Por debajo de un log (puesto 5) y de las mediciones (puesto 6), que tienen su propio JSON (hyperfine): esos los reconoce su lector con más confianza o con el mismo orden.
- `contarClaves(valor)`: las claves de todos los mapas, a cualquier profundidad (la referencia: «34 claves»); `profundidad`; las claves de primer nivel.
- `esquemaDe(valor)`: por ruta (`gateway.client`, `servers[].host`), sus tipos (`objeto`, `lista`, `texto`, `número`, `sí o no`, `nulo`), cuántas veces aparece y, en las listas, cuántos elementos; las listas de objetos se funden en una ruta `[]`.
- `rutaDe(segmentos)`: `gateway.stream_timeout_ms`, `servers[0].host`, `["clave con espacios"]`.
- `compararValores(a, b)` → `{ anadidas, quitadas, cambiadas: [{ ruta, antes, despues }] }` por ruta: mapas por clave; listas por posición (una lista de mapas con `id`, `name` o `nombre` se empareja por esa clave). Un cambio de tipo es un cambio.

### El lector `json`

- Puesto 7; `detectar` con la confianza de arriba (síncrona y barata: lo que mira son los primeros 200 KB). `leer`: título el nombre del archivo o «TOML · gateway» (formato y las primeras claves de primer nivel), y el resumen `{ formato, claves }`.
- `derivar` (en el Worker): `{ formato, claves, primerNivel, profundidad, esquema, valor }` (el valor ya normalizado a JSON). Con `senal: 'leyendo-datos'` (la señal aparece si tarda más de 400 ms).
- Respuesta: «TOML con 34 claves.» (una lista: «JSON con una lista de 12 elementos.»). `respuestaVersion(actual, anterior, idioma)`, nuevo en el contrato y opcional: la usa el mensaje de versión del feed, «TOML con 34 claves. Frente a la versión del 9 oct cambian 2: `stream_timeout_ms` y `client`.» (las rutas sin el prefijo que comparten todas, en mono; más de tres, «y N más»), o «… no cambia ninguna clave.».
- `json` entra en `TIPOS_CON_VERSIONES`: pegar otra vez `config.gateway.toml` con un valor cambiado la guarda como versión.
- Cifras: `claves` y `profundidad`.

### La vista

- Tarjeta «Árbol»: el valor como lista anidada en mono (como `.tree`): mapas y listas plegables (abierto el primer nivel; hijos pintados solo al abrir; listas de más de 100, «Mostrar 100 más»); cada clave es un botón que la elige y su valor va con el color de su tipo. Debajo, «Ruta» con la ruta elegida y «Copiar».
- Plegable «Esquema inferido»: tabla de ruta y tipo (con el recuento en las listas).
- Plegable «Cambios frente a la versión N» si la pantalla da la versión anterior (`ContextoVersion`): la misma tabla que la comparación.
- «Comparar con otra configuración» (como en Datos) y `DetallesElemento`.

### Comparación estructural (CMP-03)

- Clase `json` en `comparaciones/clases.ts` (lector `json`); `comparaciones/json.ts` compara los dos `valor` derivados; su resultado guardado: `anadidas`, `quitadas`, `cambiadas` (números, validados al leer).
- `rutas/comparacion/VistaJson.tsx`: el veredicto («3 claves cambian» · añadidas y quitadas; `ok` si nada cambia) y la tabla Ruta · Antes · Después (añadidas y quitadas con «—»), en el orden del documento.

## Tareas

- [x] Analizadores de los tres formatos (con `leyendo-datos` si tarda más de 400 ms).
- [x] Árbol plegable.
- [x] Esquema inferido.
- [x] Ruta al valor.
- [x] Comparación estructural (claves añadidas, quitadas y cambiadas) como elemento Comparación.
- [x] Versión anterior detectada al pegar («Frente a la versión del 9 oct cambian 2 claves»).

## Pruebas previstas

- Análisis: JSON, YAML (con varios documentos, anclas, fechas) y TOML (tablas, listas de tablas, fechas); no son configuración: prosa, una lista de Markdown, un escalar, un prompt con `Rol:` y `Tarea:`, un log, un CSV, código, un `.env` sin comillas. Corpus `fixtures/deteccion/json/` (25) y que los demás tipos no bajen del 90 %.
- `contarClaves`, `esquemaDe`, `rutaDe` y `compararValores` (mapas, listas por posición y por `id`, cambio de tipo).
- Respuesta y respuesta de versión, es y en, reglas de estilo.
- Vista: árbol (plegar, elegir, ruta y copiar), esquema, cambios frente a la versión anterior.
- Comparación: cálculo, resultado guardado validado, vista con veredicto y tabla; creación desde la vista.
- Captura: pegar dos veces una configuración con un cambio la guarda como versión y el mensaje lo dice.

## Criterios de aceptación

- `pnpm verificar` en verde; un JSON, un YAML y un TOML pegados o soltados se guardan con el lector `json` con su árbol, su esquema y su respuesta; pegar la versión nueva lo dice con las claves que cambian; dos se comparan como elemento Comparación.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Casi todo texto es YAML válido | Solo mapas (o listas de mapas) con claves de identificador y valores que no son prosa, con confianza por debajo de los lectores con señales propias. El corpus de todos los tipos lo vigila. |
| Peso en la carga inicial | `yaml` ya está; `smol-toml` solo analiza (unos KB). La vista (árbol, esquema) va en su trozo diferido. Se mide con `pnpm tamano`. |
| Archivos enormes | Lo de más de 2 MB va como adjunto (como todo texto) y se analiza en el Worker; el árbol pinta los hijos al abrir y las listas de 100 en 100. |
| Listas que cambian de orden | Por posición, salvo las de mapas con `id`, `name` o `nombre`, que se emparejan por ella. |
| El mensaje de versión necesita la anterior | El feed lee la copia del historial (`versiones` del repositorio) y llama a `respuestaVersion` del lector; sin ella, el mensaje genérico. |

## Autorrevisión

Cubre las seis tareas. Reutiliza el contrato de lectores, las versiones de IN-029 (`TIPOS_CON_VERSIONES`, `ContextoVersion`), las comparaciones (la clase como `datos`), los plegables, las tablas y la `Senal`. Lo nuevo del contrato (`respuestaVersion`) es opcional y lo usa solo el mensaje de versión.

## Implementación

- Dependencias (exactas, publicadas hace más de dos semanas): `smol-toml` 1.9.1 y `yaml` 2.9.1 (ya estaba por `@rimor/formato`; ahora también directa).
- `src/lectores/json/`: `formas.ts` (lo ligero, en la carga inicial: tipos, `normalizar`, `contarClaves`, `pareceConfiguracion`, JSON y YAML, la forma de un TOML sin analizarlo y `confianzaJson`), `analisis.ts` (diferido: `analizar` con `smol-toml`, `esquemaDe`, `rutaDe`, `compararValores`, `rutasCortas`), `lector.ts` (`lectorJson`, puesto 7, `senal: 'leyendo-datos'`, `respuestaVersion`), `textos.ts`, `Vista.tsx` (árbol, ruta con «Copiar», esquema, cambios frente a la versión anterior, original ilegible), `TablaCambios.tsx`, `valores.ts` y `Tarjeta.tsx`.
- Contrato: `Lector.respuestaVersion` (opcional, asíncrona); `MensajeVersion` la usa con la copia del historial.
- Versiones: `json` en `TIPOS_CON_VERSIONES`.
- Comparaciones: la clase `json` (`comparaciones/json.ts`, `resultadoDeJson` validado al leer y sus cifras) y `rutas/comparacion/VistaJson.tsx`; «Comparar con otra configuración» en la vista.
- Mediciones: el JSON de hyperfine sube de 0,9 a 0,97 para ganar al JSON genérico (0,95).
- Pruebas: `json/json.test.ts` (análisis, forma de configuración, confianza, esquema, rutas, comparación, títulos, respuestas y respuesta de versión), `json/Vista.test.tsx` (árbol, tandas de 100, esquema, cambios de versión, ilegible, veredicto y la captura de una versión con su mensaje), `comparaciones/json.test.ts`. Corpus `fixtures/deteccion/json/` (25: JSON, YAML y TOML de configuraciones reales); el corpus entero, al 100 %.

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| La detección no usa `smol-toml`: mira la forma de las líneas del TOML (`formaToml`) | El detector es síncrono y va en la carga inicial; `smol-toml` añadía 5,5 KB. Al leer y derivar, el análisis completo decide (si no se puede, el elemento queda «ilegible» con su original a la vista). La carga inicial queda en 263,9 KB (+4,1). |
| `respuestaVersion` es asíncrona | Para cargar el análisis bajo demanda; el mensaje del feed ya la esperaba en una promesa. |
| Al derivar, el análisis no pide forma de configuración (`estricto: false`) | Lo ya guardado como configuración, o pedido con `/json`, se lee aunque sea una lista o un valor suelto; lo que no se analiza de ninguna forma queda «ilegible» en vez de romper la vista. |
| Las listas de mapas con `id`, `name`, `nombre` o `key` se emparejan por esa clave, y la ruta lo dice (`servers[name="b"].ip`) | Por posición, quitar el primer servidor cambiaría todos los demás; con la clave, la posición puede ser otra en cada lado. |
| El título sin nombre de archivo es su `name` («rimor · JSON») o el formato y sus primeras claves («TOML · gateway, servers») | Así la versión nueva tiene el mismo título y se reconoce como versión; dos `package.json` distintos tienen nombres distintos. |
| Las fusiones de YAML (`<<: *base`) se resuelven | Son habituales en configuraciones (CI, docker-compose). |

## Verificación

**`pnpm verificar`**: en verde, 117 archivos y 1500 pruebas, más la de rendimiento aparte; carga inicial 265,1 KB de 300 (+5,3 KB por el lector entero; el análisis completo y `smol-toml` van diferidos).

**Criterios de aceptación:** un JSON, un YAML y un TOML pegados o soltados se guardan con el lector `json`, con su árbol, su esquema y su respuesta (`json.test.ts`, `Vista.test.tsx`; corpus al 100 % en todos los tipos); pegar la versión nueva lo dice con las claves que cambian (`Vista.test.tsx`, captura de una versión con su mensaje); dos se comparan como elemento Comparación (`comparaciones/json.test.ts`).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Analizadores de los tres formatos, con `leyendo-datos` | `json.test.ts` (formatos, fusiones y etiquetas de YAML, JSONC, enteros grandes, fechas), `Lectores.test.tsx` (señal del lector) |
| Árbol plegable | `Vista.test.tsx` (plegar, abrir, tandas de 100, hojas recortadas) |
| Esquema inferido | `json.test.ts`, `Vista.test.tsx` (tabla y aviso de recorte) |
| Ruta al valor | `json.test.ts` (`rutaDe`), `Vista.test.tsx` (elegir y copiar) |
| Comparación estructural como elemento Comparación | `comparaciones/json.test.ts` (cálculo, resultado validado, ilegibles), `Vista.test.tsx` (veredicto) |
| Versión anterior detectada al pegar | `Vista.test.tsx` (mensaje del feed), `json.test.ts` (respuesta de versión; dos workflows «CI» distintos no son versiones) |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | Un log de más de 200 KB que empezaba por `[` (o un JSON por línea) se tomaba por JSON y `leer` lo analizaba entero en el hilo principal (13,7 s con 3 MB) | Por encima del límite se comprueba que su principio sea un único JSON (`principioDeJson`); `leer` no analiza lo grande (las claves llegan al derivar). `json.test.ts` |
| 2 | YAML cuadrático con miles de claves y análisis doble en el hilo principal | `uniqueKeys: false`, detección sobre 64 KB y `leer` como arriba. `json.test.ts` |
| 3 | Notas «Clave: valor» (días, cabeceras de correo, prompts con valores cortos, logs `user_1: …`) pasaban por YAML | Un YAML plano pide 3 claves, sin claves de prompt ni palabras con mayúscula, y valores de menos de 3 palabras. `json.test.ts` |
| 4 | Títulos generados iguales en configuraciones distintas («CI · YAML») las hacían versiones (umbral 0,2) | `Lector.tituloGenerico`: con un título generado hace falta parecerse mucho. `json.test.ts` |
| 5 | Comparar ilegibles daba «iguales» | `comparacion.ilegible`, con su motivo. `comparaciones/json.test.ts` |
| 6 | `leer` estricto no coincidía con la detección de TOML (resumen vacío) | `leer` en modo tolerante. `json.test.ts` |
| 7 | Un TOML inválido acababa como «YAML con un valor suelto»; enteros grandes rechazados | Con forma de TOML, TOML o ilegible (con formato `toml`); `integersAsBigInt: 'asNeeded'`. `json.test.ts` |
| 8 | «Cambios frente a la versión» en modo estricto | Tolerante, como al derivar. `Vista.test.tsx` |
| 9 | El aviso de esquema recortado no salía nunca | La raíz no cuenta. `json.test.ts`, `Vista.test.tsx` |
| 10 | «1 añadidas» | Plurales por cifra. `Vista.test.tsx` |
| 11 | Horas y fechas de TOML con `.000` | Sin la fracción que no tenían. `json.test.ts` |
| 12 | Etiquetas de YAML (`!Ref`) perdidas | Se conservan en el valor. `json.test.ts` |
| 13 | JSONC no se reconocía ni con nombre `.json` | Con la pista del nombre, sin comentarios ni comas finales. `json.test.ts` |
| 14 | Árbol: todo se repintaba al elegir; hijos recorridos enteros; hojas enormes en el DOM | Nodos memorizados (solo se repintan los afectados), hijos por tandas sin recorrer el resto y hojas de 200 caracteres. `Vista.test.tsx` |
| 15 | La vista previa del feed solo enseñaba `[gateway]`; «Ver cambios» llevaba a un plegable cerrado al final | La vista previa une las líneas tras una que solo abre algo (como `JSN-0006`); los cambios de versión, primero y abiertos. `Mensaje.test.ts`, `Vista.test.tsx` |
| 16 | `rutasCortas` dejaba `[0]` y `[1]`; las marcas de ruta eran textos que chocaban con claves | Al menos una clave con nombre; las marcas son objetos (`{ elementos }`, `{ clave, valor }`). `json.test.ts` |
| 17 | Enteros de JSON más allá de 2^53 redondeados | Se guardan como texto con el original (`JSON.parse` con la fuente, donde el navegador la da). `json.test.ts` |

### Decisiones de la verificación

| Decisión | Por qué |
|---|---|
| El texto del motivo `sinComparacion` dice todos los tipos que se comparan | Decía «solo logs y mediciones» desde IN-028; ya son logs, mediciones, datos y configuraciones. |
| Los enteros grandes de JSON se conservan solo donde el navegador da la fuente al analizar | Es la API estándar (`JSON.parse` con contexto); donde no está, se queda el número redondeado, como hasta ahora. |
