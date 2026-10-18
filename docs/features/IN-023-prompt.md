# IN-023 · Lector Prompt

## Objetivo y catálogo

Guardar los prompts que funcionan con sus variables, rellenarlas y copiarlos listos, y anotar qué tal salieron. Catálogo: **LEC-07** (plan §8.4). Depende de IN-017. Versiones y diff (CMP-02) son de IN-029; aquí solo se deja el sitio.

## Estado de partida

- El formato ya admite `resultados` en el frontmatter (Anexo B: `fecha`, `valoracion`, `nota`, `archivo: historial/PRM-0012/resultado-2026-10-17.md`) y `rutaHistorial` en `@rimor/formato`.
- Contadores de IN-016 (`contar(nombre)`), `actualizarElemento` con turnos del repositorio, `Almacen.escribir` atómico.
- Pantalla de referencia `SC.prompt`: tarjeta con el texto en `pre.code` (`white-space: pre-wrap`, fondo transparente, sin relleno, 12,5 px) con las variables resaltadas (`.var`); tarjeta «Copiar con valores» con una rejilla `g3` de etiquetas `{{x}}` sobre su caja y la fila [Copiar] + «Valoración media de esta versión: ★ 4,5 (2 usos)»; plegados «Cambios de la versión 1 a la 2» (IN-029) y «Resultados (3)» con `.gaps .gap.okk` (estrellas en negrita, fecha y versión en `xs muted`, nota en `sm`).

## Diseño

### `src/lectores/prompt/analisis.ts` (puro)

- `variablesDe(texto)`: `{{x}}`, `{x}` y `<x>` (identificadores `[A-Za-z_][\w.-]*`), en orden de aparición y sin repetir, con su sintaxis. `{x}` no cuenta dentro de JSON ni de bloques de código (```); `<x>` no cuenta si es una etiqueta HTML o XML conocida (`<div>`, `<br>`…) o si se cierra (`<ejemplo>…</ejemplo>` es una sección, no una variable).
- `sustituir(texto, valores)`: una sola pasada con una expresión que encuentra las tres sintaxis; un valor que contiene llaves (`{{otra}}`, `{json}`) se inserta tal cual y no se vuelve a sustituir. Variables sin valor se dejan como estaban.
- `tokensAprox(texto)`: `Math.ceil(caracteres / 4)` (heurística documentada: 4 caracteres por token en inglés; en español sale algo por debajo; se dice «aprox.»).
- `seccionesDe(texto)`: encabezados Markdown, bloques de rol (`system:`, `user:`, `assistant:`, `### Instrucciones`), etiquetas XML de sección (`<contexto>…</contexto>`) y listas numeradas de primer nivel.
- `destinoDe(texto)`: «Claude», «GPT», «Gemini», «Llama», «Mistral», «Copilot»… si se menciona (`Para Claude`, `You are ChatGPT`), o el de `CLAUDE.md` / `AGENTS.md` / skill.
- `formaDe(texto)`: `skill` (frontmatter con `name` y `description`), `agente` (frontmatter con `name`, `description` y `tools` o `model`, o «You are a … agent»), `claude-md` (encabezados típicos de `CLAUDE.md`/`AGENTS.md`: comandos, convenciones, «Antes de nada…»), `roles` o `libre`.

### Detección

- 0,9: skill o agente (frontmatter), o bloques de rol en dos o más líneas.
- 0,85: `CLAUDE.md` / `AGENTS.md` reconocible (0,9 desde la verificación de IN-024: por encima del margen de duda frente a un documento Markdown).
- 0,8: imperativo o segunda persona dirigido a un modelo («Actúa como…», «Eres un…», «You are…», «Responde…», «Dime…», «Analiza…», «Write…») **y** al menos una variable o una sección; texto de 60 caracteres o más.
- 0,7: solo el imperativo dirigido a un modelo (con «modelo», «IA», «asistente», «LLM», «respuesta» cerca o con instrucciones en lista) y 120 caracteres o más.
- 0 en lo demás: una idea corta o una nota no son prompts. Las pruebas cuidan que los corpus de texto, idea, log y error no cambien.

### El lector (`src/lectores/prompt/`)

- `leer`: título desde el `name` del frontmatter, el primer encabezado o la primera frase recortada; resumen `{ variables, tokens_aprox, destino?, forma }`.
- `derivar` → `{ variables, tokens, caracteres, lineas, secciones, destino, forma }`.
- **Respuesta**: «Prompt con 3 variables. Lo puedes copiar con valores.»; sin variables, «Prompt de unos 410 tokens.»; skill y agente, «Skill «nombre» con 3 variables…» con la misma segunda frase si hay variables.
- **Cifras**: `variables`, `tokens`.
- `textoIndexable`: nombres de variables, secciones y destino.

### Vista

Como la referencia:

1. Cabecera: «Para Claude» si hay destino (en el subtítulo de la pantalla de elemento, vía el texto de la tarjeta).
2. Tarjeta con el texto (`pre.code.prompt`) y las variables resaltadas (`span.var`, con el aspecto de la referencia).
3. Tarjeta «Copiar con valores» si hay variables: rejilla de 3 columnas (2 en pantallas estrechas) con una caja por variable, etiqueta con su sintaxis; [Copiar] y, si hay resultados, «Valoración media: ★ 4,5 (2 usos)».
   - **Valores recordados por prompt**: en `localStorage` con la clave `rimor:<espacio>:prompt:<id>` (son de este navegador, como un borrador; en `try/catch`, la página funciona sin él). No se guardan en el espacio: pueden ser datos de un caso concreto.
   - **Copiar**: `navigator.clipboard.writeText`; si falla o no existe, se enseña el texto ya sustituido en un área de solo lectura seleccionada, con «Selecciónalo y cópialo con Ctrl+C». Suma `copiasConValores` (contadores de IN-016) y avisa «Copiado».
4. Plegado «Resultados (N)»: lista con estrellas, fecha y nota; [Añadir resultado] abre un formulario (respuesta pegada, valoración 1–5 con botones de radio, nota). Al guardar: escribe `historial/REF/resultado-AAAA-MM-DD[-N].md` (frontmatter `ref`, `fecha`, `valoracion`, `nota` y la respuesta en el cuerpo) y añade la entrada a `resultados` del frontmatter con `actualizarElemento`. En la pestaña lectora no se ofrece.
5. Plegado «Detalles»: tokens aprox. (con «4 caracteres por token»), líneas, forma, secciones y cifras citables.

### Corpus

- `fixtures/prompts/`: prompts reales (con variables en las tres sintaxis, de roles, un `CLAUDE.md`, una skill y un agente) con lo esperado.
- `fixtures/deteccion/prompt/`: 25 para la matriz.

## Tareas

- [x] Detecta imperativo dirigido a un modelo, variables `{{x}}`, `{x}` y `<x>`, bloques de rol, `CLAUDE.md`, skills y definiciones de agentes.
- [x] Deriva variables, tokens aproximados (4 caracteres por token, documentado), secciones y destino si se menciona.
- [x] Copiar con valores: una caja por variable, valores recordados por prompt, portapapeles con alternativa de seleccionar; suma un contador.
- [x] Resultados: respuesta pegada, valoración 1–5 y nota en `historial/REF/resultado-fecha.md`.
- [x] Respuesta: «Prompt con 3 variables. Lo puedes copiar con valores.»

## Pruebas previstas

- Sustitución con valores que contienen llaves (`{{x}}`, `{y}`, `<z>`) sin sustituir dos veces; variables repetidas; sin valor.
- Skill, agente y `CLAUDE.md` del corpus detectados; JSON, HTML y código no dan variables falsas.
- Respuesta en es y en; reglas de estilo.
- Vista (happy-dom): variables resaltadas, copiar (portapapeles y alternativa), contador, valores recordados, añadir un resultado (archivo en `historial/` y entrada en el frontmatter).
- Matriz con la carpeta `prompt`; los demás corpus no cambian.

## Criterios de aceptación

- Las pruebas de arriba; `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `{x}` y `<x>` son ambiguos (JSON, HTML, plantillas) | Se excluyen dentro de código y JSON; `<x>` solo si no es una etiqueta conocida ni se cierra |
| Texto en imperativo que no es para un modelo (una receta, una lista de tareas) | Exige señales de modelo (segunda persona + rol, variables, secciones o palabras de IA) y una longitud mínima |
| Dónde recordar los valores | En el navegador (`localStorage`), no en el espacio: son de un caso concreto y pueden ser sensibles |
| Varios resultados el mismo día | Sufijo `-2`, `-3` en el archivo |
| Cómo reconocer un `CLAUDE.md` pegado sin su nombre | Por su título, su arranque o su lista de reglas (decidido en la verificación); soltado como archivo, por su nombre |

## Autorrevisión

Cubre las cinco tareas y las dos pruebas de la ficha (sustitución con llaves; skill y `CLAUDE.md` del corpus). Versiones, diff y «qué versión tuvo mejores valoraciones» son de IN-029 (CMP-02); la media de valoraciones de la vista es la de todos los resultados del prompt. Con lo aprendido en IN-021 e IN-022, la detección exige señales de modelo y longitud, y las pruebas recorren los corpus de los demás tipos con el detector real.

## Cambios durante la implementación

- El repositorio gana `guardarEnHistorial(base, texto)` (en turno por ruta, con sufijos `-2`, `-3`… sin pisar nada; solo bajo `historial/`) y `leerHistorial(ruta)`.
- El contador es `copiasConValores` (ya estaba en los contadores de IN-016); cuenta también cuando el navegador no deja copiar y se enseña el texto listo.
- El destino no se pinta en la tarjeta del texto (la referencia solo lleva el `pre`): va en el resumen legible («Para Claude») y en «Detalles».
- «Llama» solo cuenta como destino con su versión o con Meta (en español es un verbo); se quitan «Cursor» y los nombres sueltos de modelos de OpenAI que chocan con palabras corrientes.
- Las exclusiones (código y JSON) y las etiquetas que se cierran se calculan en una pasada lineal; la detección mira los primeros 20.000 caracteres.
- Los encabezados Markdown no cuentan como estructura de prompt al detectar (un documento también los tiene); sí las variables y las secciones XML.


## Verificación

**`pnpm verificar`** (2026-10-18 23:22): tipos 0 errores; Biome, colores y textos, OK; Vitest 53 archivos y 858 pruebas, OK; construcción OK; carga inicial 203,8 KB. **`pnpm deteccion`**: 100 % de 200 ejemplos (archivo, enlace, error, idea, log, mediciones, prompt y texto).

| Criterio | Evidencia |
|---|---|
| Detecta prompts, roles, `CLAUDE.md`, skills y agentes | `fixtures/prompts/` (12, con reglas de proyecto, la plantilla de AGENTS.md y un título Setext) y 25 de la matriz; 31 de 32 `CLAUDE.md`/`AGENTS.md` reales pegados como texto (todos, soltados como archivo) |
| No roba otros tipos | READMEs, documentos, ideas que nombran `CLAUDE.md`, datos de un sistema, código, Jinja, HTML, recetas, correos, listas de tareas, YAML; las trazas de Python ya no dan la duda; de 61 documentos reales, 2 son prompts (uno lo es de verdad) |
| Variables, tokens, secciones, destino | Tres sintaxis con letras de cualquier alfabeto; exclusiones de código, JSON y código en línea; 4 caracteres por token; secciones; destino solo si se nombra un modelo |
| Copiar con valores | Prueba de la vista: portapapeles, alternativa seleccionada (también al repetir), contador `copiasConValores`, valores recordados por prompt |
| Resultados en `historial/REF/resultado-fecha.md` | Prueba del repositorio (sufijos, carreras, fuera de `historial/`, pestaña lectora) y de la vista (archivo, frontmatter, lista al momento, sin huérfanos si falla) |
| Respuesta | «Prompt con 3 variables. Lo puedes copiar con valores.» en es y en; skill, agente, `CLAUDE.md` y sin variables; reglas de estilo |
| Sustitución con llaves | Valores con `{{}}`, `{}`, `<>`, `$&` y `$1`, sin sustituir dos veces |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Retroceso cúbico en los encabezados** (`# a` + miles de espacios colgaba la detección): el encabezado se lee a mano, sin expresión.
2. **READMEs, documentos e ideas tomados por `CLAUDE.md`**: cuenta el nombre del archivo, un primer título que lo dice (`# CLAUDE.md`, `Repository Guidelines`, «instrucciones para Claude Code», ATX o Setext), un párrafo de arranque dirigido al agente, la plantilla de Claude Code o una lista de reglas (3 viñetas o más y el 60 % con «nunca», «siempre», «antes de»…); nombrarlo en una frase no basta. El destino es Claude solo si lo nombra.
3. **Falsos positivos**: roles solo con contenido (cuatro palabras o más en dos roles); sin verbos que abren líneas de código; código, trazas, XML, Jinja y documentos con varios encabezados fuera; HTML completo y teclas, genéricos y marcadores de traza (`<module>`) no son variables; YAML de varios documentos no es una skill.
4. **Trazas de Python con la duda «¿Error o Prompt?»**: `<module>` ya no es variable y las trazas no son prompts.
5. **Prompts que no se reconocían**: papel en la primera línea («You are a…», «You will be given…», «Vas a actuar como…») a 0,8; instrucciones contadas por frases («Te paso… Quiero que…»); «You are a … agent» es un agente; `CLAUDE.md` por su nombre de archivo; variables con letras no ASCII.
6. **Archivo huérfano si fallaba la segunda escritura**: se borra (`borrarDeHistorial`) y el formulario sigue abierto.
7. **Costes cuadráticos**: tramos excluidos por bisección, sin `\s*` con la bandera `m`, detección sobre los primeros 20.000 caracteres (y la forma, con la misma muestra al detectar y al derivar).
8. **Exclusiones incompletas**: `~~~`, bloques sin cerrar hasta el final, código en línea (también para `{{x}}`) y listas de objetos JSON en una línea; `{{{x}}}` de Handlebars no se sustituye.
9. **Destino**: ni «Claude Shannon» ni «gpt-partition-table».
10. **Una skill con `model` era un agente**: agente solo con `tools`.
11. **Listas numeradas de primer nivel** como secciones (lo prometía el diseño).
12. **Vista**: la lista y la media se ponen al día al guardar sin esperar al elemento releído; la alternativa de copia se vuelve a seleccionar en cada intento; claves sin repetir.
13. **Textos**: una forma desconocida se lee como «Prompt»; el `name` de una skill se recorta en la respuesta.

Sin cambiar: una plantilla de correo con `{nombre}` y una instrucción («Responde a este correo…») se toma por prompt; un README que documenta plantillas con varias `{{variables}}` también (0,8). Un `CLAUDE.md` que es solo memoria del proyecto, sin reglas ni título que lo diga, pegado como texto, va a Texto (soltado como archivo, se reconoce).
