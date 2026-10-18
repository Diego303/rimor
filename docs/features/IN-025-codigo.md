# IN-025 · Lector Código

## Objetivo y catálogo

Un fragmento de código guardado con su lenguaje y resaltado, para encontrarlo y leerlo después. Catálogo: **LEC-09** (plan §8.9). Depende de IN-017 y de la decisión **D16** (resaltado con los analizadores Lezer de CodeMirror, sin Shiki). Comparar versiones es de IN-029.

## Estado de partida

- El registro reserva el puesto 15 (`codigo`) del Anexo D; el tipo `codigo` (ref `COD-`) existe en `@rimor/formato` y `/codigo` lo fuerza.
- No hay pantalla de código en la referencia: la vista usa las piezas comunes (`pre.code`, tarjetas, «Detalles») y los tokens de color de la guía.
- Prompt (IN-023) ya descarta el código (`NO_ES_PROMPT`, líneas de código) y Markdown (IN-024) no puntúa sin encabezados ni señales.

## Diseño

### Lenguajes (los 12 más comunes)

TypeScript, JavaScript, Python, Java, C#, C y C++, Go, Rust, PHP, Ruby, Shell y SQL.

### `src/lectores/codigo/lenguajes.ts` (puro)

- **Por extensión** (si llega de archivo): `.ts .tsx .mts .cts`, `.js .jsx .mjs .cjs`, `.py`, `.java`, `.cs`, `.c .h .cpp .cc .hpp .cxx`, `.go`, `.rs`, `.php`, `.rb`, `.sh .bash .zsh`, `.sql`.
- **Por densidad de sintaxis**: para cada lenguaje, una lista de señales con su peso (palabras clave al principio de línea, construcciones propias, puntuación): `fn`/`let mut`/`impl`/`::`/`->` en Rust; `def`/`self`/`elif`/`:` al final de línea en Python; `func`/`:=`/`package` en Go; tipos (`: string`, `interface`, `as const`) en TypeScript frente a JavaScript; `#include`/`std::` en C y C++; `using System`/`namespace`/`public class … {` con propiedades `{ get; set; }` en C#; `<?php`/`$var`/`->` en PHP; `end`/`do |x|`/`def … end` en Ruby; `#!/bin/bash`/`$(…)`/`fi`/`done` en Shell; `SELECT … FROM`/`WHERE`/`JOIN` en SQL. Gana el de mayor puntuación por línea; si la mejor no supera un mínimo, «código» sin lenguaje.
- Líneas recorridas una vez, con expresiones sin retroceso; se miran las primeras 2.000 líneas.

### Detección

- 0,95 si llega de archivo con una extensión de la lista.
- 0,8 si al menos 3 líneas y el 60 % de las que no están vacías parecen código (puntuación de cierre `;`, `{`, `}`, `):`, asignaciones, palabras clave al principio, indentación consistente) y el lenguaje se reconoce; 0,7 si parece código pero el lenguaje no se reconoce.
- 0 para JSON válido (lo leerá IN-031), para trazas (Error puntúa 0,9) y para textos con frases.

### El lector (`src/lectores/codigo/`)

- `leer`: título de la primera definición (`function nombre`, `def nombre`, `class Nombre`, `fn nombre`…) o la primera línea; resumen provisional `{ lenguaje, lineas }`.
- `derivar` → `{ lenguaje, comoSeSupo: 'extension' | 'sintaxis' | 'ninguno', lineas, caracteres, definiciones }`.
- **Respuesta**: «Código TypeScript, 48 líneas.»; sin lenguaje, «Código de 48 líneas.».
- **Cifras**: `lineas`.
- `textoIndexable`: nombres de las definiciones.

### Vista y resaltado (D16)

- Tarjeta con el código en `pre.code` y números de línea; resaltado de solo lectura con Lezer: `@lezer/javascript` (TypeScript y JavaScript, con JSX), `@lezer/python`, `@lezer/java`, `@lezer/cpp` (C y C++), `@lezer/go`, `@lezer/rust` y `@lezer/php`, con `highlightCode` y `classHighlighter` de `@lezer/highlight` (clases `tok-*`) convertidos en elementos de React (nunca HTML). C#, Ruby, Shell y SQL no tienen analizador Lezer oficial: se muestran sin resaltar (decisión registrada).
- Cada analizador se carga bajo demanda (`import()`), solo cuando se abre un código de su lenguaje: nada de esto entra en la carga inicial.
- Colores de los `tok-*` con los tokens de la guía (palabras clave, cadenas, números, comentarios, tipos, nombres de función), claros y oscuros.
- «Detalles»: lenguaje y cómo se supo, líneas, caracteres, definiciones y cifras citables.

### Corpus

- `fixtures/codigo/`: dos o tres fragmentos reales por lenguaje con el lenguaje esperado.
- `fixtures/deteccion/codigo/`: 25 para la matriz.

## Tareas

- [ ] Detección del lenguaje por densidad de sintaxis (los 12 más comunes) y por extensión si viene de archivo.
- [ ] Resaltado de solo lectura con los analizadores Lezer de CodeMirror.
- [ ] Respuesta: «Código TypeScript, 48 líneas.»

## Pruebas previstas

- Lenguaje de cada fragmento del corpus (por densidad) y por extensión; TypeScript frente a JavaScript, C frente a C++.
- Ni JSON, ni trazas, ni logs, ni textos, ni prompts, ni documentos pasan por código; los demás corpus no cambian.
- Resaltado: los `tok-*` esperados en un fragmento de cada lenguaje con analizador; sin analizador, texto plano; el texto pintado es el original.
- Respuesta en es y en; reglas de estilo.
- La carga inicial no crece por los analizadores.

## Criterios de aceptación

- Las pruebas de arriba; `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Lenguajes sin analizador Lezer oficial (C#, Ruby, Shell, SQL) | Se detectan y se muestran sin resaltar; `@codemirror/legacy-modes` no es Lezer (D16) |
| El peso de los analizadores | Uno por lenguaje, cargado bajo demanda en la vista |
| Código dentro de un documento Markdown | Lo lee Markdown (encabezados y vallas); Código exige que casi todo sean líneas de código |
| Fragmentos muy cortos (una línea) | No se detectan como código (mínimo 3 líneas); se pueden forzar con `/codigo` |

## Autorrevisión

Cubre las tres tareas. La comparación de versiones (CMP-02) es de IN-029 y el diff (LEC-09b) de v0.2. Con lo aprendido en IN-021 a IN-024: la detección se recorre por líneas con expresiones sin retroceso (nada de `[ \t]*` contiguos ni `\s*` con la bandera `m`), normaliza CRLF, mira solo el principio y se prueba con el detector real contra todos los corpus y contra código, documentos y prompts reales del disco; Markdown ya da 0 a los textos que son casi todo código, así que no compite.
