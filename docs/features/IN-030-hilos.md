# IN-030 · Hilos

## Objetivo y catálogo

Encadenar lo que va junto sin crear nada formal: un **hilo** se forma solo con los errores de la misma huella o cuando se responde a algo, se lee como una conversación con lo que dijo Rimor de cada cosa, y se marca resuelto con una línea de nota. Catálogo: **ORG-15** (hilos) y **ORG-06** (mismo error). Depende de IN-021 (huella del error), IN-026 (Inicio y «Responder») y D13 (un elemento, un solo hilo).

## Estado de partida

- `@rimor/formato` tiene `hiloSchema` (`estado: abierto | resuelto`, `nota`, `resuelto`), el prefijo `HIL`, `rutaEntidad('hilo', …)` y el campo `hilo` del elemento; el repositorio de entidades (IN-028) lee y escribe cualquier tipo de entidad con `crear` en turno.
- La captura acepta `entrada.hilo`; el compositor, en modo respuesta, pasa el hilo del elemento al que se responde solo si ya lo tiene. La respuesta del lector Log ofrece «Sí, a su hilo» (`hilo:ERR-0015`), que aún no hace nada. La ruta `/hilo/$ref` es un hueco.
- La respuesta del lector Error ya cuenta las ocurrencias de la misma huella y cita la nota de la última resuelta («El 15 oct escribiste: …», IN-021).
- La referencia (`SC.hilo`): chip «Hilo» y estado («abierto»), título, meta «4 elementos · desde el 2 oct · colección gateway», a la derecha «Marcar resuelto» y «Convertir en investigación»; los mensajes como en Inicio, con «Así lo resolviste» destacado; el compositor «Responder en este hilo: una nota, un log, cómo lo resolviste…».

## Diseño

### El hilo y sus elementos (`src/hilos/hilos.ts`)

- La entidad `hilos/HIL-NNNN--titulo.md` guarda lo suyo (título, estado, nota, creado, resuelto). **Qué elementos tiene lo dice cada elemento** con su `hilo` (D13: uno solo): no hay dos listas que mantener de acuerdo.
- `crearHilo(titulo, refs)` (ref asignada en turno) pone el `hilo` a cada elemento; `anadirAHilo(hilo, ref)` (si el hilo estaba resuelto, vuelve a abrirse: ha vuelto a pasar); `moverAHilo(ref, otro)`; `quitarDeHilo(ref)`; `elementosDe(hilo)` en orden de captura; `hiloPara(ref)`: el del elemento o uno nuevo con él (para responder).
- `resolver(hilo, nota)`: el hilo queda resuelto con su nota y la fecha, y la nota pasa también al último elemento del hilo (estado `resuelto` y la nota al principio de sus notas, con copia en el historial): así la siguiente ocurrencia la cita, como ya hace la respuesta del lector Error. `reabrir(hilo)`.

### Cómo se forma

- **Mismo error** (`src/hilos/formar.ts`): al capturar un error, cuando llegan sus derivados, si otro elemento tiene su huella: entra en el hilo de esa ocurrencia (el de la más reciente que lo tenga) o, si ninguna lo tiene, se crea el hilo con todas (título: el del error). Lo hace la captura (`Captura.tsx`, junto al recuento de errores reconocidos), solo en la pestaña que escribe.
- **Responder** (en Inicio, `r` o el botón): la captura va al hilo del elemento al que se responde; si no tenía, se crea uno con él.
- «Sí, a su hilo» de la respuesta del lector Log: el log entra en el hilo de ese error (creándolo si hace falta).

### Pantalla Hilo (`src/rutas/hilo/Hilo.tsx`)

Como `SC.hilo`: chip «Hilo» y estado (abierto en ámbar, resuelto en verde), título editable en el sitio, meta «3 elementos · desde el 2 oct · colección gateway» (la colección si la comparten); a la derecha **«Marcar resuelto»** (un diálogo con una línea de nota) o **«Reabrir»**; «Convertir en investigación», oculto hasta IN-070. Los mensajes en orden, con el mismo componente que Inicio (título, vista previa, la respuesta de Rimor y sus acciones) y, en el que tiene la solución, **«Así lo resolviste»** destacado. Abajo, el compositor con «Responder en este hilo: una nota, un log, cómo lo resolviste…»: lo que se capture entra en el hilo.

### En el elemento

En su «Detalles», la fila **Hilo** con su ref pulsable y «Mover a otro hilo»: un diálogo con los hilos abiertos (y «Sacar del hilo»), que pide confirmación antes de moverlo.

## Tareas

- [x] Entidad `Hilo` (`hilos/HIL-NNNN--….md`): título, estado (abierto o resuelto), nota de solución, creado y resuelto.
- [x] Formación automática: el segundo error con la misma huella crea el hilo con los dos; los siguientes se añaden.
- [x] «Responder» en un mensaje: la nueva captura entra en el hilo de ese elemento (o crea uno).
- [x] Pantalla Hilo: cabecera, mensajes en orden con su respuesta, la nota «así lo resolviste» destacada y compositor «Responder en este hilo…».
- [x] «Marcar resuelto» con una línea de nota; reabrir.
- [x] «Convertir en investigación» oculto hasta IN-070.
- [x] Un elemento, un solo hilo (D13); moverlo de hilo con confirmación.

## Pruebas previstas

- Hilos: crear, añadir (reabre uno resuelto), mover, quitar, elementos en orden, resolver con su nota en el último elemento, reabrir; un elemento nunca en dos.
- Formación: el primero solo, sin hilo; el segundo crea el hilo con los dos; el tercero entra; con números distintos en la traza.
- Aceptación: pegar tres veces la misma traza con números distintos deja un hilo con tres elementos, y la tercera respuesta cita la nota del segundo.
- Responder: crea el hilo con el elemento respondido o usa el suyo.
- Pantalla: cabecera, meta, mensajes, «Así lo resolviste», marcar resuelto y reabrir, el compositor del hilo, solo lectura. Elemento: la fila Hilo y moverlo con confirmación.

## Criterios de aceptación

- Pegar tres veces la misma traza con números distintos deja un hilo con tres elementos, y la tercera respuesta cita la nota del segundo. `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| ¿Lista de elementos en el hilo o hilo en cada elemento? | En cada elemento (`hilo`): D13 sale gratis y no hay dos fuentes que desincronizar. |
| Cómo cita la siguiente respuesta la nota de resolución | La nota pasa también al último elemento (resuelto), que es lo que ya usa la respuesta del lector Error. |
| Una ocurrencia nueva de un hilo resuelto | Lo reabre: ha vuelto a pasar (la nota se queda). |
| Varios hilos con la misma huella (movidos a mano) | El nuevo entra en el de la ocurrencia más reciente que tenga hilo. |
| «Convertir en investigación» | Oculto hasta IN-070. |

## Autorrevisión

Cubre las siete tareas y la aceptación. Aplica lo aprendido: las escrituras en turno (la ref del hilo con `crear`), deshacer y mover sin pisar ediciones, la pantalla reutiliza el mensaje de Inicio y el compositor, y las pruebas de pantalla precargan sus módulos.

## Implementación

- `src/hilos/hilos.ts`: `crearHilo` (ref con `entidades.crear`, en turno), `anadirAHilo` (reabre uno resuelto), `moverAHilo` (o sacar con `null`), `hiloPara`, `resolver` (nota en el hilo y en su último elemento, con copia en el historial), `reabrir`, `renombrarHilo`, `elementosDe` y `hiloDe`. El repositorio de entidades lee también `hilos/` al abrir.
- `src/hilos/formar.ts`: `formarPorHuella`, en una cola (dos errores iguales a la vez no crean dos hilos). La llama `Captura.tsx` con los derivados de un error, junto al recuento de errores reconocidos, solo en la pestaña que escribe.
- Responder: el compositor usa `hiloPara` (crea el hilo si no lo había) y acepta `hiloFijo` en la pantalla del hilo. «Sí, a su hilo» de la respuesta del lector Log funciona en Inicio (y `accionSoportada` lo admite).
- `src/rutas/hilo/Hilo.tsx`: la pantalla como `SC.hilo`, con el mensaje de Inicio (`Mensaje`), «Así lo resolviste», «Marcar resuelto» (diálogo con una línea) y «Reabrir», y el compositor del hilo.
- En el elemento, la fila «Hilo» de «Detalles» y `DialogoMoverHilo` (elegir y confirmar; sacar del hilo).
- Pruebas: `src/hilos/hilos.test.ts` (operaciones, formación y la aceptación con el lector Error real) y `src/rutas/hilo/Hilo.test.tsx` (pantalla, responder desde Inicio, mover desde el elemento).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| El chip del hilo lleva el color del error si sus elementos son errores | Como la referencia (`kchip k-err` en el hilo de un error); en otro caso, neutro. |
| Las pruebas de pantalla fechan sus elementos con `pruebas/fechas.ts` (`haceMinutos`) | Pasada la medianoche, «hace 30 minutos» era ayer y las que esperan «Hoy» fallaban según la hora. |
| «Archivar» en un mensaje del hilo archiva el elemento (sigue en el hilo) | Es el mismo mensaje que en Inicio; archivar no lo saca de su hilo. |

## Verificación

**`pnpm verificar`**: en verde, 74 archivos y 1087 pruebas; carga inicial 224,3 KB de 300.

**Tareas y aceptación, con su evidencia:**

| Tarea o criterio | Evidencia |
|---|---|
| Tres veces la misma traza con números distintos: un hilo con tres y la tercera cita la nota del segundo | `hilos.test.ts` «aceptación» (lector Error real); la formación por la captura real de la app en `Hilo.test.tsx` (pegar dos veces desde el compositor) |
| Entidad `Hilo` | `hilos.test.ts`, `entidades` al abrir (`abrir.ts`) |
| Formación automática | `hilos.test.ts` (primero solo, segundo crea, tercero entra, a la vez sin dos hilos, reabre uno resuelto) |
| Responder | `Hilo.test.tsx` (crea el hilo con los dos; en la pantalla del hilo entra en él) |
| Pantalla Hilo, resolver y reabrir | `Hilo.test.tsx` |
| «Convertir en investigación» oculto | `Hilo.tsx` (no se pinta hasta IN-070) |
| D13 y mover con confirmación | `hilos.test.ts` (mover y sacar) y `Hilo.test.tsx` (mover a otro y sacar, con su confirmación) |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | La nota de «Marcar resuelto» iba al último elemento aunque fuera una respuesta (sin huella): no se citaba y le cambiaba el estado | Va a la última ocurrencia del error del hilo (o al último si no hay errores). `hilos.test.ts` |
| 2 | Meter en un hilo cambiaba `modificado`: rompía «Deshacer» y fechaba mal la nota citada | Poner o quitar el hilo es organización: no toca `modificado`. `hilos.test.ts` |
| 3 | Un error que entraba respondiendo en un hilo resuelto no lo reabría | `formarPorHuella` lo reabre. `hilos.test.ts` |
| 4 | En la pantalla del hilo, las acciones de la respuesta no hacían nada | No se ofrecen en el hilo (son de Inicio) |
| 5 | Cada mensaje del hilo solo decía la hora | Con su día («15 oct, 19:12»; «hoy, 17:49»), como `SC.hilo` |
| 6 | Responder creaba el hilo antes de capturar (también ante un duplicado) y una versión movía su elemento de hilo | El hilo se crea solo si la captura creó un elemento; una versión no cambia el hilo de su elemento. `Hilo.test.tsx` |
| 7 | Sin hilo si los derivados no llegaban o al corregir el tipo a Error | La huella del frontmatter como respaldo; `formarSiEsError` al cambiar el tipo (pantalla e Inicio) |
| 8 | «Archivar» en el hilo podía quitar la solución | No se ofrece en el hilo |
| 9 | «Ninguna» (femenino) en la fila Hilo | «Ninguno» |
| 10 | Añadir o mover avisaba de éxito aunque no se escribiera | Devuelven si se escribió y se avisa del fallo |
| 11 | Hilos vacíos como destino al mover | Solo los abiertos con algo dentro |
| 12 | Pruebas que no pasaban por la captura real ni probaban mover a otro hilo | Añadidas |

