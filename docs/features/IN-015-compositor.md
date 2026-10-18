# IN-015 · Compositor

## Objetivo y catálogo

Capturar como en un chat, configurando lo mínimo. Catálogo: **CAP-03** (indicaciones en la captura) y **CAP-13** (Inicio como chat). Depende de IN-008 (carcasa y atajos) e IN-014 (capturador y borrador).

## Estado de partida

- `useCompositor` (IN-014): borrador con `texto`, `archivos` y `llegadas` (lo pegado fuera de un campo llega aquí).
- `useCapturador()` (IN-014): `capturar(entrada)` en turno y `deshacer`.
- `detectar` (IN-013), `buscarSecretos` (IN-010), `ChipTipo` y `Estado` (IN-002), iconos `adjuntar`, `enviar`, `responder`, `cerrar`, `buscar`.
- Gestor de atajos con modificadores (`ctrl+shift+space`).
- La pantalla de referencia: `.ccol > .composer > .cbox` (textarea, `.cprev`, `.crow` con `ibtn` de adjuntar, `.hint` y `.send`), `.replying` encima; sus reglas CSS son la medida.

## Diseño

### `src/captura/indicaciones.ts` (puro)

`analizarIndicaciones(texto) → { cuerpo, tipo?, colecciones, etiquetas, busqueda? }`:

- **`?texto`** al principio (tras espacios): búsqueda; nada más se analiza.
- **`/tipo`** al principio, seguido de espacio, salto de línea o fin, y solo si la palabra es un tipo conocido (`log`, `error`/`err`, `med`/`mediciones`, `prompt`, `md`/`doc`/`markdown`, `enlace`/`url`, `idea`, `datos`/`csv`, `codigo`/`code`, `comando`/`cmd`, `json`/`yaml`/`toml`, `http`, `texto`/`nota`, y los nombres de `TIPOS_ELEMENTO`). Así `/var/log/syslog` no es un tipo.
- **`@colección` y `#etiqueta`** solo en la **última línea** cuando esa línea no tiene otra cosa (y hay más de una), o **al final de una sola línea** (precedidas de espacio). Nombres: letras, números, `_`, `-`, `.` interior y `/` interior (`@gateway/http`).
- No son indicaciones: una dirección de correo (`ana@empresa.com`, la `@` va pegada a texto), `#` dentro de un bloque de código (última línea dentro de una cerca abierta o el cierre de la cerca), directivas de preprocesador (`#include`, `#endif`, `#pragma`…), colores (`#fff`, `#1e90ff` tras `:`), encabezados Markdown (`# Título`, con espacio) y menciones en mitad del texto.
- `cuerpo` es el texto sin las indicaciones (y sin los espacios que dejan al final).

### `Compositor.tsx` (en `src/ui/componentes/`)

- Área de texto que crece con el contenido hasta 220 px (altura medida con `scrollHeight`). **Enter** guarda; **Mayús+Enter**, salto de línea; durante la composición de un IME (`isComposing` o tecla 229) Enter no guarda.
- **Vista previa** (`.cprev`) bajo la caja, recalculada 120 ms después de la última tecla: «Se guardará como» + `ChipTipo` + la confianza (`0,92`) o «elegido con /»; `@colecciones` (`st acc`), `#etiquetas` (`st`), «N secretos se ocultarán» (`st warn`) y, si hay duda, «¿o Error? Escribe /error al principio». Con más de 20 KB, detector y secretos corren en el Worker de derivados (`previsualizar`). Con `?texto`: «Buscar «texto». Enter para verlo aquí.»
- **Autocompletar**: al escribir `@`, `#` o `/` (este solo al principio), una lista (`role="listbox"`) con las colecciones existentes, las etiquetas usadas o los tipos, filtrada por lo escrito; flechas para moverse, Enter o Tab para elegir, Escape para cerrar.
- **Adjuntar**: el `ibtn` abre el selector de archivos (varios); soltar archivos sobre el compositor también los añade al borrador (no se guardan hasta Enter). Los adjuntos se ven como píldoras con ×.
- **Modo respuesta**: `respondiendoA` en el borrador pinta «Respondiendo a REF: irá a su hilo» con × (lo activa IN-030). Al guardar, si el elemento respondido ya tiene hilo, la captura va a ese hilo.
- **Guardar**: con texto, una captura con sus indicaciones; con adjuntos, una por archivo con las mismas indicaciones. Aviso «Guardado» con Deshacer (hasta que IN-026 pinte el feed, es lo que se ve); el borrador se vacía. Con `?texto`, se anota una búsqueda pendiente en el borrador (`busquedas`) que IN-026/IN-032 pintan en el feed.
- **`Ctrl+Mayús+Espacio`** enfoca el compositor desde cualquier pantalla (lleva a Inicio si hace falta): atajo global de la carcasa que navega y sube `llegadas`, que el compositor escucha para enfocarse.
- **Borrador en `sessionStorage`** (`rimor:borrador`, solo el texto) para sobrevivir a una recarga.
- Pintado: el compositor va en Inicio, en `.col.ccol` pegada abajo dentro de `.amain`, con las reglas de la pantalla de referencia (`.composer`, `.cbox`, `.crow`, `.hint`, `.send`, `.cprev`, `.replying`) portadas a `componentes.css`.

## Tareas

- [x] Área de texto que crece hasta 220 px; Enter guarda, Mayús+Enter salta de línea; respeta la composición de texto (IME).
- [x] `analizarIndicaciones(texto)`: `/tipo`, `@colección`, `#etiqueta`, `?texto` → `{ cuerpo, tipo?, colecciones, etiquetas, busqueda? }`.
- [x] Vista previa en vivo con *debounce* de 120 ms (en el Worker si pasa de 20 KB): tipo y confianza, alternativa, colecciones, etiquetas y secretos.
- [x] Autocompletar `@`, `#` y `/`.
- [x] Botón de adjuntar y zona de soltar.
- [x] Modo respuesta con «Respondiendo a REF» y cancelar.
- [x] `?texto` + Enter deja la búsqueda para el feed (lo conecta IN-032).
- [x] `Ctrl+Mayús+Espacio` enfoca el compositor desde cualquier pantalla.
- [x] Borrador en `sessionStorage`.

## Pruebas previstas

- `analizarIndicaciones` con al menos 40 casos: cada indicación, combinaciones, una sola línea y varias, y los que **no** lo son (correo, `#` en código, `/` de rutas, colores, encabezados, preprocesador, menciones en mitad).
- Compositor (happy-dom): crece hasta 220 px; Enter guarda y vacía; Mayús+Enter no; Enter con IME no; vista previa tras 120 ms con tipo, colecciones, etiquetas, secretos y duda; autocompletar con teclado; adjuntar con el selector; soltar sobre el compositor añade al borrador; modo respuesta; `?texto` deja la búsqueda; borrador restaurado de `sessionStorage`; el atajo global enfoca.

## Criterios de aceptación

- `ana@empresa.com` en mitad del texto no es una colección; un log que empieza por `/var/log` no es `/tipo` (pruebas).
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Etiquetas que en realidad son código (`#endif`, `#fff`) | Reglas de exclusión probadas con casos; si una se cuela, se ve en la vista previa antes de guardar |
| El feed no existe todavía (IN-026) | Aviso «Guardado» con Deshacer; las búsquedas quedan en el borrador para que el feed las pinte |
| Soltar sobre el compositor frente al soltar global (IN-014) | El compositor marca su zona y el global la respeta |
| Detector en el Worker para textos grandes | El Worker de derivados gana `previsualizar`; si no hay Worker, en el hilo principal |

## Autorrevisión

Cubre las nueve tareas y los dos criterios. Lo visual sale de las reglas de la pantalla de referencia; el autocompletado no está dibujado allí y usa las piezas de la guía (lista con `card`, elementos `ibtn`). IN-026 pinta el feed y las búsquedas pendientes, IN-030 activa el modo respuesta e IN-032 conecta `?texto` con la búsqueda.

## Cambios durante la implementación

- La vista previa es `previsualizar(texto, registro)` (`src/captura/previa.ts`), la misma función en el hilo principal y en el Worker de derivados (`api.previsualizar`), que el contexto de lectores expone.
- `ProveedorCaptura` da `useCaptura()` con el capturador e `informar(resultados)`: el compositor y el soltar global avisan igual («Guardado. Deshacer» primero; duplicados con «Ver»).
- El soltar global respeta las zonas marcadas con `data-zona-soltar` (el compositor añade lo soltado al borrador).
- Sugerencias: botones dentro de una lista flotante, recorridos con las flechas desde el área de texto; una región viva anuncia la sugerencia activa (el patrón de combobox de ARIA no es válido sobre un `textarea`).
- El compositor solo se enfoca con llegadas nuevas (`atendidas`): volver a Inicio no abre el teclado del móvil.
- Si algo no se pudo guardar (un fallo, no un duplicado), el borrador se conserva para reintentar.
- IME: además de `isComposing`, la tecla `Process` y el código 229 (Safari).

