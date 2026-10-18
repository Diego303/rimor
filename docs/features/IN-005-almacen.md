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
