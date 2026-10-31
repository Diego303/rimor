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

- [ ] vite-plugin-pwa con precarga del núcleo y caché bajo demanda de los WASM.
- [ ] Manifest con los iconos de IN-089, `theme_color` `#E8E6E1` y `background_color` `#F6F5F1`.
- [ ] Actualización con aviso «Hay una versión nueva».
- [ ] Web Share Target (texto, URL y archivos) que abre el compositor relleno.
- [ ] Instalación sugerida en el primer uso.
- [ ] Estado `sin-conexion` en el pie del raíl cuando no hay red (ya en `senal.css`).

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
