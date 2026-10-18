# IN-005 · Almacén OPFS y en memoria

## Objetivo y catálogo

Guardar y leer archivos del espacio de forma fiable y rápida, sin bloquear la interfaz. Catálogo: **DAT-01**. Depende de IN-004 y F0-1.

## Estado de partida

- IN-004: `@rimor/formato` con `leerElemento`, `escribirElemento`, `rutaElemento`, `rutaAdjunto`, `sha256Hex` y `Resultado`.
- F0-1: sin medidas reales (pendiente de validación humana); decisión tomada: adaptador OPFS en un Worker dedicado con `createSyncAccessHandle` y Comlink, `createWritable()` como respaldo; carpetas por fecha y lectura por lotes.

## Diseño

### Interfaz

```ts
interface EntradaAlmacen { ruta: string; tam: number; modificado: number }
interface Almacen {
  leer(ruta: string): Promise<Uint8Array | null>;
  escribir(ruta: string, datos: Uint8Array): Promise<void>;   // atómica
  mover(de: string, a: string): Promise<void>;
  borrar(ruta: string): Promise<void>;
  listar(prefijo: string): AsyncIterable<EntradaAlmacen>;
  existe(ruta: string): Promise<boolean>;
}
```

Las rutas son relativas a la raíz del espacio, con `/` y sin `..` ni `/` inicial (`validarRuta` lo comprueba y lanza: una ruta mala es un error de programación, no un caso esperado).

### Módulos

```
src/almacen/contrato.ts        ← Almacen, EntradaAlmacen, validarRuta, utilidades de texto (leerTexto, escribirTexto)
src/almacen/memoria.ts         ← AlmacenMemoria (pruebas y espacio de ejemplo)
src/almacen/opfs/opfs.ts       ← AlmacenOpfs sobre un FileSystemDirectoryHandle (corre dentro del Worker)
src/almacen/opfs/cliente.ts    ← crearAlmacenOpfs(espacio): proxy Comlink con la interfaz Almacen
src/workers/almacen.worker.ts  ← expone AlmacenOpfs con Comlink
src/almacen/cola.ts            ← ColaEscrituras: serializa por ruta y agrupa escrituras seguidas
src/almacen/repositorio.ts     ← Repositorio: elementos, papelera, adjuntos e índice id/ref → ruta
src/almacen/pestanas.ts        ← coordinarPestanas(): una escribe, las demás leen (Web Locks y BroadcastChannel)
src/almacen/almacen.suite.ts   ← el mismo conjunto de pruebas para cualquier Almacen
src/pruebas/opfs-falso.ts      ← OPFS en memoria (directorios, archivos, sync handles y move) para probar AlmacenOpfs en Node
```

### Escritura atómica

`escribir(ruta, datos)`: escribe en `ruta.tmp` (truncar, escribir, `flush`, cerrar) y lo renombra a `ruta` con `FileSystemHandle.move()`. Si el navegador no tiene `move`, copia el temporal sobre el destino y borra el temporal (garantía menor, documentada). Al abrir el espacio, `limpiarHuerfanos()` borra los `.tmp`: o bien el destino ya está completo, o la escritura no terminó y el archivo sigue en su versión anterior.

### Cola de escrituras

`ColaEscrituras` envuelve un `Almacen`: las escrituras de una misma ruta van de una en una; si llegan varias mientras una está en curso, solo se escribe la última (y todas las promesas se resuelven cuando acaba). `mover` y `borrar` esperan a las escrituras pendientes de sus rutas.

### Repositorio

```ts
class Repositorio {
  constructor(almacen: Almacen);
  cargar(): Promise<void>;                                  // recorre elementos/ y arma el índice id/ref → ruta
  guardarElemento(el: Elemento): Promise<string>;           // ruta; si cambió el título o la ref, renombra (el id no cambia)
  leerElemento(refOId: string): Promise<Resultado<Elemento>>;
  moverAPapelera(refOId: string): Promise<Resultado<void>>; // papelera/<ruta original>
  restaurar(refOId: string): Promise<Resultado<void>>;
  vaciarPapelera(): Promise<void>;
  guardarAdjunto(bytes: Uint8Array, extension: string): Promise<{ hash: string; ruta: string }>; // sin duplicados
  elementos(): IterableIterator<{ id: string; ref: string; ruta: string }>;
}
```

Al reescribir, `guardarElemento` pasa el texto anterior a `escribirElemento(el, previo)` para conservar el YAML tal como estaba. El índice en memoria lo llenará más rápido la caché de IN-006; aquí se arma leyendo los archivos.

### Varias pestañas

`coordinarPestanas(espacioId, { locks, canal })` pide el cerrojo `rimor:<espacio>` con `ifAvailable`. Si lo obtiene, es la pestaña que escribe y lo retiene; si no, queda en **solo lectura** y espera el cerrojo en segundo plano para pasar a escribir cuando la otra se cierre. Por `BroadcastChannel` avisa de los cambios para que las de solo lectura recarguen. Devuelve `{ modo, alCambiarModo, avisar, cerrar }`. La interfaz (aviso «Rimor está abierto en otra pestaña») llega con la carcasa.

## Tareas

- [ ] Adaptador en memoria.
- [ ] Adaptador OPFS en un Worker con `createSyncAccessHandle` y Comlink.
- [ ] Escritura atómica y limpieza de `.tmp` huérfanos.
- [ ] Cola de escrituras por ruta, con agrupado.
- [ ] Repositorio: guardar, leer por ref o id, papelera, restaurar y adjuntos sin duplicados.
- [ ] Renombrado al cambiar el título.
- [ ] Coordinación entre pestañas.

## Pruebas previstas

- El mismo conjunto de pruebas contra `AlmacenMemoria` y `AlmacenOpfs` (con el OPFS falso).
- Interrupción a mitad de escritura (el OPFS falso falla tras escribir parte del temporal): el archivo sigue en su versión anterior; al limpiar huérfanos, queda bien.
- Cola: diez escrituras seguidas de la misma ruta escriben menos veces y dejan la última; rutas distintas no se bloquean.
- Repositorio: renombrado al cambiar título, papelera y restauración, adjunto duplicado que no se reescribe, lectura por ref y por id.
- Pestañas: con un cerrojo falso, la segunda queda en solo lectura y pasa a escribir al liberarse.
- 5.000 elementos: listado y lectura completa (en memoria y con el OPFS falso) en tiempos razonables; la medida real en navegador sigue pendiente (F0-1).

## Criterios de aceptación

- Cerrar la pestaña durante una escritura no corrompe nada (escritura atómica, probada con la interrupción simulada).
- Dos pestañas no escriben a la vez (cerrojo).
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `move()` no está en todos los navegadores | Respaldo copiar y borrar, documentado; la limpieza de `.tmp` cubre el corte |
| Comlink no transfiere iteradores asíncronos | El Worker devuelve listas y el cliente las expone como `AsyncIterable` |
| Sin navegador para probar OPFS | OPFS falso fiel a la API (incluido `createSyncAccessHandle`) y validación humana pendiente |

## Autorrevisión

Cubre la ficha. El índice en memoria del repositorio se sustituirá por la caché de IN-006 sin cambiar su interfaz.

## Cambios durante la implementación

- Los tipos de DOM de TypeScript declaran `createSyncAccessHandle` aunque solo exista en Workers: el adaptador usa un tipo propio (`Archivo`) con los métodos opcionales (`createSyncAccessHandle`, `createWritable`, `move`) y comprueba cada uno antes de usarlo.
- `mover` en OPFS es leer, escribir (atómico) en el destino y borrar el origen: `move()` entre carpetas distintas no está en todos los navegadores, y así la operación siempre es segura.
- El OPFS falso no implementa `createWritable` (el camino de respaldo de los navegadores sin `createSyncAccessHandle`): queda para la validación humana en navegador.
- El cliente (`crearAlmacenOpfs`) y el Worker aún no los usa ninguna pantalla: los conecta IN-007 al abrir el espacio.

## Verificación

**`pnpm verificar`** (2026-10-18 05:30): tipos 0 errores; Biome, colores y textos, OK; Vitest 16 archivos y 157 pruebas (43 del almacén), OK; construcción OK; carga inicial 76,5 KB.

| Criterio | Evidencia |
|---|---|
| Mismo conjunto de pruebas contra los dos adaptadores | `almacen.suite.ts` contra memoria, OPFS, OPFS sin `move()` y la cola |
| Interrupción a mitad de escritura: versión anterior o nueva, nunca a medias | Con `move()`: corte al escribir el temporal → versión anterior. Sin `move()`: corte en el temporal → anterior; corte al copiar sobre el destino → `limpiarHuerfanos` termina la copia con el temporal completo |
| Cola serializada con agrupado | Diez escrituras seguidas → como mucho dos reales y queda la última; no agrupa si hay un borrado o un movimiento en medio; lecturas tras un movimiento ven el destino; movimientos cruzados terminan |
| Repositorio: guardar, leer por ref o id, papelera, restaurar, adjuntos sin duplicados, renombrado | `repositorio.test.ts`, incluido un renombrado cortado entre escribir y borrar que `cargar` termina con el diario |
| Dos pestañas no escriben a la vez | `pestanas.test.ts`: la segunda queda en solo lectura y pasa a escribir cuando la primera suelta el cerrojo. La limpieza de huérfanos ya no la hace `abrir()`: solo la pestaña con el cerrojo (IN-007) |
| 5.000 elementos | Escritos, listados y leídos en memoria y en el OPFS falso en menos de 5 s; la medida en navegador sigue pendiente (F0-1) |

### Revisión independiente

Hallazgos, todos corregidos con prueba:

1. **Sin `move()` la escritura no era atómica** (un corte al copiar sobre el destino lo dejaba a medias y la limpieza borraba la única copia buena): ahora hay un diario de dos fases con la marca `.rimor-ok`; la limpieza rehace la copia si hay marca y borra el temporal si no la hay.
2. **La cola agrupaba escrituras separadas por un borrado**, **`mover` solo esperaba al origen** (escrituras posteriores al destino se perdían y una lectura veía datos viejos) y **dos movimientos cruzados se bloqueaban**: la cola es ahora una FIFO única; solo agrupa con la última operación de esa ruta si es una escritura que no ha empezado, y las lecturas esperan a las operaciones que tocan su ruta.
3. **Un archivo legítimo terminado en `.tmp` desaparecía**: los auxiliares usan sufijos reservados (`.rimor-tmp`, `.rimor-ok`) que `validarRuta` rechaza.
4. **Un corte entre escribir el destino y borrar el origen dejaba dos copias** (renombrar, papelera, restaurar): el repositorio anota cada operación de varios pasos en `.rimor/operacion.json` y `cargar` la termina; `restaurar` sobre una copia del mismo elemento ya no queda bloqueado, y dos archivos con el mismo id se avisan (`almacen.duplicado`) quedándose el que está en su sitio.
5. **Una pestaña lectora limpiaba temporales de la escritora**: `abrir()` ya no limpia; `limpiarHuerfanos()` es aparte y la llama solo quien tiene el cerrojo.
6. **El OPFS falso no imitaba el bloqueo exclusivo** de `createSyncAccessHandle`: ahora lanza `NoModificationAllowedError` como el real, y el adaptador ejecuta sus operaciones de una en una (prueba con lecturas y escrituras simultáneas del mismo archivo).
