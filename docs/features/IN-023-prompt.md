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
- 0,85: `CLAUDE.md` / `AGENTS.md` reconocible.
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

- [ ] Detecta imperativo dirigido a un modelo, variables `{{x}}`, `{x}` y `<x>`, bloques de rol, `CLAUDE.md`, skills y definiciones de agentes.
- [ ] Deriva variables, tokens aproximados (4 caracteres por token, documentado), secciones y destino si se menciona.
- [ ] Copiar con valores: una caja por variable, valores recordados por prompt, portapapeles con alternativa de seleccionar; suma un contador.
- [ ] Resultados: respuesta pegada, valoración 1–5 y nota en `historial/REF/resultado-fecha.md`.
- [ ] Respuesta: «Prompt con 3 variables. Lo puedes copiar con valores.»

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

## Autorrevisión

Cubre las cinco tareas y las dos pruebas de la ficha (sustitución con llaves; skill y `CLAUDE.md` del corpus). Versiones, diff y «qué versión tuvo mejores valoraciones» son de IN-029 (CMP-02); la media de valoraciones de la vista es la de todos los resultados del prompt. Con lo aprendido en IN-021 e IN-022, la detección exige señales de modelo y longitud, y las pruebas recorren los corpus de los demás tipos con el detector real.
