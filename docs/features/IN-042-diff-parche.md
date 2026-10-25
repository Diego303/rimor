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
- **Versiones:** el anterior se busca entre los del mismo tipo **y** del mismo lector (un parche nuevo puede ser la versión de otro parche, nunca de un código).

## Tareas

- [ ] Detecta `diff --git` y `@@`.
- [ ] Deriva los archivos afectados y las líneas añadidas y quitadas por archivo.
- [ ] Vista lado a lado con resaltado.
- [ ] Respuesta «Parche de 4 archivos: +120 −37.».

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
