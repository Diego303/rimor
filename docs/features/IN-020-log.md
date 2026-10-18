# IN-020 · Lector Log

## Objetivo y catálogo

Entender un log de un vistazo: qué pasa, cuándo y qué se repite. Catálogo: **LEC-04** (plan §8.1). Depende de IN-017 y de F0-6 (50.000 líneas en 430–525 ms en un Worker; nivel sin distinguir mayúsculas y leído primero de `level=`; plantilla de JSON por línea desde el mensaje y los nombres de las claves; por encima de 50.000 líneas, por bloques con progreso).

## Estado de partida

- Contrato de lectores, cola de derivados en el Worker, contexto de respuestas (misma huella, colecciones…), corpus de detección y matriz.
- Un texto de más de 2 MB llega a los lectores como adjunto (`original: null`): el Worker no lo tiene.
- La pantalla de referencia del Log: tarjeta con tres cifras (errores en `--bad`, avisos en `--warn`, plantillas), histograma SVG de barras apiladas por minuto (otros en `--line`, avisos y errores) con una etiqueta cada 5 barras y la frase «Los errores se concentran entre **17:40 y 17:43**»; tarjeta «Qué dice» con la tabla de las 5 plantillas principales (recuento y plantilla en mono con `<N>`, `<ID>`, `<IP>`, `<HEX>` en `.ph` y el nivel en `.lv-ERROR`/`.lv-WARN`), «Ver las N» y, al pulsar una, sus líneas en un `pre.code` con número (`.ln`); y plegados «Líneas originales» y «Detalles» con las cifras citables.

## Diseño

### `src/lectores/log/analisis.ts` (puro, en el Worker)

- **Marcas de tiempo** (la primera de cada línea): ISO 8601 (con `T` o espacio, milisegundos con punto o coma, `Z` u offset), `AAAA/MM/DD hh:mm:ss` (Go), syslog `Oct 17 17:40:01`, la de Apache/Nginx `[17/Oct/2026:17:40:01 +0200]`, solo hora `17:40:01(.123)` al principio, y en JSON los campos `time`, `timestamp`, `ts`, `@timestamp` (también en segundos o milisegundos desde 1970). Se guarda el instante (para ordenar y agrupar) y la **hora de pared** tal como está escrita (para mostrar «17:40»).
- **Nivel**: primero `level=`/`lvl=`/`severity=` o `"level"`/`"severity"` (sin distinguir mayúsculas), después una palabra en mayúsculas (`TRACE`, `DEBUG`, `INFO`, `WARN`/`WARNING`, `ERROR`/`ERR`, `FATAL`/`CRITICAL`/`PANIC`) o entre corchetes; en formato de Apache, el estado (5xx error, 4xx aviso). Sin nivel, `INFO`.
- **Formatos** reconocidos por línea: texto con marca y nivel, **JSON por línea**, **logfmt**, **syslog** y Apache; la detección los usa.
- **Plantilla** de cada línea: la normalización de la pantalla de referencia (fechas, UUID → `<ID>`, IP → `<IP>`, hexadecimales → `<HEX>`, números → `<N>`), quitando antes las marcas de tiempo de todos los formatos; en JSON y logfmt, desde el mensaje (`msg`, `message`) y los nombres de las demás claves ordenados, con el nivel delante. Es idempotente.
- **Pares `clave=valor`**: de logfmt y del texto (`clave=valor` y `clave="valor con espacios"`) y las claves simples del JSON; por clave, cuántas veces sale y sus 5 valores más frecuentes.
- **Primer y último error** (línea, hora y texto).
- **Histograma** por minuto y nivel (errores, avisos, otros) o por hora si el rango pasa de 6 h (por día si pasa de 20 días).
- **Concentración de errores**: la ventana más corta de barras que reúne al menos el 80 % de los errores.
- `analizar(texto, { alProgreso })`: por bloques de 50.000 líneas cuyos resultados se suman (plantillas, niveles, histograma, pares), avisando del progreso tras cada bloque.

### El lector (`src/lectores/log/`)

- `detectar`: 0,85 si hay al menos 3 líneas con contenido y al menos el 60 % (de las 200 primeras) tiene marca de tiempo, nivel, es JSON con nivel o mensaje, o es logfmt con al menos dos pares; 0 si no.
- `leer`: título «Log · {primera plantilla de error, o la más frecuente}» si la hay (recortada), si no la primera línea; resumen provisional `{ lineas }`.
- `derivar` → `DatosLog`: `{ lineas, formato, desde, hasta, duracionMs, niveles, plantillas: [{ plantilla, n, nivel }], lineaPlantilla: number[], pares, primerError, ultimoError, histograma: { paso: 'minuto'|'hora'|'dia', barras }, concentracion }`. Copiable con structured clone.
- `resumen`: `{ lineas, errores, avisos, plantillas, desde, hasta }`; `resumenLegible`: «1042 líneas · 16 errores».
- **Respuesta** (dos frases como mucho, IN-016): «Log de 1042 líneas, con 16 errores entre 17:40 y 17:43.» y, si en el contexto hay un error capturado durante esa ventana, «… a la vez que ERR-0015. ¿Lo añado a su hilo?» con [Sí, a su hilo] [No]. Sin errores: «Log de 1042 líneas sin errores.» (o «…, sin errores y con 3 avisos.»). Para eso el contexto gana `cercanos`: los elementos guardados en las 24 h anteriores y posteriores (IN-016 se amplía, con prueba).
- **Cifras citables**: `lineas`, `errores`, `avisos`, `duracion`, `plantillas`.
- `textoIndexable`: las plantillas.

### Progreso y adjuntos (contrato, IN-012)

- `derivar(el, { alProgreso })`: la cola reenvía el progreso a quien espera (`pedir(el, { alProgreso })`), el ejecutor lo pasa al Worker con `Comlink.proxy`, y `VistaElemento` lo pinta junto a «analizando»: «Analizando 100.000 de 340.000 líneas».
- Si el elemento llega con `original: null` y un adjunto de texto, la cola lo carga antes de derivar (`cargarOriginal`, que da `ProveedorLectores` con `Repositorio.leerAdjunto`). Así un log de más de 2 MB también se analiza.

### Vista (`Vista.tsx`) y tarjeta

Como la pantalla de referencia: tarjeta de cifras + histograma + frase de concentración; «Qué dice» con las 5 primeras plantillas, «Ver las N»/«Ver menos», y al pulsar una (fila `tr.click`, `on` si está elegida) sus líneas (hasta 200) en `pre.code` con `.ln`; «Líneas originales» (las 200 primeras, con el nivel coloreado) y «Detalles» (formato, rango, pares principales y cifras citables) plegados. Los botones «Comparar con otro log» y «Ver su hilo» llegan con IN-028 e IN-030. Tarjeta: «1042 líneas · 16 errores».

## Tareas

- [x] Detecta marcas de tiempo, niveles, JSON por línea, syslog y logfmt.
- [x] Deriva líneas, rango y niveles; plantillas; pares `clave=valor`; primer y último error; histograma por minuto o por hora.
- [x] Más de 50.000 líneas: por bloques con progreso.
- [x] Vista: resumen e histograma; 5 plantillas («ver todas»); filtrar por plantilla; líneas y detalles plegados.
- [x] Cifras citables: `lineas`, `errores`, `avisos`, `duracion`, `plantillas`.
- [x] Respuesta: «Log de 1042 líneas. 16 errores entre 17:40 y 17:43, a la vez que ERR-0015. ¿Lo añado a su hilo?» (en dos frases).

## Pruebas previstas

- `fixtures/logs/`: 8 formatos (texto ISO, Python, Go, Java/log4j, logfmt, JSON por línea, syslog, Apache), cada uno con su análisis esperado (líneas, niveles, rango, nº de plantillas, primer error).
- Propiedad: normalizar dos veces da lo mismo (fast-check con líneas generadas).
- 50.000 líneas en menos de 2 s; 120.000 líneas con progreso en bloques y el mismo resultado que de una vez.
- Histograma por minuto, por hora (rango > 6 h); concentración de errores.
- Respuesta en es y en, con y sin errores, con un ERR cercano (y su acción) y sin él; reglas de estilo (IN-016).
- Corpus de detección `fixtures/deteccion/log/` (25) y matriz; ningún texto, idea ni enlace pasa por log.
- Vista (happy-dom): cifras, histograma, plantillas, filtro al pulsar, «Ver las N»; progreso en `VistaElemento`.
- Cola: el progreso llega a quien espera; un adjunto de texto se carga antes de derivar.

## Criterios de aceptación

- 8 formatos analizados bien; normalización estable; 50.000 líneas en menos de 2 s (pruebas).
- `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| La respuesta de la ficha son tres frases y la regla de IN-016 dice dos | Se une en dos: «Log de 1042 líneas, con 16 errores entre 17:40 y 17:43, a la vez que ERR-0015. ¿Lo añado a su hilo?» |
| Horas en otra zona | Se muestra la hora de pared escrita en el log; los instantes solo sirven para ordenar y agrupar |
| Logs sin año (syslog) | Se toma el año de la captura |
| La palabra «error» en minúsculas dentro de un mensaje | No cuenta como nivel salvo en un campo de nivel o entre corchetes |
| Guardar `lineaPlantilla` de 50.000 números | Cabe de sobra en la caché; es lo que permite filtrar sin recalcular |

## Autorrevisión

Cubre las seis tareas y las pruebas de la ficha. Amplía el contrato (progreso y carga del adjunto) de forma compatible: los demás lectores no cambian. Comparar logs (IN-028) e hilos (IN-030) se apoyarán en `plantillas` y `lineaPlantilla`.

## Cambios durante la implementación

- Además de los 8 formatos de la ficha, se reconocen **klog** (Kubernetes: `E1018 16:00:01.123456 …`, con el nivel en la letra) y el **log de PHP** (`[18-Oct-2026 21:00:01 UTC] PHP Warning: …`), que aparecieron en el corpus de detección.
- Las expresiones regulares globales se compilan una vez (crearlas por línea multiplicaba por seis el tiempo de 50.000 líneas).
- En la tabla de plantillas, la fila se pulsa con el ratón y la plantilla es un botón (con `aria-pressed`) para el teclado.
- El progreso del análisis y la carga del adjunto quedan en el contrato para cualquier lector: `derivar(el, { alProgreso })`, `pedir(el, { alProgreso })`, `cargarOriginal` en la cola y el texto `progreso` opcional de cada lector (si no lo tiene, «{analizando}: {hechas} de {total}»).
- El contexto de las respuestas gana `cercanos` (lo guardado en las 24 h de alrededor).
- La sintaxis de cita de las cifras (`{{REF.nombre}}`) va en los textos del lector.

## Verificación

**`pnpm verificar`** (2026-10-18 20:56): tipos 0 errores; Biome, colores y textos, OK; Vitest 50 archivos y 646 pruebas, OK; construcción OK; carga inicial 188,5 KB. **`pnpm deteccion`**: 100 % de 125 ejemplos (archivo, enlace, idea, log y texto).

| Criterio | Evidencia |
|---|---|
| Detecta marcas, niveles, JSON por línea, syslog y logfmt | Los 8 formatos de `fixtures/logs/` (y klog y PHP en el corpus de detección); JSON de datos y CSV con fechas no son logs |
| Deriva líneas, rango, niveles, plantillas, pares, primer y último error, histograma | Pruebas de los 8 formatos, de plantillas y pares, y del histograma (minuto, hora, día local, tope de barras) |
| Más de 50.000 líneas por bloques con progreso | 120.000 líneas: avisos a 50.000, 100.000 y 120.000 y el mismo resultado; el progreso llega a la vista |
| Vista | Prueba de la vista: cifras, histograma, concentración, plantillas que filtran sus líneas |
| Cifras citables | `lineas`, `errores`, `avisos`, `duracion`, `plantillas` |
| Respuesta (en dos frases) | Con errores, con un error a la vez (por instantes), sin errores, con un solo error |
| Normalización estable | Propiedad con fast-check |
| 50.000 líneas en menos de 2 s | ~0,65 s (el mejor de tres intentos dentro de la batería completa) |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Líneas de texto tomadas por logfmt** (`… ERROR … time=12ms`): logfmt exige que la línea empiece por `clave=`.
2. **Niveles numéricos de pino y bunyan** (`"level":50`): se traducen.
3. **Logs de más de 2 MB**: la vista lee el texto del adjunto (`useOriginal`); el adjunto se reconoce como texto por su contenido (también `.jsonl`); si no se puede cargar, el trabajo falla en vez de guardar «0 líneas» en la caché.
4. **Una fecha dentro del mensaje ganaba a la marca inicial**: gana la marca de más a la izquierda; las fechas fuera de 1970–2200 no cuentan.
5. **Retroceso cuadrático en los pares `clave=valor`**: la clave no puede ir pegada a otra palabra y solo se miran los primeros 4.000 caracteres.
6. **Logs sin fecha o sin año**: los cambios de día (solo hora) y de año (syslog, klog) se arrastran, y una fecha sin año posterior a la captura es del año anterior.
7. **«A la vez que ERR-…»** comparaba horas de pared y días de captura: se comparan instantes, y solo si el log tiene fechas completas.
8. **Marcas en microsegundos o nanosegundos**: se reconocen por sus cifras; el histograma nunca pasa de 1.500 barras y la vista no usa `Math.max(...)`.
9. **Detección demasiado amplia**: un JSON cuenta si tiene nivel, mensaje u hora; una marca, si está al principio y la sigue un mensaje con palabras.
10. **Un campo `level=` del mensaje ganaba a la palabra de nivel del principio**: ahora gana la del principio.
11. **Histograma por día en UTC**: corta a medianoche local y etiqueta en hora local.
12. **Proxies de Comlink en todas las derivaciones**: solo los lectores que avisan del progreso (`informaProgreso`) lo reciben.
13. **La carga del adjunto quedaba fuera del plazo**: va dentro.
14. **`leer` analizaba todo el log en el hilo principal**: busca el primer error en las 2.000 primeras líneas.
15. **Un solo error daba «entre 17:40 y 17:40»**: «a las 17:40».
Además: las expresiones se compilan una vez y la cabeza de la línea se mira sin rehacer las marcas (vuelve a ~0,65 s por 50.000 líneas), y la plantilla resalta solo el primer nivel, como la referencia.

