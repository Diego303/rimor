# IN-016 · Respuestas de Rimor y contadores locales

## Objetivo y catálogo

Que cada captura reciba una frase útil, siempre calculada, nunca inventada. Catálogo: **CAP-14**. Depende de IN-012 (contrato: `respuesta(el, d, ctx)`, `Respuesta`, `Fragmento`), IN-003 (textos), IN-090 (`<Senal estado="contestando">`) y D14 (desactivar respuestas por tipo, desde Ajustes).

## Estado de partida

- `src/respuestas/tipos.ts`: `Fragmento`, `Accion`, `Respuesta` (IN-012).
- `Lector.respuesta(el, d, ctx)` con `Contexto = { idioma, mismaHuella, versiones, notas, colecciones, respondeA? }`.
- La captura (IN-014) devuelve `derivados` (la promesa de la cola) con el elemento creado y cuenta lo ocultado en `frontmatter.ocultados`; no guarda qué tipos de secreto eran.
- CSS `.rimor` y `.rimor .av` ya portados (IN-002); `SimboloRimor` con variante `mono` (IN-089).
- Aún no hay feed (IN-026) ni Ajustes (IN-038).

## Diseño

### Módulos

```
src/respuestas/contexto.ts     ← construirContexto(el, repositorio, idioma, respondeA?) (puro sobre lo que hay en memoria)
src/respuestas/componer.ts     ← componer(el, lector, datos, ctx, opciones): respuesta del lector + frase común de secretos
src/respuestas/reglas.ts       ← comprobarEstilo(respuesta): como mucho 2 frases, sin «!», sin emojis, como mucho 2 acciones
src/respuestas/RespuestaRimor.tsx ← pinta los fragmentos (§7.6) con el avatar; «Leyendo…» con `contestando` mientras se compone
src/respuestas/useRespuesta.ts ← espera los derivados del elemento y compone (o nada si el tipo la tiene desactivada)
src/respuestas/contadores.ts   ← .rimor/contadores.json por día: contar(clave), leer y sumar
src/espacio/ajustes.ts         ← lo mínimo de .rimor/ajustes.json que hace falta aquí: `respuestas.desactivadas` (IN-038 completa)
```

### Contexto

`construirContexto` usa los frontmatters del repositorio (sin abrir archivos):

- **mismaHuella:** otros elementos con la misma `huella` (la escribe el lector de Error en `lector.resumen.huella`, IN-021), del más reciente al más antiguo.
- **versiones:** los que comparten `id` de serie (`alias` o la cadena de `version`, IN-029); de momento, los que el elemento nombra en `alias`.
- **notas:** las notas de solución de esos elementos (las de la misma huella con `estado: resuelto`): ref, primera línea de sus notas y fecha. Las notas viven en el archivo: se leen solo de los resueltos con la misma huella (pocos).
- **colecciones candidatas:** colecciones de otros elementos que comparten etiquetas con este o, si no hay, palabras significativas del título (de 4 letras o más), ordenadas por coincidencias; como mucho 3, sin las que ya tiene.
- **respondeA:** el frontmatter del elemento al que responde la captura, si lo hay.

### Componer

`componer(el, lector, datos, ctx)` = `lector.respuesta(el, datos, ctx)` y, si `frontmatter.ocultados > 0`, una frase común al final: «He ocultado un secreto antes de guardar.» / «He ocultado 3 secretos antes de guardar.» (es y en). Si `respuesta` lanza, se usa una respuesta honesta de reserva: «Guardado como {tipo}.» Las acciones del lector se recortan a dos.

### Reglas de estilo (prueba)

`comprobarEstilo(r)` devuelve la lista de faltas: más de 2 frases en lo que dice el lector (la frase común de secretos no cuenta), algún «!», algún emoji (`\p{Extended_Pictographic}`), más de 2 acciones o fragmentos vacíos. Se usa en las pruebas sobre todas las respuestas que generan los lectores registrados (y la plantilla) con sus ejemplos de `fixtures/deteccion/`, en es y en.

### `RespuestaRimor`

```
<div class="rimor">
  <span class="av">[SimboloRimor mono 13 px | Senal contestando]</span>
  <p>fragmentos…</p>
</div>
```

Fragmentos: `texto` tal cual; `fuerte` en `<b>`; `cifra` en `<b class="cifra">` (mono tabular); `ref` como `Ref` pulsable (abre el elemento); `cita` entre comillas latinas con su fecha relativa («El 15 oct escribiste: «…»»); `mono` en `<span class="mono">`. Mientras se compone, el avatar es `<Senal estado="contestando" decorativa>` y el texto «Leyendo…» (con `aria-live`); las acciones las pinta quien la usa (el feed, IN-026), con `principal` como `btn key`.

`useRespuesta(capturado)` espera `capturado.derivados`; si fallan, una respuesta de reserva sin datos («Guardado como Log. No pude analizarlo: se ve el original.»). Si el tipo tiene las respuestas desactivadas (D14), devuelve `null` y no se pinta nada.

### Contadores locales

`.rimor/contadores.json`: `{ "esquema": 1, "dias": { "2026-10-18": { "duplicadosEvitados": 2, … } } }`, con las claves `erroresReconocidos`, `duplicadosEvitados`, `copiasConValores`, `busquedasConResultado`, `correccionesDeTipo` y `respuestasDescartadas`. `crearContadores(almacen, reloj)` da `contar(clave, n = 1)` (en orden, solo la pestaña que escribe; un fallo de escritura no rompe nada) y `total(clave, desde?)`. Viven en `.rimor/`, así que el ZIP de IN-035 los exporta e importa con el resto del espacio. Aquí se conecta **duplicados evitados** (la captura); el resto, en su IN (Error IN-021, Prompt IN-023, Búsqueda IN-032, triaje IN-026, reglas IN-049).

## Tareas

- [ ] `construirContexto(elemento)`: misma huella, versiones previas, notas de solución, colecciones candidatas y elemento al que se responde.
- [ ] `RespuestaRimor` que pinta los fragmentos según la guía (§7.6), con el `SimboloRimor` mono como avatar y `contestando` + «Leyendo…» mientras se compone.
- [ ] Reglas de estilo comprobadas por prueba: como mucho 2 frases, sin `!`, sin emojis y como mucho 2 acciones.
- [ ] Frase añadida común: secretos ocultados.
- [ ] Desactivar respuestas por tipo (D14), leído de ajustes.
- [ ] Contadores locales por día en `.rimor/contadores.json`.

## Pruebas previstas

- `construirContexto` con un repositorio en memoria: misma huella (sin el propio), notas de los resueltos, colecciones candidatas por etiquetas y por palabras del título, respondeA.
- `componer`: frase de secretos en singular y plural, en es y en; respuesta de reserva si el lector lanza; acciones recortadas.
- `comprobarEstilo` con casos buenos y malos; propiedad: ninguna respuesta generada por los lectores registrados y la plantilla sobre el corpus incumple las reglas.
- Instantáneas de la respuesta de cada lector con sus ejemplos, en es y en (hoy, la plantilla).
- `RespuestaRimor` (happy-dom): cada fragmento, la ref pulsable y el estado «Leyendo…»; `useRespuesta` con datos, con fallo y con el tipo desactivado.
- Contadores: contar varias veces el mismo día y en días distintos, releer tras reabrir, pestaña lectora que no escribe, y la captura que cuenta un duplicado.

## Criterios de aceptación

- Ninguna respuesta del corpus incumple las reglas (prueba de propiedad).
- Los contadores sobreviven a exportar e importar: viven en `.rimor/contadores.json` y se releen al reabrir (prueba); el ZIP de IN-035 incluye `.rimor/` (se comprobará allí).
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| La frase de secretos hace pasar de 2 frases | Es la frase común añadida que pide la ficha; la regla se aplica a lo que dice el lector |
| Sin feed todavía | `RespuestaRimor` y `useRespuesta` quedan listos para IN-026 y se prueban solos |
| Ajustes aún no existe | `ajustes.ts` lee y escribe solo `respuestas.desactivadas`; IN-038 añade el resto sin romper el archivo |
| Qué tipos de secreto se ocultaron | La captura solo guarda cuántos (`ocultados`); la frase dice cuántos, no cuáles |

## Autorrevisión

Cubre las seis tareas y los criterios. Lo que depende de lectores que aún no existen (huella, versiones, notas de solución) se calcula sobre los campos que esos lectores escribirán, sin inventarlos: hoy dan listas vacías y las pruebas los fabrican.
