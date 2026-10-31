# IN-049 · Reglas aprendidas y captura múltiple

## Objetivo y catálogo

Dos mejoras de la captura:

- **Reglas aprendidas (CAP-06)**: si el usuario corrige tres veces el tipo de contenidos parecidos, Rimor propone una regla («Los textos que empiezan por `[app]` son logs») que se guarda en `.rimor/reglas-deteccion.json` y se puede editar o borrar en Ajustes.
- **Captura múltiple (CAP-07)**: un pegado con varias URL o con varios bloques separados por líneas en blanco ofrece «Dividir en N elementos».

Catálogo: CAP-06 y CAP-07 (plan §5, v0.2). Depende de IN-013 (detector) e IN-014 (flujo de captura). Plan §21: «Detección errónea: corrección en un clic, dos candidatos si duda, reglas aprendidas, corpus de pruebas».

## Estado de partida

- `detectar` (src/captura/detector.ts) tiene tres pasos: atajos (binarios, URL o DOI completos), arbitraje entre lectores (umbral y margen de duda de los ajustes) y Texto por defecto. Lo usan la captura (`flujo.ts`) y la vista previa (`previa.ts`, también en el Worker), las dos con `OpcionesCaptura` (de `espacio.ajustes()`).
- El tipo se corrige con «Cambiar tipo» en el elemento (`Elemento.tsx`) y en el feed (`Inicio.tsx`). Las dos llaman a `cambiarTipo` y cuentan `correccionesDeTipo`. Un `/tipo` en el compositor fuerza el tipo sin detectar y no cuenta (nota de IN-016: debería contar si contradice al detector).
- `.rimor/` viaja en el ZIP (salvo la caché y los diarios de operación). Los ajustes se guardan en el espacio con `ajustes()` y `guardarAjustes(cambio)`, se escriben en orden y solo desde la pestaña que escribe, y se releen al cambiar en otra pestaña.
- El feed de Inicio pinta, además de los elementos, mensajes «en su momento» del almacén del compositor (búsquedas y versiones, `useCompositor`).
- La vista previa del compositor (`VistaPrevia`) dice qué tipo saldría y con qué confianza, y si hay duda.
- La referencia visual no dibuja ni la propuesta ni la lista de reglas. Su regla de estilo dice: «Rimor habla en una o dos frases; las preguntas llevan botones, nunca formularios».

## Diseño

### Reglas de detección (`src/captura/reglas.ts`, TS puro)

- **Firma de un contenido** (`firmaDe(texto)`): la primera palabra de la primera línea con contenido (hasta el primer espacio, como mucho 32 caracteres). Solo vale si lleva al menos una letra y al menos un signo que no es letra ni cifra: `[app]`, `app:`, `<svc>`, `myapp|`. Una palabra corriente («The», «Error») no hace una regla útil, y un número o una fecha cambian en cada captura.
- **Archivo** `.rimor/reglas-deteccion.json`:

  ```json
  {
    "esquema": 1,
    "reglas": [{ "prefijo": "[app]", "tipo": "log", "creada": "2026-10-31T18:00:00+01:00" }],
    "correcciones": [{ "firma": "[app]", "tipo": "log", "en": "…" }],
    "descartadas": [{ "firma": "[app]", "tipo": "log" }]
  }
  ```

  `correcciones` guarda las 100 últimas. Lectura tolerante: lo que no se entiende se ignora y el archivo ilegible no se sobrescribe, como los contadores. Las reglas mantienen su orden, sin prefijos repetidos.
- **Aprender** (`anotarCorreccion(datos, texto, tipo, ahora)`): anota la corrección si el texto tiene firma. Cuando ya hay **3** con la misma firma y el mismo tipo, devuelve una **propuesta** `{ firma, tipo }`. No se propone si ya hay una regla con ese prefijo y ese tipo, ni si se descartó.
- **Aplicar** (`reglaPara(texto, reglas)`): la primera regla cuyo prefijo empieza la primera línea con contenido (sin los espacios del principio).
- **En el detector**: `OpcionesDeteccion.reglas`. Después de los binarios y antes de los enlaces y el arbitraje, una regla que encaja decide el tipo (`via: 'regla'`, confianza 1) si ese tipo tiene lector. Si no lo tiene, se ignora. `OpcionesCaptura` lleva `reglas`, así que la captura y la vista previa (también la del Worker) las aplican igual.

### En el espacio

- `EspacioAbierto.reglas()` y `guardarReglas(cambio)`, como los ajustes: en memoria, escritas en orden solo por la pestaña que escribe, y releídas con todo lo demás cuando cambia otra pestaña.
- `opcionesCaptura(ajustes, reglas)` las junta para la captura.

### La propuesta en el feed

- Al corregir el tipo (en el elemento, en el feed, o con un `/tipo` que contradice al detector), `aprenderCorreccion(espacio, texto, tipo)` anota la corrección y, si hay propuesta, la deja en el almacén del compositor (`propuestas`, como `versiones`).
- El feed pinta la propuesta en su momento como mensaje de Rimor: «Los textos que empiezan por `[app]` son logs. ¿Lo recuerdo?», con los botones «Sí, recuérdalo» y «No».
  - Con «Sí» se crea la regla y aparece el aviso «Regla guardada».
  - Con «No» va a `descartadas`.
  - Las dos opciones quitan el mensaje.
- Un `/tipo` que contradice al detector (lo habría guardado como otro tipo) también cuenta `correccionesDeTipo` (nota de IN-016). La captura devuelve `detectado` cuando el tipo venía forzado y no coincidía.

### En Ajustes

- En la tarjeta «Detección», debajo del margen de duda: «Reglas aprendidas». Cada regla es una fila con su prefijo (campo de texto, se guarda al salir), su tipo (lista con los tipos que tienen lector, sin los binarios) y «Borrar».
- Sin reglas: «Ninguna todavía. Si corriges el tipo de algo parecido tres veces, Rimor te propondrá una.»
- En solo lectura, deshabilitado.

### Captura múltiple (`src/captura/dividir.ts`, TS puro)

- `partes(texto)`:
  - si hay al menos 2 líneas con contenido y todas son una URL o un DOI completos, cada una es una parte (**enlaces**, como mucho 50);
  - si no, los **bloques** separados por una o más líneas en blanco, si son 2 o más (como mucho 20);
  - si no, `null`.
- **Cuándo se ofrece** (en `previsualizar`, así también en el Worker):
  - Enlaces: siempre.
  - Bloques: solo si cada bloque, detectado solo (con sus secretos ocultados), es de un tipo que no es Texto, y el conjunto no es de un tipo cuyas líneas en blanco son de su estructura: Markdown, código, datos, prompt, log o mediciones.
  - Así, dos trazas, dos curl o un error y un JSON se ofrecen; unas notas con párrafos, un archivo de código o un log con huecos, no.
  - `Previa.division = { n, via }`.
- **En el compositor**: junto al tipo de la vista previa, el botón «Dividir en N elementos». Al pulsarlo se guarda ya, cada parte como un elemento, con las mismas indicaciones (`@`, `#`, `/tipo`, hilo). Los avisos y las respuestas son los de cualquier captura de varias cosas.
- Las partes salen del cuerpo sin las indicaciones. La captura de cada una oculta sus secretos, como siempre.

## Tareas

- [ ] Reglas aprendidas: tres correcciones de contenidos parecidos proponen una regla, guardada en `.rimor/reglas-deteccion.json`, que se edita o borra en Ajustes.
- [ ] Captura múltiple: varias URL o varios bloques ofrecen «Dividir en N elementos».

## Pruebas previstas

- `reglas.ts`: la firma (sí `[app]` y `app:`; no «Error», ni una fecha, ni lo vacío); la propuesta a la tercera corrección con la misma firma y el mismo tipo (no con firmas o tipos distintos, ni si está descartada o ya es regla); lectura tolerante y escritura; aplicar la primera regla.
- Detector: la regla gana al arbitraje y a los enlaces, pero no a un binario; con un tipo sin lector, se ignora. Vista previa con la regla.
- Espacio: `guardarReglas` escribe el archivo, solo desde la pestaña que escribe, y lo relee al abrir.
- Feed: la propuesta con sus dos botones (la regla, el descarte, el mensaje que se va); tres correcciones desde «Cambiar tipo» proponen la regla; un `/tipo` que contradice cuenta.
- Ajustes: la lista, editar el prefijo y el tipo, borrar, vacío y solo lectura.
- `dividir.ts`: URL (y DOI) por líneas, bloques, casos que no se ofrecen (notas, código, log, un solo bloque); límites.
- Compositor: el botón con N, y pulsarlo crea N elementos con las indicaciones.

## Criterios de aceptación

- `pnpm verificar` en verde.
- Tres correcciones a Log de textos que empiezan por `[app]` proponen la regla. Al aceptarla, el siguiente `[app] …` se guarda como Log, y la regla aparece en Ajustes.
- Pegar tres URL ofrece «Dividir en 3 elementos» y crea tres enlaces.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Una regla demasiado general («Los que empiezan por `-` son …») | La firma necesita una letra y un signo, y la regla solo se crea si el usuario dice «Sí». En Ajustes se edita o se borra. |
| Ofrecer dividir en todo texto con párrafos | Solo si cada bloque se reconoce como algo y el conjunto no tiene líneas en blanco por su estructura. |
| Dónde se pregunta la regla si se corrige en la pantalla del elemento | En el feed de Inicio, como mensaje de Rimor (persiste en la sesión). No como aviso efímero: los avisos son participios, no preguntas. |
| Correcciones de elementos grandes (adjunto) | Solo aprenden los que tienen el original en el Markdown (la firma es su principio). |

## Autorrevisión

Cubre las dos tareas y la nota de IN-016 sobre `/tipo`. Reutiliza el detector, las opciones de captura, el patrón de los ajustes en el espacio, los mensajes en su momento del feed y la captura de varias cosas a la vez. Lo nuevo: `reglas.ts` y `dividir.ts` (puros), la propuesta en el feed, la lista en Ajustes y el botón del compositor.
