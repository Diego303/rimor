# IN-014 · Flujo de captura

## Objetivo y catálogo

De pegar a ver el elemento en menos de 300 ms, siempre igual. Catálogo: **CAP-01** (pegar en cualquier pantalla), **CAP-02** (soltar archivos), **ORG-05** (duplicados exactos). Depende de IN-005 (repositorio), IN-010 (secretos), IN-012 (lectores y cola de derivados) e IN-013 (detector).

## Estado de partida

- `Repositorio`: `guardarElemento`, `guardarAdjunto` (por hash, sin duplicar), `actualizarElemento`, `elementos()`, avisos de cambio (el raíl se repinta) y guarda de solo lectura.
- `ocultar(texto)` → `{ texto, hallados }` (IN-010).
- `detectar(entrada, registro, { cabecera })` (IN-013) y `REGISTRO` (vacío hasta IN-017).
- `ColaDerivados.pedir(el, { prioridad: 'fondo' })` (IN-012).
- `@rimor/formato`: `asignarRef`, `hashOriginal` (sobre el original normalizado), `LIMITE_ORIGINAL_EN_MD` (2 MB), `rutaAdjunto`, `isoConZona`, `ulid`.
- Avisos efímeros (`useAvisos`) sin acción todavía.

## Diseño

### Módulos

```
src/captura/flujo.ts        ← capturar(entrada, efectos): los 8 pasos, sin React ni navegador (efectos inyectados)
src/captura/entrada.ts      ← normalizar: texto, archivos y portapapeles → EntradaCaptura; leer texto o bytes de un File
src/captura/compositor.ts   ← store (Zustand) del borrador del compositor: texto y archivos pendientes (lo pinta IN-015)
src/captura/Captura.tsx     ← ProveedorCaptura: pegar fuera de un campo, soltar archivos, aviso «Guardado. Deshacer»
src/ui/componentes/Avisos.tsx ← avisos con una acción y duración propia
```

### `capturar(entrada, efectos)` (plan §14.5, en este orden)

`EntradaCaptura = { texto?: string; archivo?: File; origen: 'pegado' | 'soltado' | 'compartido'; tipo?: TipoElemento; colecciones?: string[]; etiquetas?: string[]; hilo?: Ref }`, una captura por llamada (varios archivos = varias llamadas, de una en una).

`EfectosCaptura = { repositorio, registro, reloj, nuevoId, cola?, opcionesSecretos? }`.

1. **Normalizar.** Un archivo de más de 50 MB se rechaza (`captura.demasiadoGrande`, con el tamaño y el límite). Un archivo se lee entero y pasa por `entradaDeArchivo` (IN-013): si es texto (sin firma binaria, UTF-8 y sin bytes nulos), también lleva su texto; siempre, sus primeros 1.024 bytes como `cabecera` para el detector.
2. **Ocultar secretos** en todo lo que sea texto, antes de nada más. Se cuenta `ocultados`.
3. **Detectar** (salvo `tipo` forzado). Lector: el detectado (un binario ya llega al suyo o al genérico de archivo); si viene forzado, el de ese tipo. Si el tipo no tiene lector, el de reserva: `texto` para texto y `archivo` para binarios. Sin ninguno registrado, `captura.sinLector` (no pasará desde IN-017). La duda (`alternativa`) se devuelve para que la interfaz ofrezca cambiar el tipo.
4. **Duplicado exacto:** mismo `hash` que un elemento que no está en la papelera → no se crea; se devuelve `{ duplicado: ref }` para avisar y llevar al existente. El hash es el de `hashOriginal` del texto ya ocultado o, para binarios, el SHA-256 de los bytes (`sha256:` + hex).
5. **Indicaciones:** colecciones y etiquetas (sin repetir, en su orden) y `hilo`.
6. **`leer`** del lector → `Borrador`; título del borrador (o el nombre del archivo, o la primera línea, recortado a 120); un original de más de 2 MB o un binario van como **adjunto** (`guardarAdjunto`, `frontmatter.adjunto` con hash, ruta, nombre, MIME y tamaño) y `original: null`. Ref nueva con `asignarRef` sobre todas las refs conocidas (también las de la papelera). Fechas con la zona del usuario. Se escribe con `guardarElemento`.
7. **Publicar:** el repositorio avisa del cambio (raíl, recuentos) y `capturar` devuelve el `Elemento`, que la interfaz pinta al instante con su resumen provisional.
8. **Derivar** en segundo plano: `cola.pedir(el, { prioridad: 'fondo' })` sin esperar; la respuesta de Rimor la compone IN-016 con esos datos.

Resultado: `{ ok: true, elemento, alternativa?, adjuntoNuevo }` | `{ ok: true, duplicado: Ref }` | fallo con código (`captura.vacia`, `captura.demasiadoGrande`, `captura.sinLector`, `almacen.soloLectura`).

**Deshacer** (`deshacerCaptura(resultado, repositorio)`): borra el elemento recién creado (nuevo `Repositorio.borrarElemento`, definitivo, en su turno) y su adjunto si lo creó esta captura.

### En la interfaz (`ProveedorCaptura`, dentro de la carcasa)

- **Pegar fuera de un campo de texto** (`paste` en `document`, ignorado si el foco está en un campo, en un diálogo abierto o si el portapapeles está vacío): el texto y las imágenes pasan al borrador del compositor (`useCompositor`) y se navega a Inicio. No guarda directamente (lo hace el compositor de IN-015, que llama a `capturar`).
- **Soltar archivos sobre cualquier pantalla:** mientras se arrastra, una capa «Suelta para guardar» sobre la zona principal; al soltar, cada archivo pasa por `capturar` de uno en uno (con su lector o el genérico). Al terminar, un aviso: «Guardado» (o «Guardados 3») con **Deshacer** durante 10 s, «Ya estaba guardado: LOG-0042» para duplicados y el motivo para los rechazados (más de 50 MB).
- En una pestaña de solo lectura, ni pegar ni soltar hacen nada más que avisar.

### Avisos con acción

`avisar(texto, { accion?: { etiqueta, alPulsar }, duracionMs? })`. La píldora (`.toast`) lleva el botón; la región viva anuncia el texto. Con acción, dura 10 s.

## Tareas

- [ ] Flujo como función pura con efectos inyectados (almacén, caché, índice, reloj) para probarlo sin navegador.
- [ ] Pegar fuera de un campo de texto, en cualquier pantalla, lleva el contenido al compositor (no guarda directamente).
- [ ] Soltar archivos sobre cualquier pantalla: los guarda uno a uno con su lector (o el genérico).
- [ ] Límite de 50 MB por archivo con un aviso que lo explica.
- [ ] Deshacer la última captura durante 10 s («Guardado. Deshacer»).

## Pruebas previstas

- `capturar` con `AlmacenMemoria` y lectores falsos: orden de los pasos (el lector recibe el texto ya ocultado; el hash es del texto ocultado), tipo forzado, lector de reserva, duda, duplicado (no crea y devuelve la ref), indicaciones, original grande y binario como adjunto, archivo de más de 50 MB, vacío, solo lectura, derivado de fondo pedido, deshacer (también del adjunto nuevo y no del compartido).
- De extremo a extremo con el corpus de `fixtures/deteccion/` (cada ejemplo se guarda con el tipo esperado y se relee igual).
- 20 pegados seguidos sin esperar: 20 elementos con refs distintas.
- Tiempo: pegar 100 KB → elemento guardado y publicado; p95 de 20 repeticiones por debajo de 300 ms con el almacén en memoria (en el navegador, pendiente de validación humana).
- Interfaz (happy-dom): pegar fuera de un campo llena el borrador y no guarda; dentro de un campo, nada; soltar dos archivos crea dos elementos y avisa con Deshacer, que los borra; un archivo de 51 MB se rechaza con su aviso.

## Criterios de aceptación

- Pegar 100 KB → visible en < 300 ms (p95): prueba con el almacén en memoria; en el portátil de referencia, pendiente de validación humana.
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| El plan (CAP-01) dice que pegar crea el elemento; la ficha, que lleva al compositor | Se sigue la ficha (es posterior y coherente con Inicio como chat) |
| Duplicado que está en la papelera | No cuenta: se crea uno nuevo (la papelera se vacía) |
| Varias capturas a la vez reciben la misma ref | `capturar` se serializa con una cola propia: la ref se asigna y se guarda dentro del mismo turno |
| Deshacer cuando ya se ha editado el elemento | Se borra igual (son 10 s); si el elemento ya no existe, no hace nada |
| Leer un archivo binario grande en el hilo principal | Hasta 50 MB con `arrayBuffer()`, que no bloquea; el hash es síncrono (aceptado en v0.1, medido en IN-040) |

## Autorrevisión

Cubre las cinco tareas y los ocho pasos en orden. El compositor (IN-015) y el feed (IN-026) se apoyan en `capturar`, `useCompositor` y la cola; la respuesta (IN-016), en el derivado de fondo. El índice de búsqueda (IN-032) se pondrá al día escuchando los cambios del repositorio, así que `capturar` no lo toca.
