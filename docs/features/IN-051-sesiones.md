# IN-051 · Sesiones automáticas

## Objetivo y catálogo

Que las capturas hechas en el mismo rato de trabajo formen una **sesión**, con un nombre propuesto que se puede editar y una tarjeta en el feed.

- **Catálogo:** ORG-08, sesiones automáticas («Capturas cercanas en el tiempo forman una sesión con nombre editable», v0.2). Depende de IN-026 (el feed).
- **Plan §4:** «Sesión: elementos capturados en el mismo rato de trabajo, agrupados solos».
- **Plan, Anexo A:** `sesion: 2026-10-16-tarde` en el frontmatter.
- **Referencia:** «Umbral de sesión (45 min)», y en el feed de Inicio la tarjeta `.sess`: «Sesión «Evaluación de clientes HTTP»», «10 elementos de 16:30 a 18:51 · …» y un botón.

## Estado de partida

- `sesion` ya está en el esquema del frontmatter (`paquetes/formato`), opcional, y nadie lo escribe.
- La captura (`captura/flujo.ts`) asigna la ref y escribe el elemento con el reloj inyectado. El espacio de ejemplo se genera capturando con su reloj.
- El feed (`rutas/inicio/filas.ts`) ordena los mensajes por día y por hora, con otras filas intercaladas en su momento: búsquedas, versiones y propuestas.
- Las colecciones guardan su registro en `colecciones.json`, en la raíz del espacio: viaja en el ZIP y la importación lo combina. Lo de `.rimor/` es de cada navegador.
- La referencia guarda la regla `.sess` (borde discontinuo, radio de 12 y `flex-wrap`).

## Diseño

### Asignar la sesión al capturar (`src/espacio/sesiones.ts`, TS puro, y `flujo.ts`)

- `UMBRAL_SESION_MS` = 45 minutos.
- Al crear un elemento:
  - si el capturado más reciente (por `creado`, fuera de la papelera) es de hace menos de 45 minutos y tiene `sesion`, va a la suya;
  - si no, a una nueva.
- **El id** es `AAAA-MM-DD-franja-HHMM`, con el día, la franja y la hora local de su primera captura: madrugada antes de las 6, mañana hasta las 14, tarde hasta las 21 y noche después. Si ya existe (también en la papelera), se añade `-2`, `-3`… (`2026-10-16-tarde-1630-2`). Cambiado en la verificación: el plan pone como ejemplo `2026-10-16-tarde`.
- Una versión nueva de un elemento conserva su sesión (no es otra captura). Lo importado trae la suya.
- Los elementos de antes de esta IN no tienen sesión. No se reescriben: un archivo cambiado solo para esto sería una edición más, y la copia lo tendría por cambiado.

### Nombres (`sesiones.json`, en la raíz del espacio)

- `{ "esquema": 1, "nombres": { "2026-10-16-tarde": "Evaluación de clientes HTTP" } }`: solo los que se editan.
- **Nombre propuesto**, si no hay uno editado:
  - el de la colección que tiene al menos la mitad de sus elementos;
  - si no, sus etiquetas más repetidas (una o dos, en al menos dos elementos): «ureq y streaming»;
  - si no, la franja: «Sesión de la tarde».
- `EspacioAbierto.sesiones()` y `guardarSesiones(cambio)`: como los ajustes, en orden, solo desde la pestaña que escribe y releídos con la otra.
- **Importar:** se combinan los nombres; ante el mismo id, se queda el de aquí. Un `sesiones.json` que no se entiende rechaza el paquete, como `colecciones.json`.

### En el feed

- Una tarjeta de sesión por cada sesión con **al menos dos elementos** visibles, en el filtro «Todo» y justo antes de su primer elemento:
  - icono de tiempo;
  - «Sesión «nombre»»;
  - «N elementos de 16:30 a 18:51 · Log, Error y Código», con los tres tipos más frecuentes.
- **Renombrar** abre un diálogo con un campo, como el de añadir a una colección. Vacío vuelve al propuesto. En solo lectura, sin botón.
- «Ver en la línea de tiempo» llegará con IN-057.
- **Pura:** `filasDelFeed` emite la fila `{ t: 'sesion', … }` con el resumen y la vista le pone el nombre.

## Tareas

- [x] Capturas separadas por menos de 45 minutos forman una sesión (`sesion` en el frontmatter).
- [x] Nombre propuesto desde la colección o las etiquetas dominantes, editable.
- [x] Tarjeta de sesión en el feed.

## Pruebas previstas

- `sesiones.ts`:
  - el id por franja y su sufijo;
  - seguir o abrir sesión: 44 y 46 minutos, el más reciente sin sesión, la papelera;
  - el nombre propuesto: colección, etiquetas o franja;
  - el archivo: lectura tolerante y escritura.
- Flujo: tres capturas a 10, 30 y 80 minutos dan dos sesiones; una versión conserva la suya.
- Feed: la fila de sesión antes de su primer elemento, solo con dos o más y en «Todo»; el resumen.
- Inicio: la tarjeta con su nombre propuesto; «Renombrar» lo guarda en `sesiones.json` y vacío vuelve al propuesto.
- Espacio: `guardarSesiones` escribe y relee; la importación combina.

## Criterios de aceptación

- `pnpm verificar` en verde.
- El espacio de ejemplo muestra su sesión con el nombre de su colección.
- Renombrar persiste tras volver a abrir.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Sesiones de elementos antiguos (sin `sesion`) | No se calculan ni se reescriben; la línea de tiempo (IN-057) puede sombrearlas por hora. |
| Borrar el elemento que unía dos tramos | La sesión se queda como se asignó (es un dato del elemento). |
| Nombres en `.rimor/` (no viajarían al importar) | En la raíz, como `colecciones.json`. |

## Autorrevisión

Cubre las tres tareas. Reutiliza el campo del esquema, el reloj de la captura, el patrón de los ajustes del espacio, las filas en su momento del feed, el diálogo de las colecciones y la regla `.sess` de la referencia.

## Implementación

- `src/espacio/sesiones.ts`: `sesionPara`, franjas, nombre propuesto, `sesiones.json` (leer, escribir, renombrar, juntar).
- `flujo.ts`: el elemento nuevo lleva su `sesion`; una versión conserva la suya.
- `espacio/abrir.ts`: `sesiones()` y `guardarSesiones()`.
- Importar: los nombres se combinan en `plan.ts` y se validan en `paquete.ts` (`importar.sesiones`).
- `rutas/inicio/filas.ts`: `sesionesDelFeed` y la fila `sesion`.
- `rutas/inicio/TarjetaSesion.tsx`: la tarjeta `.sess` con «Renombrar» y su diálogo.
- Pruebas: `sesiones.test.ts`, el flujo, las filas, el espacio e Inicio (tarjeta y renombrar).

## Verificación

- `pnpm verificar` en verde (ver `docs/seguimiento.md`).
- Revisión independiente (15 hallazgos), atendidos con pruebas salvo donde se dice:
  1. y 4. **El id (día y franja) era previsible.** Se reutilizaba tras la papelera (heredando el nombre y juntando elementos al restaurar) y se juntaban sesiones de dos dispositivos al importar. Ahora lleva la hora de su primera captura (`2026-10-16-tarde-1630`) y también cuentan los de la papelera.
  2. y 3. **Un `sesiones.json` que no se entiende se sobrescribía** (al importar y al pasar a escribir), y un fallo de E/S al abrir bloqueaba «Renombrar». Ahora se distinguen los dos casos, como con las reglas (IN-049): el que no se entiende no se toca nunca, y el que no se pudo leer se vuelve a leer antes de escribir.
  5. **«Sesión «Sesión de la tarde»»**: la franja ya es el título.
  6. **Coste**: el feed solo agrupa las sesiones con algo en los días cargados (no todo el historial a cada minuto).
  7. La tarjeta es un `<article>` con su nombre, y su botón dice de qué sesión es («Renombrar: Sesión «gateway»»).
  8. En inglés, comillas “ ”.
  9. La sesión y `creado` usan el mismo instante.
  10. Una sesión que empezó un día que no está cargado tiene su tarjeta en el primero que sí. Si cruza la medianoche, el resumen dice los dos días.
  11. Un `sesiones.json` de un esquema más nuevo se rechaza con `importar.esquemaNuevo`.
  12. El diálogo de renombrar vive en Inicio, fuera de la lista virtual.
  13. `LARGO_NOMBRE` en el campo. Guardar el mismo nombre que el propuesto vuelve al propuesto (sigue a su colección). **Sin cambio:** los campos desconocidos del archivo no se conservan; un esquema más nuevo ya no se toca.
  14. **Sin cambio:** una versión nueva no cuenta como actividad de la sesión de ahora (es del elemento viejo). Queda para IN-057, que puede sombrear la actividad por horas.
  15. **Pruebas añadidas:**
      - papelera;
      - una versión conserva su sesión;
      - importación (juntar, no tocar un archivo ilegible, rechazar uno roto o de un esquema más nuevo);
      - E/S al abrir;
      - pestaña que solo lee y relectura;
      - espacio de ejemplo con su sesión;
      - franja en la interfaz;
      - posición de la tarjeta;
      - esperar a la escritura.
