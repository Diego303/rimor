# IN-043 · Comando con huecos

## Objetivo y catálogo

Que un comando de terminal pegado se guarde como una **chuleta**: el comando con sus huecos (`{{baseline}}`) a la vista y «Copiar con valores» para rellenarlos y llevárselo. Catálogo: **LEC-10** (plan §8.9: «Tarjeta reutilizable con huecos (`{{host}}`) y "copiar con valores". Tu chuleta personal»; Anexo D, puesto 13). Depende de IN-023 (reutiliza «Copiar con valores»).

## Estado de partida

- El tipo `comando` (`CMD-`) existe en el formato y en la referencia (icono `cmd`, `CMD-0009`: `cargo bench --bench http -- --save-baseline {{baseline}}`, respuesta «Comando con un hueco: {{baseline}}. Puedes copiarlo con el valor rellenado.» y la acción «Copiar con valores»). No tiene lector: hoy lo leen Código o Texto.
- `ORDEN_DETECCION` reserva el puesto 13 (`comando`), después de Markdown y antes de Código.
- «Copiar con valores» vive dentro de la vista del Prompt (`CopiarConValores`, con los valores recordados en este navegador por elemento, el portapapeles y el texto listo si el navegador no deja copiar).
- Las acciones de una respuesta que el feed sabe hacer son `coleccion:`, `hilo:` y `no`.

## Diseño

### El lector `comando`

- **Detecta** (`analisis.ts`): hasta tres comandos (una línea, o varias unidas con `\` al final) que empiezan por `$ ` o por un programa conocido (`git`, `cargo`, `pnpm`, `docker`, `kubectl`, `python`, `curl`, `ssh`, `make`…, una lista corta y explícita). Con `$ `, 0,9; con un programa conocido, 0,85; con huecos `{{x}}`, +0,05. Más de tres comandos, o una línea que no lo parece, 0.
- **Huecos:** solo `{{nombre}}` (los `${VAR}` y `$VAR` son del propio shell, y `<x>` es una redirección).
- **Título:** el primer comando, sin `$ `, recortado a 80.
- **Resumen:** `{ programa, huecos }`; legible «cargo · 1 hueco».
- **Respuesta:** «Comando con un hueco: {{baseline}}.» (el hueco en mono), «Comando con 2 huecos: {{host}} y {{puerto}}.», o «Comando de cargo.» sin huecos; con huecos, la acción **«Copiar con valores»**, que abre el elemento.
- **Cifras citables:** `huecos`.
- **Indexable:** el programa y los nombres de los huecos.

### La vista (la chuleta)

- Una tarjeta con el comando en mono (`$ ` delante de cada uno), los huecos resaltados como en el Prompt (`.var`).
- «Copiar con valores» (si tiene huecos): **el mismo componente que el Prompt**, sacado a `src/lectores/CopiarConValores.tsx` (una caja por hueco, los valores recordados en este navegador, copiar o el texto listo). El Prompt pasa a usarlo sin cambiar nada de lo que hace.
- Sin huecos, «Copiar» a secas.
- «Detalles» con el programa y las cifras.
- **Tarjeta** de mosaico: el comando en mono, con sus huecos.

### En Inicio

La acción `abrir` de una respuesta lleva al elemento (la usa «Copiar con valores»).

## Tareas

- [x] Detecta una línea con `$` o programa conocido.
- [x] Huecos `{{x}}`.
- [x] Tarjeta de chuleta.
- [x] Copiar con valores.
- [x] Respuesta «Comando con un hueco: {{baseline}}.».

## Pruebas previstas

- `analisis`: `$ ` y programa conocido, varias líneas con `\`, hasta tres comandos, huecos (repetidos, con espacios dentro), lo que no es comando (prosa que empieza por «git es…», un log, un script largo, Markdown).
- Detección: los ejemplos van a `comando` y el corpus sigue ≥ 90 %.
- Respuesta (uno, varios, ninguno; es y en; reglas de estilo) y su acción.
- Vista: los huecos resaltados, copiar con valores (portapapeles y el texto listo), valores recordados; sin huecos, «Copiar».
- El Prompt sigue copiando con valores igual (sus pruebas, sin tocar).
- Inicio: «Copiar con valores» abre el elemento.

## Criterios de aceptación

- `pnpm verificar` en verde; un comando pegado se guarda con el lector `comando`, su respuesta y su chuleta.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Falsos positivos (una frase que empieza por «make») | Lista corta de programas, hasta tres comandos y forma de comando (sin punto final de frase, con opciones o argumentos). |
| `curl` es una petición HTTP (puesto 9) | Hasta que llegue su lector (IN-047), `curl` es un comando. |
| Sintaxis de huecos | Solo `{{x}}`: las demás chocan con el shell. |
| Dos copias de «Copiar con valores» | Un solo componente compartido. |

## Autorrevisión

Cubre las cinco tareas. Reutiliza «Copiar con valores» del Prompt (sacado a un componente común), el resaltado `.var`, las cifras citables y `DetallesElemento`.

## Implementación

- `src/lectores/comando/`: `analisis.ts` (`puntuarComando`, `comandosDe`, `programaDe`, `huecosDe`, `rellenar`, `trozosComando`; la lista de programas), `lector.ts` (`lectorComando`, con la acción `abrir` cuando hay huecos), `textos.ts`, `Vista.tsx` (la chuleta y «Copiar con valores» o «Copiar») y `Tarjeta.tsx`; registrado en el puesto 13.
- `src/lectores/CopiarConValores.tsx`: el componente que era del Prompt, ahora común (los valores se recuerdan por lector y elemento: `rimor:<espacio>:prompt:<id>`, como antes, y `rimor:<espacio>:comando:<id>`). El Prompt lo usa sin cambiar nada de lo que hace.
- Inicio: la acción `abrir` de una respuesta lleva al elemento (y se sigue ofreciendo).
- CSS: `.comando-texto`, `.prompt-comando` (el `$`, tenue y sin copiar) y `.comando-tarjeta`.
- Corpus de detección: `fixtures/deteccion/comando/` (26 ejemplos; la matriz sigue al 100 %).
- Pruebas: `comando/comando.test.ts` (detección, continuaciones, programa, huecos, lo que no es comando, título, respuesta y estilo) y `comando/Vista.test.tsx` (chuleta, copiar con valores y recordarlos, «Copiar» sin huecos, la acción en Inicio). Las del Prompt pasan sin tocarlas.
