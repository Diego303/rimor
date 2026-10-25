# IN-042 · Diff y parche

## Objetivo y catálogo

Que un diff pegado (de `git diff`, `git format-patch` o un diff unificado) se entienda como tal: qué archivos toca, cuántas líneas añade y quita cada uno, y verlo lado a lado. Catálogo: **LEC-09b** (plan §8.9, Anexo D puesto 10). Depende de IN-025 (Código).

## Estado de partida

- `TIPOS_ELEMENTO` no tiene un tipo propio para el diff: es **código** (`COD-`), como en la tabla de tipos de la referencia. El lector Código (IN-025) lo detecta hoy como código sin lenguaje claro.
- `ORDEN_DETECCION` ya reserva el puesto 10 para `diff`, antes de Prompt, Markdown y Código.
- Varias piezas eligen el lector de un tipo con «el primero del registro con ese tipo» (`flujo.lectorPara` con `/codigo`, `detector.lectorDe`, `registro.paraElemento` de reserva): con dos lectores de código, `/codigo` iría al de diff.
- El diálogo «Cambiar tipo» y la vista previa del compositor nombran el lector por su tipo («Código»): dos opciones iguales.
- Las versiones (CMP-02) buscan el anterior entre los del mismo **tipo**: un parche podría quedar como versión de un código.
- La referencia trae el estilo `.diff` (líneas `.a` añadidas en verde, `.r` quitadas en rojo tachadas, `.s` iguales) para los cambios de versión.

## Diseño

### El lector `diff` (tipo `codigo`)

- **Detecta** (TS puro, `analisis.ts`): la primera línea con contenido es `diff --git`, `From <hash>` (format-patch), `Index:`, `--- ` o `@@`, y al menos el 60 % de las líneas siguen la gramática de un diff (cabeceras, `@@ -a,b +c,d @@`, líneas con ` `, `+`, `-` o `\ No newline`). Confianza 0,95 con `diff --git` o `---`/`+++` y trozos; 0,8 con solo trozos `@@`.
- **Analiza** cada archivo: ruta (y la anterior si se renombró), estado (`modificado`, `nuevo`, `borrado`, `renombrado`, `binario`), sus trozos con sus líneas numeradas (antes y después) y las añadidas y quitadas; el total; y el asunto del parche si viene de `format-patch` (`Subject: [PATCH] …`).
- **Título:** el asunto del parche; si no, «Cambios en `src/x.ts`» (un archivo) o «Parche de 4 archivos».
- **Resumen:** `{ archivos, anadidas, quitadas }`; legible «4 archivos · +120 −37».
- **Respuesta:** «Parche de 4 archivos: +120 −37.» («de 1 archivo»); si es binario, lo dice.
- **Cifras citables:** `archivos`, `anadidas`, `quitadas`.
- **Indexable:** las rutas y el asunto.

### La vista

- Arriba, las cifras (`stats`: archivos, `+` añadidas en `--ok`, `−` quitadas en `--bad`).
- Una tarjeta por archivo con su ruta (en mono), su estado y `+N −M`; dentro, **lado a lado**: a la izquierda la versión anterior y a la derecha la nueva, con los números de línea, las quitadas `.r`, las añadidas `.a` y las iguales `.s` (el estilo `.diff` de la referencia), alineadas por filas. Por debajo de 720 px, una columna (el diff unificado).
- Los archivos grandes enseñan sus primeras 400 líneas y «Ver todo (N líneas)»; con más de 20 archivos, los primeros 20 abiertos y el resto plegados.
- «Detalles» con las cifras citables; «Ver original» de siempre.

### Lo que cambia fuera del lector

- **El lector de un tipo:** `Registro.deTipo(tipo)` da el lector cuyo nombre es el tipo (`codigo`) y, si no hay, el primero de ese tipo. Lo usan la captura (`/codigo`), el detector y el elemento cuyo lector ya no existe.
- **Nombre del lector:** `Lector.etiqueta?(idioma)` («Diff o parche»); el diálogo «Cambiar tipo» y la vista previa del compositor lo usan cuando lo hay.
- **La duda del detector** entre dos candidatos del mismo tipo no es duda: la alternativa es el primero de **otro** tipo.
- **Versiones:** el anterior se busca entre los del mismo tipo **y** del mismo lector (el que lo leería hoy). Los parches no guardan versiones (`Lector.sinVersiones`): un parche nuevo es otro parche, y sus títulos se repiten. (Cambiado en la verificación.)

## Tareas

- [x] Detecta `diff --git` y `@@`.
- [x] Deriva los archivos afectados y las líneas añadidas y quitadas por archivo.
- [x] Vista lado a lado con resaltado.
- [x] Respuesta «Parche de 4 archivos: +120 −37.».

## Pruebas previstas

- `analisis`: `git diff` (modificado, nuevo, borrado, renombrado, binario), `format-patch` con asunto, diff unificado sin `git`, solo trozos, `\ No newline at end of file`, números de línea; lo que no es diff (un Markdown con un bloque de diff, código con `+`/`-`, una lista con guiones) no puntúa.
- Detección: los fixtures van a `diff` y no a Código; el corpus de IN-013 sigue ≥ 90 %.
- Registro: `/codigo` captura con el lector Código aunque el de diff vaya antes; la duda no ofrece «Código» frente a «Código».
- Respuesta y sus reglas de estilo, en es y en; cifras.
- Vista: cifras, tarjetas por archivo, filas alineadas lado a lado con sus números, «Ver todo».
- Versiones: un parche no es versión de un código.

## Criterios de aceptación

- `pnpm verificar` en verde; un diff pegado se guarda con el lector `diff`, su respuesta y su vista lado a lado.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| No hay tipo «diff» en el formato | Es código (`COD-`), con su propio lector, como dice la tabla de tipos; no se toca `@rimor/formato`. |
| Un Markdown que trae un diff en un bloque | La primera línea tiene que ser de diff y la mayoría de líneas también: va a Markdown. |
| Parches enormes | El análisis es lineal; la vista pinta 400 líneas por archivo y 20 archivos abiertos. |
| Lado a lado en pantallas estrechas | Una columna por debajo de 720 px. |
| ¿Resaltado de sintaxis? | El resaltado es el de añadido, quitado e igual (el de la referencia); el de sintaxis por lenguaje queda fuera (sería cargar Lezer por cada archivo). |

## Autorrevisión

Cubre las cuatro tareas. Reutiliza el contrato de lectores, el estilo `.diff` de la referencia, `stats`, `DetallesElemento` y las cifras citables; arregla de paso cómo se elige el lector de un tipo, que con dos lectores de código fallaría.

## Implementación

- `src/lectores/diff/`: `analisis.ts` (`puntuarDiff`, `analizarDiff`, `filasLadoALado`), `lector.ts` (`lectorDiff`, de tipo `codigo`, con su etiqueta «Diff o parche»), `textos.ts`, `Vista.tsx` (cifras, una tarjeta por archivo, lado a lado; 400 filas y 20 archivos abiertos) y `Tarjeta.tsx`; registrado en el puesto 10.
- `Registro.deTipo` (el lector que se llama como el tipo y, si no, el primero de ese tipo): lo usan la captura, el detector y `paraElemento`.
- `Lector.etiqueta`: el diálogo «Cambiar tipo» y el chip de la vista previa del compositor la usan.
- El detector duda entre el primero y el primero de **otro** tipo.
- `anteriorDe` (versiones) busca entre los del mismo tipo y del mismo lector.
- CSS: `.diff-lado` (dos columnas con el estilo `.diff` de la referencia y una por debajo de 720 px).
- Pruebas: `diff/diff.test.ts` (análisis de `git diff`, `format-patch` y unificado, filas lado a lado, títulos, detección y lo que no es diff, `/codigo` y `deTipo`, respuesta y estilo, cifras, versiones) y `diff/Vista.test.tsx` (cifras, tarjetas, filas con sus números, «Ver todo»). Los tres fixtures, también en el corpus de detección (`fixtures/deteccion/codigo/`).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Los trozos se leen por sus cuentas (`@@ -a,b +c,d @@`) | Así la firma `-- ` de un `format-patch` o una línea de texto después del diff no se cuentan como quitadas. |
| «Ver todo» cuenta líneas, no filas | Las cabeceras de los trozos son filas de la vista, no líneas del parche. |

## Verificación

**`pnpm verificar`**: en verde, 107 archivos y 1394 pruebas; carga inicial 252,6 KB de 300.

**Criterios de aceptación:** un diff pegado (o soltado como `.patch`/`.diff`) se guarda con el lector `diff`, su respuesta y su vista lado a lado (`diff.test.ts`, `Vista.test.tsx`).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Detecta `diff --git` y `@@` | `diff.test.ts` (git diff, format-patch, unificado, git show, `diff -ruN`, Mercurial, bloque ```` ```diff ````, binarios, modos; lo que no es diff) y el corpus de detección |
| Archivos afectados y líneas por archivo | `diff.test.ts` (estados, cuentas, rutas entrecomilladas, sin prefijo, Subversion, series) |
| Vista lado a lado con resaltado | `Vista.test.tsx` (filas con sus números, unificado en estrecho, plegados, lector de pantalla) |
| Respuesta «Parche de 4 archivos: +120 −37.» | `diff.test.ts` (es, en, binario, reglas de estilo) y la instantánea de respuestas |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | Un `.patch` soltado como archivo no llegaba al lector | Se admite el texto de un archivo; con extensión de parche, 0,97. `diff.test.ts` |
| 2 | En estrecho, la columna única ocupaba media tabla y no iba en el orden unificado | En estrecho se pinta el diff unificado (una lista en su orden). `Vista.test.tsx` |
| 3 | Rutas entrecomilladas, sin prefijo o con « b/» mal leídas; nuevos de Subversion como modificados | Mandan las rutas de `---`/`+++`, desentrecomilladas en UTF-8; `(nonexistent)` y `(revision 0)` son `/dev/null`. `diff.test.ts` |
| 4 | Asunto en RFC 2047 sin descodificar | Se descodifica. `diff.test.ts` |
| 5 | Las versiones juntaban parches distintos | Los parches no guardan versiones. `diff.test.ts` |
| 6 | Los archivos plegados se pintaban igual | Solo al abrir el plegado. `Vista.test.tsx` |
| 7 | `git show`, `diff -ruN`, Mercurial, un bloque ```` ```diff ```` y los binarios de git no se detectaban | Se detectan. `diff.test.ts` |
| 8 | Una serie de parches contaba de más y se titulaba por el primero | Archivos únicos y «Serie de N parches». `diff.test.ts` |
| 9 | «Cambiar tipo» entre Código y Diff cambiaba la ref | La conserva si el tipo es el mismo. `reprocesar.test.ts` |
| 10 | Añadido y quitado solo por color | «añadida:»/«quitada:» para el lector de pantalla. `Vista.test.tsx` |
| 11 | Las versiones comparaban el nombre literal del lector | El lector que lo leería hoy (`paraElemento`) |
| 12 | Cambios de modo y renombrados sin contenido | Se detectan; el modo se enseña («modo 100644 → 100755»). `diff.test.ts` |
