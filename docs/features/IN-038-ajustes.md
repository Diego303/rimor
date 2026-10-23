# IN-038 · Ajustes

## Objetivo y catálogo

Una pantalla para lo que se puede cambiar de Rimor, guardado en el propio espacio (`.rimor/ajustes.json`): tema, idioma, cuánto duda la detección, qué secretos se ocultan, a qué tipos responde Rimor, el recordatorio de copia y la red. Catálogo: **APP-04**. Depende de IN-010 (secretos) e IN-016 (respuestas).

## Estado de partida

- `.rimor/ajustes.json` tiene esquema en `@rimor/formato` (`tema`, `idioma`, `deteccion: { umbral, duda }`, `secretos: { desactivadas }`, `respuestas: { desactivadas }`, `copias`, `red`) y se lee al abrir; `guardarAjustes` llegó con IN-037. Se usan ya `respuestas.desactivadas` (la respuesta de Rimor de un tipo) y `copias`.
- El tema vive en `localStorage` para aplicarse antes de pintar (Base.astro); el idioma, igual. `SelectorTema` existe.
- La detección usa `UMBRAL_DETECCION` (0,6) y `MARGEN_DUDA` (0,15) fijos; la ocultación de secretos admite reglas desactivadas (`REGLAS_SECRETOS`) pero nada se las pasa. La vista previa del compositor corre en el Worker de derivados para textos grandes.
- `/ajustes` es un hueco. La referencia no dibuja esta pantalla: se compone con sus piezas (`card` con `h3`, `seg`, casillas `chk`, `kv`).

## Diseño

### Lo que se guarda (`src/espacio/ajustes.ts`)

`leerAjustes` normaliza también `tema`, `idioma`, `deteccion` (`duda` entre 0,05 y 0,4; `umbral` entre 0,3 y 0,9) y `secretos.desactivadas` (los ids de reglas que existen), conservando lo que no conoce. `opcionesCaptura(ajustes)` da lo que necesitan la captura y la vista previa (serializable, para el Worker).

### Captura y vista previa

- `capturar` recibe `opciones()` (se leen en cada captura: un cambio en Ajustes vale para la siguiente) con las reglas desactivadas y el umbral y el margen de la detección.
- `previsualizar(texto, registro, opciones)`, también en el Worker: la vista previa del compositor dice lo mismo que hará la captura.

### Tema e idioma

Se guardan en el espacio y en este navegador (para pintar sin parpadeo antes de abrir el espacio). Al abrir un espacio cuyos ajustes dicen otro tema o idioma (uno importado), se aplican.

### La pantalla (`/ajustes`)

Tarjetas en una columna:

1. **Apariencia:** tema (Sistema · Claro · Oscuro) e idioma (Español · English).
2. **Detección:** «Dudar entre dos tipos cuando están a menos de [15] puntos» (control deslizante con su número) y una línea que explica qué es dudar.
3. **Secretos:** la lista de reglas (AWS, GitHub, JWT…) con su casilla; desactivar una avisa de que lo que case se guardará tal cual.
4. **Respuestas de Rimor:** una casilla por tipo con lector («Responder al capturar un log»).
5. **Copias:** el mismo plegado de recordatorio de Datos y copias (componente compartido).
6. **Red:** «Rimor no se conecta a ningún sitio.» (lo llena IN-041).

Cada cambio se guarda al momento (`guardarAjustes`); en la pestaña que solo lee, todo deshabilitado con la razón.

## Tareas

- [x] Tema.
- [x] Idioma.
- [x] Detección (umbral de duda).
- [x] Secretos (reglas activas).
- [x] Respuestas por tipo (D14).
- [x] Copias (umbrales).
- [x] Red (vacío en v0.1; lo llena IN-041).
- [x] Se guarda en `.rimor/ajustes.json`.

## Pruebas previstas

- `leerAjustes`: cada campo, sus límites y lo desconocido conservado; `opcionesCaptura`.
- Captura y vista previa con una regla desactivada (no se oculta) y con otro margen de duda (cambia la duda).
- Pantalla: cada tarjeta guarda en `.rimor/ajustes.json`; el tema y el idioma se aplican; una respuesta desactivada no sale; solo lectura deshabilita.
- Abrir un espacio con otro tema o idioma en sus ajustes los aplica.

## Criterios de aceptación

- `pnpm verificar` en verde; lo que se cambia en Ajustes vale para la siguiente captura sin recargar.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| ¿Tema e idioma del navegador o del espacio? | Los dos: el navegador para pintar sin parpadeo y el espacio para que viaje con él (el plan los pone en `ajustes.json`). |
| Desactivar reglas de secretos es arriesgado | Se avisa en la propia tarjeta; por defecto, todas activas. |
| La referencia no tiene Ajustes | Se compone con sus piezas; una tarjeta por tema. |

## Autorrevisión

Cubre las ocho tareas. Reutiliza `guardarAjustes` (IN-037), `SelectorTema`, `cambiarIdioma`, `REGLAS_SECRETOS`, el registro de lectores y el plegado de copias.

## Implementación

- `src/espacio/ajustes.ts`: `deteccion` (`DETECCION_INICIAL`, `LIMITES_DETECCION`), `secretos.desactivadas` (solo ids que existen), `tema` e `idioma` (se quitan si no valen), lo desconocido conservado; `opcionesCaptura`.
- `src/captura/opciones.ts`: de las opciones a las de `ocultar` y `detectar`. `capturar` recibe `opciones()` (se leen en cada captura); `previsualizar` las recibe también en el Worker; el compositor y el proveedor de captura las pasan.
- Tema e idioma: `SelectorTema` acepta `alCambiar`; Ajustes guarda los dos en el espacio; al abrir un espacio, `ProveedorEspacio` aplica los suyos.
- `src/rutas/ajustes/Ajustes.tsx`: Apariencia, Detección, Secretos (por tipo de secreto), Respuestas de Rimor (por tipo), Recordatorio de copia (`src/datos/AjustesRecordatorio.tsx`, compartido con Datos y copias) y Red.
- `montarApp` acepta preparar el almacén antes de abrir (para probar un espacio con ajustes).
- Pruebas: `espacio/copias.test.ts` (normalización), `captura/flujo.test.ts` (regla desactivada en la captura) y `rutas/ajustes/Ajustes.test.tsx` (tema e idioma, secretos en la vista previa, duda y respuestas, abrir un espacio con su tema e idioma).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Las reglas de secretos se agrupan por lo que ocultan (`aws`, `slack`…) | Desactivar la clave de AWS y no su secreto no tendría sentido; 13 casillas en vez de 18. |
| El margen de duda se guarda al soltar el control (o con el teclado, o al salir) | Arrastrarlo no escribe el archivo en cada paso. |
| Solo el margen de duda en la pantalla (no el umbral) | Es lo que pide la tarea; el umbral se respeta si viene en el archivo. |

