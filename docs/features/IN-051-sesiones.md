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
- **El id** es `AAAA-MM-DD-franja`, con el día y la franja de la hora local de su primera captura: madrugada antes de las 6, mañana hasta las 14, tarde hasta las 21 y noche después. Si ya existe, se añade `-2`, `-3`… (`2026-10-16-tarde-2`).
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

- [ ] Capturas separadas por menos de 45 minutos forman una sesión (`sesion` en el frontmatter).
- [ ] Nombre propuesto desde la colección o las etiquetas dominantes, editable.
- [ ] Tarjeta de sesión en el feed.

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
