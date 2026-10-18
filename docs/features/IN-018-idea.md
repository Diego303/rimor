# IN-018 · Lector Idea y resurgimiento mínimo

## Objetivo y catálogo

Guardar ideas sueltas sin fricción y que vuelvan solas si no se hace nada con ellas. Catálogo: **LEC-02** y **ORG-13** (parcial, incoherencia 1 de la implementación: en v0.1, solo ideas, a 7 y 30 días, en el feed). Depende de IN-017 (la red de seguridad: lo que no es idea sigue siendo Texto).

## Estado de partida

- Contrato de lectores, registro (Idea va en el puesto 16 del Anexo D, antes de Texto), corpus de detección por carpeta y matriz.
- `Repositorio.actualizarElemento` para cambiar el estado sin pisar ediciones.
- La pantalla de referencia pinta el mensaje que vuelve así: `article.msg` con `.rimor` («Hace 16 días guardaste una idea: **Exportar minipapers con Typst**. ¿Sigue en pie?») y `.mact` con [Más adelante] [Descartar] [Convertir en investigación]. «Convertir» no se muestra hasta IN-070 (incoherencia 2).
- Aún no hay feed (IN-026): el mensaje se pinta en Inicio, encima de lo demás, y IN-026 lo integra en el feed.

## Diseño

### `src/lectores/idea/`

- `detectar`: 0,7 si el texto, sin espacios alrededor, tiene menos de 280 caracteres, como mucho 3 líneas, y ninguna señal de otro tipo: URL, marca de hora o nivel de log (`ERROR`, `WARN`, `17:40:01`), traza (`at `, `Traceback`, `panicked`), números con unidad repetidos, sintaxis de código (`{`, `}`, `;` al final de línea, `=>`, `def `, `function`), una línea que empieza por `$` o por un comando conocido, o Markdown con encabezados o listas. Si no, 0. Con `/idea` la elige el compositor.
- `leer`: título de la primera línea; cuerpo opcional (el resto); `metadatos: { estado: 'semilla' }`. La primera vuelta se cuenta desde `creado`.
- `derivar`: `{ palabras, lineas }`; `resumen`: `{ palabras }`; `resumenLegible`: «Semilla · 12 palabras».
- `respuesta`: «Idea guardada. Volverá dentro de 7 días si no haces nada con ella.» (es y en).
- Estados (`ESTADOS_IDEA`): `semilla`, `explorando`, `aparcada`, `descartada` y `convertida` (esta, solo la pone IN-070; la vista no la ofrece).
- `Vista.tsx`: el texto y un segmentado con los cuatro estados que se pueden elegir; al cambiarlo, `actualizarElemento` guarda el nuevo estado (y quita `vuelve` si deja de ser semilla).
- `Tarjeta.tsx`: el cuerpo en `sm muted` y el estado en `Estado`.

### Resurgimiento mínimo (`src/lectores/idea/resurgir.ts`, puro)

- `vuelven(elementos, ahora)`: ideas en `semilla` cuyo `vuelve` ya pasó, de la más antigua a la más nueva.
- `posponer(fm, ahora)`: `vuelve = ahora + 30 días`. `descartar(fm)`: `estado = 'descartada'` y sin `vuelve`.
- Con el reloj simulado: capturada el día 0 → aparece el día 7; pospuesta el día 7 → vuelve el día 37.

### En Inicio (`IdeasQueVuelven.tsx`)

Por cada idea que vuelve, un `article.msg` como el de la pantalla de referencia: respuesta de Rimor («Hace 7 días guardaste una idea: **título**. ¿Sigue en pie?») y acciones [Más adelante] y [Descartar], que escriben con `actualizarElemento` y avisan («Volverá dentro de 30 días», «Idea descartada»). Se recalcula con cada cambio del espacio. Las reglas `.msg` y `.mact` de la pantalla de referencia se portan a `componentes.css` (las usará también el feed).

## Tareas

- [x] Detecta texto corto (< 280 caracteres) sin otras señales, o `/idea`.
- [x] Estados: semilla, explorando, aparcada, descartada y convertida (esta última, activa desde IN-070).
- [x] Resurgimiento mínimo: a los 7 días y, si se pospone, a los 30, con «Más adelante» y «Descartar».
- [x] Respuesta: «Idea guardada. Volverá dentro de 7 días si no haces nada con ella.»

## Pruebas previstas

- Detección: el corpus `fixtures/deteccion/idea/` (25 ideas reales, cortas, en es y en) y que ninguno de los 25 textos largos ni los binarios se tomen por idea; casos límite (279 y 280 caracteres, una URL, una hora, código).
- Lectura con estado y `vuelve`; respuesta en es y en (y las reglas de estilo de IN-016, que la recorren sola).
- `vuelven`/`posponer`/`descartar` con el reloj simulado: día 6 no, día 7 sí; pospuesta el 7, el 36 no y el 37 sí; descartada o en otro estado, nunca.
- `IdeasQueVuelven` (happy-dom): mensaje con el título y los días, «Más adelante» la quita hasta 30 días después, «Descartar» la deja descartada; sin «Convertir en investigación».
- Vista: cambiar el estado lo guarda.

## Criterios de aceptación

- Con el reloj simulado, la idea aparece el día 7 y el 37 si se pospone (prueba).
- `pnpm verificar` y `pnpm deteccion` en verde, con la carpeta de ideas.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| ¿Qué es «sin tocar»? | Seguir en `semilla`: cambiar su estado (o descartarla) la saca del resurgimiento |
| Textos cortos que no son ideas (un comando, una hora) | La detección exige que no haya señales de otro tipo; los lectores de esos tipos puntúan más alto cuando lleguen |
| Sin feed todavía | El mensaje se pinta en Inicio; IN-026 lo coloca en el feed |

## Autorrevisión

Cubre las cuatro tareas y la aceptación, con el alcance de la incoherencia 1 (solo ideas, 7 y 30 días). «Convertir en investigación» queda fuera hasta IN-070, como manda la incoherencia 2.

## Cambios durante la implementación

- **`vuelve` solo se escribe al posponer**: la primera vuelta se calcula desde `creado` (`cuandoVuelve`), que lleva el reloj de la captura. Así el lector no necesita reloj y el reloj simulado de las pruebas manda.
- Cambiar el estado desde la vista conserva `vuelve` (una idea pospuesta que vuelve a semilla sigue esperando a su fecha) y actualiza `modificado`.
- Las reglas `.msg`, `.mhead`, `.mprev` y `.mact` de la pantalla de referencia (con su «Estilo Instrumento»: radio 14, sin borde, sombra) quedan en `componentes.css` para el feed de IN-026.
- Dos pruebas de la captura usaban textos cortos como ejemplo de Texto; ahora son ideas, y se ajustaron con textos largos (y una prueba nueva de que lo corto sin señales es una idea).

## Verificación

**`pnpm verificar`** (2026-10-18 19:47): tipos 0 errores; Biome, colores y textos, OK; Vitest 48 archivos y 592 pruebas, OK; construcción OK; carga inicial 178,2 KB. **`pnpm deteccion`**: archivo, idea y texto 25/25 cada uno (100 %).

| Criterio | Evidencia |
|---|---|
| Detecta texto corto sin otras señales, o `/idea` | `idea.test.ts` (casos que sí y que no) y la matriz con el corpus de ideas; `/idea` lo resuelve el compositor (IN-015) |
| Estados (convertida solo desde IN-070) | Vista con los cuatro elegibles; prueba de cambio de estado |
| Resurgimiento a los 7 días y, pospuesta, a los 30 | `idea.test.ts` e `IdeasQueVuelven.test.tsx` con el reloj simulado: día 6 no, día 7 sí; pospuesta, día 36 no, día 37 sí |
| Respuesta de la ficha | Prueba en es y en, e instantánea |
| Sin «Convertir en investigación» | Prueba del mensaje |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Errores, código y comandos cortos se tomaban por ideas** (`TypeError: …`, `panic: …`, `SELECT …`, `console.log(x)`, `PORT=8080`, `rm -rf …`, `echo $PATH`): señales de traza, código y comando ampliadas, siempre por sintaxis.
2. **Un archivo de texto corto soltado se guardaba como idea**: un archivo nunca es una idea.
3. **En una pestaña que solo lee los botones no hacían nada, en silencio**: no se ofrecen; y si una escritura falla, se avisa («No se pudo guardar el cambio»).
4. **Palabras corrientes impedían detectar ideas** («let», «class», «return», «function», «stack trace», «DEBUG», «10:30»): fuera las palabras sueltas; los niveles de log cuentan al principio de línea o entre corchetes y las horas, con segundos.
5. **Cambiar el estado, posponer o descartar no tocaba `modificado`**: ahora sí (y Deshacer ya no borra una idea editada).
6. **La vista no seguía los cambios de fuera**: se sincroniza con el repositorio y con el modo de la pestaña.
7. **El mensaje no aparecía solo al llegar su día**: un temporizador despierta cuando toca la siguiente vuelta (y como mucho cada hora).
8. **«Día 7» eran 7×24 horas**: días de calendario en la zona del usuario (vuelve al empezar el día; los cambios de hora no la mueven).
9. **Volver a «semilla» se saltaba el aplazamiento**: se conserva `vuelve`.
10. **Una idea sin `estado`** se trata como semilla en todas partes.
11. **El orden de las que vuelven** es por instante (`Date.parse`), no por el texto de la fecha.

