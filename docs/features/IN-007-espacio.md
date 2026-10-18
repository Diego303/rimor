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

- [ ] Crear espacio: `manifest.json` del Anexo A.
- [ ] `persist()` con explicación previa; guardar el resultado.
- [ ] `estimate()` para el espacio usado.
- [ ] Detección de ventana privada y aviso persistente.
- [ ] Registro de la última copia y de los cambios desde entonces.
- [ ] Pantalla de arranque con `arranque` y `cargando`.

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
