# IN-050 · PWA, sin conexión y compartir

## Objetivo y catálogo

Que Rimor se pueda instalar, que funcione sin conexión y que reciba lo que se comparte desde otras apps del sistema.

- **CAP-08** (PWA y compartir): instalar Rimor y recibir contenido con «Compartir» (Web Share Target).
- **APP-06** (funcionamiento sin conexión).

Depende de IN-014 (la captura y el compositor). Plan §15: vite-plugin-pwa (Workbox). Plan §12, punto 6: instalar la app aumenta la probabilidad de que el navegador conceda el almacenamiento persistente; se sugiere en el primer uso.

## Estado de partida

- Astro 5 estático con una isla React; GitHub Pages bajo `BASE`; la CSP va en una `<meta>` (`scripts/csp.mjs`) y ya permite `worker-src 'self' blob:` y `manifest-src 'self'`.
- Los iconos de IN-089 están en `public/marca/`, con su `manifest-iconos.json` (app claro 192 y 512, maskable claro 192 y 512, y el SVG).
- `Base.astro` ya enlaza el favicon, el PNG de 32, el `apple-touch-icon` de 180 y los dos `theme-color`.
- `espacio/instalar.ts` guarda el `beforeinstallprompt` y la bienvenida (`PrimerUso`) ofrece «Instalar Rimor» cuando lo hay. Hasta ahora nunca llegaba: no había manifest ni service worker.
- La señal `sin-conexion` ya existe (`estadosSenal.ts` y `senal.css`, IN-041); la usa la ficha de un enlace sin enriquecer.
- `dist/_astro` pesa unos 79 MB, casi todo DuckDB: dos `.wasm` de 36 y 41 MB y dos workers de unos 800 KB. Además están las extensiones Parquet en `public/duckdb/`.
- El compositor recibe lo de fuera con `useCompositor.getState().recibir(texto, archivos)`.

## Diseño

### Dependencias

`@vite-pwa/astro` 1.2.0 (2025-11-27) y `vite-plugin-pwa` 1.3.0 (2026-05-05), más `workbox-precaching`, `workbox-routing`, `workbox-strategies` y `workbox-expiration` 7.4.1 (2026-05-04) para el service worker propio. Todas con versión exacta y publicadas hace más de dos semanas. Sin `workbox-window`: el registro y el aviso de actualización son unas líneas propias (menos peso en la carga inicial).

### Service worker (`src/pwa/sw.ts`, estrategia `injectManifest`)

- **Precarga del núcleo**: todo el HTML, el JS, el CSS, las fuentes y los iconos de `dist/`, menos DuckDB (`*.wasm`, `duckdb-browser-*.worker*.js` y `duckdb/`). Con eso, la app abre y captura sin red.
- **Caché bajo demanda de los WASM**: lo de DuckDB, la primera vez que se usa, con `CacheFirst` en `rimor-wasm` (como mucho 8 entradas). Sin red y sin haberlo usado nunca, los datos tabulares dicen que no pueden cargar su motor (como hoy).
- **Navegación**: cualquier navegación dentro del alcance devuelve el `index.html` precargado. El enrutado va por hash: no hay más páginas.
- **Compartir** (POST a `compartir`):
  - lee el `FormData` (`titulo`, `texto`, `url`, `archivos`);
  - lo guarda en la caché `rimor-compartido`: un JSON y cada archivo como su respuesta;
  - redirige con un 303 a la app con `?compartido`.
  - La lógica, pura y probada, está en `src/pwa/compartir.ts`.
- **Actualización**: con `registerType: 'prompt'`, el nuevo espera hasta que la app le pide `SALTAR_ESPERA`.

### Manifest

- `name` y `short_name` «Rimor», `description`, `lang: 'es'`, `display: 'standalone'`, `start_url` y `scope` `./`.
- `theme_color` `#E8E6E1` y `background_color` `#F6F5F1`.
- Los iconos de `manifest-iconos.json`, con la ruta de `marca/`.
- `share_target`: `action: 'compartir'`, `method: 'POST'`, `enctype: 'multipart/form-data'`, y `params` con `title`, `text`, `url` y `files` (`archivos`, cualquier tipo).

### En la app

- **`src/pwa/registrar.ts`**: en producción y si hay `serviceWorker`, registra `sw.js` con el alcance de la `BASE`.
  - Si hay uno esperando (al registrar o cuando termina de instalarse uno nuevo con la app ya controlada), lo anota en `useActualizacion`.
  - `actualizar()` le manda `SALTAR_ESPERA` y recarga al cambiar de controlador.
- **Aviso** «Hay una versión nueva.» con el botón «Actualizar»: en la carcasa, junto a los avisos del almacenamiento, como banner. No es un aviso efímero porque espera a que el usuario quiera.
- **Recoger lo compartido** (`recogerCompartido`):
  - Al arrancar con `?compartido`, lee la caché, la vacía y quita `?compartido` de la URL.
  - Rellena el compositor (`recibir`) con el texto: el título, el texto y la URL sin repetir, porque Android suele poner la URL también en el texto. Los archivos van como `File`.
  - No guarda nada: como un pegado, se guarda con Enter.
- **Sin conexión** (`useEnLinea`): `navigator.onLine` y los eventos `online` y `offline`. Sin red, en el pie del raíl aparece, debajo de la copia, `<Senal estado="sin-conexion">` y «Sin conexión».
- **Instalación sugerida**: ya la ofrece la bienvenida cuando el navegador lo permite. Con el manifest y el service worker, el aviso llega.

### Construcción

- `astro.config.mjs` añade la integración.
- `comprobar-dist` comprueba que existen `manifest.webmanifest` y `sw.js`, que el HTML enlaza el manifest con la `BASE` y que la precarga no lleva `.wasm`.
- `tamano-carga` no cuenta el service worker, porque no lo carga la portada.

## Tareas

- [x] vite-plugin-pwa con precarga del núcleo y caché bajo demanda de los WASM.
- [x] Manifest con los iconos de IN-089, `theme_color` `#E8E6E1` y `background_color` `#F6F5F1`.
- [x] Actualización con aviso «Hay una versión nueva».
- [x] Web Share Target (texto, URL y archivos) que abre el compositor relleno.
- [x] Instalación sugerida en el primer uso.
- [x] Estado `sin-conexion` en el pie del raíl cuando no hay red (ya en `senal.css`).

## Pruebas previstas

- `compartir.ts`:
  - del `FormData` a lo guardado y de lo guardado al compositor: texto sin repetir, archivos con su nombre y tipo, y vacío;
  - la caché se vacía al recogerla;
  - la respuesta 303.
- `registrar.ts`, con un `navigator.serviceWorker` falso:
  - uno esperando y uno nuevo instalado avisan;
  - `actualizar` manda `SALTAR_ESPERA`;
  - en desarrollo no registra.
- Carcasa: el banner con «Actualizar»; el pie del raíl sin red (eventos `offline` y `online`).
- Arranque con `?compartido`: el compositor relleno y la URL limpia.
- `comprobar-dist`: el manifest con sus colores, sus iconos y `share_target`; `sw.js`; precarga sin `.wasm`.

## Criterios de aceptación

- `pnpm verificar` en verde.
- `dist/` lleva `manifest.webmanifest` y `sw.js` con la precarga del núcleo (sin DuckDB).
- La validación en un navegador real queda en «Pendientes de validación humana»: instalación en Android con el icono maskable sin recortar (zona segura del 80 %) y el `apple-touch-icon` de 180 en iOS, uso sin conexión y Compartir desde otra app. Por la instrucción del autor, por ahora no se usa Playwright.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| 79 MB de DuckDB en la precarga | Fuera: bajo demanda, en su propia caché. |
| Un service worker viejo que sirve una versión rota | `prompt`: la nueva solo entra cuando se acepta; la precarga va por hash de contenido. |
| La CSP en `<meta>` y el service worker | El SW es del mismo origen (`worker-src 'self'`) y el manifest también (`manifest-src 'self'`). |
| Compartir sin service worker (no instalada) | No pasa: el navegador solo ofrece la app como destino cuando está instalada. |
| Tipos de TypeScript del service worker (`WebWorker` frente a `DOM`) | Se declara `self` como `ServiceWorkerGlobalScope` en `sw.ts`; la lógica que se prueba, en módulos sin tipos de worker. |

## Autorrevisión

Cubre las seis tareas. Reutiliza los iconos y el `theme-color` de IN-089, la señal `sin-conexion`, el aviso de instalar de IN-039, el banner de la carcasa y el `recibir` del compositor. Lo nuevo:

- la integración y el service worker;
- `compartir.ts` y `registrar.ts`, puros o con dependencias inyectadas;
- el aviso de actualización y el pie del raíl sin conexión.

## Implementación

- `astro.config.mjs`: la integración `@vite-pwa/astro` con `injectManifest` (`src/pwa/sw.ts`), `registerType: 'prompt'` y `injectRegister: false`. El manifest toma los iconos de `public/marca/manifest-iconos.json` y lleva el `share_target`. La precarga es `**/*.{html,js,css,woff2,svg,png,json,webmanifest}` sin `*.wasm` ni DuckDB (127 entradas, unos 3,4 MB).
- `src/pwa/sw.ts`:
  - compartir (POST);
  - `SALTAR_ESPERA`;
  - la precarga;
  - la navegación al `index.html` precargado (`@vite-pwa/astro` lo precarga con la URL del alcance);
  - DuckDB con `CacheFirst` en `rimor-wasm`.
- `src/pwa/compartir.ts`: guardar y recoger lo compartido, el texto sin repetir y `esDuckdb`.
- `src/pwa/recibir.ts`: lo compartido, al compositor, y la URL limpia.
- `src/pwa/registrar.ts`: el registro, `useActualizacion` y `actualizar`.
- `src/pwa/enLinea.ts`: `useEnLinea`.
- `Base.astro`: `<link rel="manifest">`.
- `AvisoVersion` en la carcasa y «Sin conexión» con la señal en el pie del raíl.
- `scripts/comprobar-dist.mjs`: `validarPwa` comprueba los colores, los iconos, el `share_target`, que la precarga no lleve DuckDB y que precargue la portada con la `BASE`.
- Pruebas: `compartir.test.ts`, `recibir.test.ts`, `registrar.test.ts`, la carcasa (sin red, versión nueva) y `comprobar-dist.test.mjs`.

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| La portada se precarga con la URL del alcance (`/` o `/rimor/`), no como `index.html` | Así la escribe `@vite-pwa/astro`; `createHandlerBoundToURL` usa esa URL. |
| La CSP se añade después de generar el service worker | La revisión de la portada es un dato para saber si cambió: lo que se precarga es el archivo publicado (con su CSP). Si cambian los scripts en línea, cambia también la construcción de Astro. |
| Sin `workbox-window` | El registro y el aviso son unas 40 líneas propias, probadas con un contenedor falso. |
| Tipos del ámbito del worker declarados a mano en `sw.ts` | La `lib` de WebWorker choca con la del DOM del resto del proyecto. Los tipos de Workbox no se escribieron con `exactOptionalPropertyTypes`: una conversión en el plugin de caducidad. |

## Verificación

- `pnpm verificar` en verde (ver `docs/seguimiento.md`).
- Revisión independiente (19 hallazgos), atendidos con pruebas salvo donde se dice:
  1. **La revisión de la portada en la precarga era la del HTML sin la CSP**: un cambio solo de la política no llegaba nunca a una app instalada. Ahora `csp.mjs` la recalcula con el archivo final (`conRevisionPortada`) y `validarPwa` comprueba que coincide.
  2. **Varias pestañas**: si una pulsaba «Actualizar», las demás se quedaban con el código viejo bajo el service worker nuevo. Ahora lo saben («Hay una versión nueva: recarga para usarla.» y «Recargar»), y «Actualizar» con una versión ya activada solo recarga. El estado (`pedida`) está en el almacén, no en el módulo.
  3. **«Sin conexión» no se veía en el móvil** (el pie del raíl está oculto): un aviso arriba, que el CSS solo enseña en estrecho.
  4. **Lo compartido entraba en una pestaña de solo lectura** (y se perdía): se recoge desde la carcasa con el espacio abierto. En solo lectura espera, con un aviso; además, `launch_handler: navigate-existing`.
  5. **Un compartir que fallaba** dejaba restos sin avisar: `atenderCompartir` vacía la caché y vuelve con `?compartido=error`, y la app dice «No se pudo recibir lo compartido.». Al recoger, los restos sin datos se borran.
  6. La señal del raíl pedía el turno de animación como principal: ahora como secundaria.
  7. **Nadie buscaba versiones nuevas** con la app abierta: `update()` al volver a la pestaña y cada hora. Una versión que ya se instalaba al registrar también avisa.
  8. **La caché de DuckDB** va por su versión (`rimor-wasm-v1.5.4`): las de otras versiones se borran al activarse, solo atiende el propio origen y se purga si falta cuota.
  9. Parquet sin red (la extensión se carga con una petición síncrona desde el worker de DuckDB): queda en «Pendientes de validación humana».
  10. El manifest se precargaba dos veces: fuera del glob; `validarPwa` comprueba que no hay entradas repetidas. También fuera el límite de 5 MB, que no hacía falta.
  11. `replaceState` borraba el estado del enrutado por hash: ahora lo conserva.
  12. **Pruebas que faltaban**: el POST y el 303 (`atenderCompartir`), el camino de fallo, «en desarrollo no registra», la revisión de la portada, la búsqueda de versiones y el estado entre pruebas.
  13. **Accesibilidad**: una región viva siempre montada en la carcasa anuncia «Hay una versión nueva.» y «Sin conexión».
  14. «Actualizar» se deshabilita con adjuntos sin guardar en el compositor o con una exportación en marcha, y dice por qué.
  15. El manifest lleva `id: './'`. Sigue con `lang: 'es'`: la app es bilingüe, pero el nombre y la descripción no cambian.
  16. La navegación a un archivo (`sw.js`, el manifest, los iconos, DuckDB) ya no devuelve la app (`denylist`).
  17. **El `apple-touch-icon` de 180 tenía esquinas transparentes**, que iOS rellena de negro: `rimor-apple-touch-180.png`, opaco con el fondo `#F6F5F1` (generado del de IN-089 y guardado en el repositorio).
  18. **«Instalar Rimor» también en Ajustes**, y `appinstalled` quita el aviso caducado.
  19. **No se atiende**: lo compartido no es de ningún espacio, y no hay un «borrado total». La caché se vacía al recogerlo o con el siguiente compartir.
