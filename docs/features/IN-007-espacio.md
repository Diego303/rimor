# IN-007 · Espacio de trabajo y persistencia

## Objetivo y catálogo

Crear y abrir espacios, y hacer todo lo posible para que el navegador no borre los datos. Catálogo: **DAT-06**. Depende de IN-005, IN-090 y F0-1.

## Estado de partida

- IN-005: `crearAlmacenOpfs(espacio)` (Worker con OPFS), `AlmacenMemoria`, `ColaEscrituras`, `Repositorio`, `coordinarPestanas` y `limpiarHuerfanos` (solo con el cerrojo).
- IN-006: `CacheEspacio.abrir`, `reconciliar` (con progreso) y `Repositorio.cargarDesde`.
- IN-008: `useEspacio` (lo que pinta el raíl) y la carcasa.
- IN-090: `<Senal estado="arranque">` y `cargando`, `useEsperaVisible` y `Espera`.
- F0-1: sin medidas de navegador; pedir `persist()` con explicación previa y nunca bloquear.

## Diseño

### Módulos

```
src/espacio/manifest.ts     ← crearManifest(nombre, reloj): el manifest.json del Anexo A (esquema 1)
src/espacio/estado.ts       ← .rimor/estado.json: persistencia pedida y su resultado, última copia y cambios desde entonces (puro)
src/espacio/persistencia.ts ← pedirPersistencia(), estaPersistido(), espacioUsado() y esVentanaPrivada() sobre navigator.storage (inyectable)
src/espacio/abrir.ts        ← abrirEspacio(dependencias, alProgreso): orquesta lo de abajo
src/espacio/Espacio.tsx     ← ProveedorEspacio (contexto con el repositorio y el estado) y pantalla de arranque
```

### Abrir (o crear) el espacio

`abrirEspacio({ almacen, cache, cerrojos, canal, reloj }, alProgreso)`:

1. Coordina pestañas (IN-005). Si esta pestaña escribe, termina o deshace las escrituras cortadas (`limpiarHuerfanos`, si el almacén lo tiene).
2. Si no hay `manifest.json`, **crea el espacio**: manifest del Anexo A (`formato: rimor`, `esquema: 1`, id ULID, nombre «Trabajo», fecha de creación y versión de la app) y `.rimor/estado.json`. Una pestaña de solo lectura no crea nada.
3. Abre la caché y reconcilia, avisando del progreso («Indexando 4.210 de 10.000»).
4. Llena el `Repositorio` (que avisa de cada cambio para contar los cambios desde la última copia) y el store `useEspacio`.

En la app, `almacen` es el OPFS del Worker con `ColaEscrituras` encima, bajo `espacios/<id>/`. Qué espacio se abre: el último usado (`localStorage` «rimor:espacio»); si no hay, se crea uno. Si OPFS no está disponible (navegador antiguo o ventana privada de Firefox), se abre un **espacio en memoria** con aviso permanente.

### Persistencia

- Al crear el primer espacio, Inicio muestra una tarjeta que explica por qué conviene proteger los datos y un botón «Proteger los datos» que llama a `navigator.storage.persist()` (Firefox pregunta; los navegadores lo conceden mejor si la petición nace de un gesto). El resultado se guarda en `.rimor/estado.json` y se mostrará en Datos y copias (IN-037).
- `navigator.storage.estimate()` da el espacio usado.
- **Ventana privada:** se considera privada si OPFS falla al abrirse o si la cuota es menor de 150 MB. Aviso persistente en la carcasa.

### Última copia

`.rimor/estado.json`: `{ esquema: 1, persistencia, pedidaEn, ultimaCopia, cambiosDesdeCopia }`. Cada cambio del repositorio suma uno; la exportación (IN-035) lo pondrá a cero y fijará `ultimaCopia`.

### Pantalla de arranque

Mientras se abre el espacio, si tarda más de 400 ms aparece `<Senal estado="arranque" veces={1}>`; si al acabar la animación (3,6 s) sigue abriendo, pasa a `<Senal estado="cargando">` con el texto de lo que se está haciendo.

## Tareas

- [x] Crear espacio: `manifest.json` del Anexo A.
- [x] `persist()` con explicación previa; guardar el resultado.
- [x] `estimate()` para el espacio usado.
- [x] Detección de ventana privada y aviso persistente.
- [x] Registro de la última copia y de los cambios desde entonces.
- [x] Pantalla de arranque con `arranque` y `cargando`.

## Pruebas previstas

- `abrirEspacio` con `AlmacenMemoria`, `fake-indexeddb` y cerrojos falsos: crea el espacio la primera vez, lo reabre sin recrearlo, avisa del progreso y llena repositorio y store; una segunda pestaña queda en solo lectura, no limpia ni crea.
- `estado.ts`: contar cambios y registrar una copia.
- `persistencia.ts` con un `navigator.storage` falso: concedida, denegada, sin API; ventana privada por cuota o por OPFS que falla.
- Pantalla de arranque (happy-dom, temporizadores falsos): nada antes de 400 ms; `arranque` y después `cargando` con el texto.

## Criterios de aceptación

- En Chrome con la PWA instalada, la persistencia queda concedida y se muestra (pendiente de validación humana).
- En una ventana privada, el aviso aparece (heurística probada con dobles; confirmación en navegador pendiente).
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `persist()` sin gesto puede denegarse en silencio | Se pide con un botón |
| La heurística de ventana privada falla en algún navegador | Solo avisa; nunca bloquea |
| OPFS no disponible | Espacio en memoria con aviso |

## Autorrevisión

Cubre la ficha. Conecta por primera vez almacén, caché, repositorio y carcasa.

## Cambios durante la implementación

- **El id del manifest es un ULID propio**, no el nombre de la carpeta: `espacioId` («principal» o el guardado en `localStorage`) solo nombra la carpeta de OPFS y la base de la caché. Con el nombre de carpeta como id, el esquema del Anexo A rechazaba el manifest al reabrir.
- `leerManifest` va en `@rimor/formato` (junto al esquema) e `isoConZona` también: la app no depende de Valibot directamente y la CLI de v0.3 los reutilizará.
- `Repositorio` guarda el frontmatter de lo indexado (`elementos()`, `frontmatter()`) y avisa de cada cambio (`alCambiar`), con lo que el espacio cuenta los cambios desde la copia y el raíl se repinta.
- La versión de la app en el manifest sale de `package.json` (`__VERSION_APP__`, definida en `astro.config.mjs`).
- `ProveedorEspacio` recibe sus dependencias inyectadas (las pruebas usan `AlmacenMemoria` e IndexedDB aislada) y, al desmontarse a mitad de la apertura, deja que sea la propia apertura quien suelte el cerrojo y termine el Worker en su siguiente paso (cortarlo antes dejaría promesas sin resolver y el cerrojo cogido). `abrirEspacio` suelta cerrojo y caché si algo falla tras cogerlos, y una escritura fallida del estado no bloquea las siguientes.
- Si el navegador ya tiene el almacenamiento protegido (una PWA instalada), se anota «concedida» al abrir sin pedir nada.
- Avisos: `AvisoAlmacenamiento` (banner sobre la columna: en memoria, ventana privada o solo lectura) y `TarjetaPersistencia` en Inicio (con «Proteger los datos»; si se deniega, recomienda copias). El estado de persistencia completo se pinta en Datos y copias (IN-037), como en la pantalla de referencia.
- La carga inicial sube de 115,7 KB a 161,4 KB: abrir el espacio trae el formato (YAML), la caché y Comlink a la primera pantalla, que no puede pintar nada sin ellos.

## Verificación

**`pnpm verificar`** (2026-10-18 16:05): tipos 0 errores; Biome, colores y textos, OK; Vitest 31 archivos y 412 pruebas, OK; construcción OK; carga inicial 162,9 KB (límite 300 KB); `comprobar:dist` OK.

| Criterio | Evidencia |
|---|---|
| Crear espacio con el `manifest.json` del Anexo A | Prueba: crea manifest (ULID, «Trabajo», esquema 1, versión de la app) y `.rimor/estado.json`; al reabrir no lo recrea |
| `persist()` con explicación previa y resultado guardado | Pruebas de `TarjetaPersistencia` (concedida, denegada) y de la persistencia ya concedida al abrir; Chrome con PWA, pendiente de validación humana |
| `estimate()` para el espacio usado | `espacioUsado` y la tarjeta de Datos y copias (prueba con 148 MB) |
| Ventana privada y aviso persistente | Heurística probada con dobles (OPFS que falla, cuota pequeña, umbral de Chromium); en navegador, pendiente de validación humana |
| Última copia y cambios desde entonces | Pruebas de `estado.ts`, del recuento por cada cambio y de la tarjeta de Datos |
| Pantalla de arranque con `arranque` y `cargando` | Prueba con temporizadores falsos: nada antes de 400 ms, «arranque» y después «cargando» con el texto |
| `pnpm verificar` en verde | Arriba |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **La lectora que pasaba a escribir pisaba `.rimor/estado.json` y trabajaba con un índice viejo.** Ahora, al pasar a escribir, termina las escrituras cortadas, relee estado y elementos (y crea manifest y estado si faltan) antes de permitir escribir; mientras tanto el repositorio rechaza escrituras. Una lectora también relee cuando la otra pestaña avisa de un cambio (los avisos seguidos se juntan).
2. **La lectora escribía al abrir** (terminaba el diario de la otra pestaña y tocaba la caché compartida): `reconciliar` tiene un modo de solo lectura que no toca archivos ni caché.
3. **Nada impedía escribir a una lectora**: `Repositorio` acepta `puedeEscribir` y lanza `almacen.soloLectura` (`ErrorSoloLectura`) en guardar, papelera, restaurar, vaciar y adjuntos.
4. **Una escritura fallida del estado bloqueaba la apertura**: se ignora y el estado sigue en memoria.
5. **Una caché que no se abría dejaba la app sin abrir**: se borra y se rehace una vez; una lectura que falla se reintenta. El error final tiene «Reintentar» y un texto que no promete lo imposible.
6. **Un Worker que no carga dejaba el arranque colgado**: `crearAlmacenOpfs` falla con el evento `error` del Worker o a los 10 s, y lo termina; se cae al espacio en memoria (con cerrojo propio, como pestaña aislada).
7. **Lecturas de la lectora contra escrituras de la otra en OPFS**: la lectura usa `getFile()`, que no toma el cerrojo exclusivo de `createSyncAccessHandle`.
8. **Ventana privada en Chromium**: el umbral es el doble del límite del montón (`performance.memory`) cuando existe, y 150 MB si no.
9. **Manifest de un esquema más nuevo**: no se abre ni se toca (`espacio.esquemaNuevo`, con su texto).
10. **Al desmontar se soltaba el cerrojo antes de escribir lo pendiente**: `cerrar()` espera al estado y a la cola, deja de escribir y solo entonces suelta cerrojo y caché; el Worker se termina después. `coordinacion.cerrar()` vuelve a modo lector.
11. Menores: el Worker se termina si OPFS no abre; la tarjeta de persistencia no se ofrece en una pestaña lectora; se recuerda el último espacio en `localStorage`; `estado.json` se escribe al crear el espacio; la persistencia concedida se muestra en Datos y copias.

No se cambia: las carpetas del espacio no se crean vacías (OPFS las crea al escribir el primer archivo y el ZIP de IN-035 las incluirá).

