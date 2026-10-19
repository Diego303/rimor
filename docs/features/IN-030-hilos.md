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

- [ ] Entidad `Hilo` (`hilos/HIL-NNNN--….md`): título, estado (abierto o resuelto), nota de solución, creado y resuelto.
- [ ] Formación automática: el segundo error con la misma huella crea el hilo con los dos; los siguientes se añaden.
- [ ] «Responder» en un mensaje: la nueva captura entra en el hilo de ese elemento (o crea uno).
- [ ] Pantalla Hilo: cabecera, mensajes en orden con su respuesta, la nota «así lo resolviste» destacada y compositor «Responder en este hilo…».
- [ ] «Marcar resuelto» con una línea de nota; reabrir.
- [ ] «Convertir en investigación» oculto hasta IN-070.
- [ ] Un elemento, un solo hilo (D13); moverlo de hilo con confirmación.

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
