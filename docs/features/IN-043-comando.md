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

### Decisiones tomadas al implementar y en la verificación

| Decisión | Por qué |
|---|---|
| Marcas de prompt: `$ `, `% `, `❯ `, `usuario@máquina:~$ `, `PS C:\…> `, y `> ` solo si le sigue un programa conocido | Son las que se pegan de verdad; `> ` sola es una cita de Markdown. Con prompt, la primera palabra tiene que parecer un programa (no «20 al mes»). |
| La prosa se reconoce por sus palabras («the», «to», «de», «la»…) sin nada con forma de argumento, no por el punto final | `git add .` y `cd ..` acaban en punto; «make sure to call mom» no. |
| En una sesión pegada (la primera línea con prompt), las líneas sin prompt son la salida | Se guarda todo, pero la chuleta y los huecos son de los comandos. |
| Los heredocs y las comillas abiertas siguen en la línea siguiente | Un `cat <<EOF` es un comando, no tres. |
| En una plantilla de Go (`{{.Names}}`, `{{range}}`), `{{end}}` y `{{else}}` no son huecos | Son de `docker --format`, `gh --template` o `helm`. |
| La respuesta lleva la segunda frase de la referencia («Puedes copiarlo con el valor rellenado.») | Como `CMD-0009`. |

## Verificación

**`pnpm verificar`**: en verde, 109 archivos y 1414 pruebas; carga inicial 255,2 KB de 300.

**Criterios de aceptación:** un comando pegado se guarda con el lector `comando`, su respuesta y su chuleta (`comando.test.ts`, `Vista.test.tsx`; corpus de detección al 100 %).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Detecta una línea con `$` o programa conocido | `comando.test.ts` (prompts, programas, prosa, sesiones, heredocs) y `fixtures/deteccion/comando/`, con negativos en `idea/` y `texto/` |
| Huecos `{{x}}` | `comando.test.ts` (sin repetir, `${VAR}`, plantillas de Go) |
| Tarjeta de chuleta | `Vista.test.tsx` (chuleta, tarjeta desde el original) |
| Copiar con valores | `Vista.test.tsx` (copiar, recordar, «Copiar» con respaldo) y las del Prompt sin tocar |
| Respuesta | `comando.test.ts` (uno, varios, más de tres, ninguno; estilo) y la instantánea |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | `>`, `%`, `❯` y `$ ` aceptaban citas, precios y porcentajes | `>` solo con un programa; con prompt, la primera palabra parece un programa. `comando.test.ts` |
| 2 | `git add .`, `cd ..` se tomaban por prosa | La prosa se mira por sus palabras, no por el punto. `comando.test.ts` |
| 3 | Un programa seguido de prosa («make sure…», `export const`) | Prosa sin argumentos descartada; `export` solo con `NOMBRE=`. `comando.test.ts` |
| 4 | La tarjeta pintaba el título (recortado o cambiado) | Los comandos del original. `Vista.test.tsx` |
| 5 | Faltaba la segunda frase de la referencia; «…» y punto | La frase, y «y N más». `comando.test.ts` |
| 6 | «Copiar» sin huecos fallaba en silencio | El mismo respaldo que «Copiar con valores» (`CopiarTexto`). `Vista.test.tsx` |
| 7 | `sudo -u x`, `time`, `env` y variables en minúscula | Se saltan. `comando.test.ts` |
| 8 | `{{end}}` de las plantillas de Go como hueco | Ya no. `comando.test.ts` |
| 9 | Heredocs, comillas en varias líneas, sesiones con salida y otros prompts | Se reconocen. `comando.test.ts` |
| 10 | «Copiar con valores» se ocultaba en solo lectura (y en el hilo no hacía nada) | «Abrir» se ofrece siempre y lleva al elemento también desde el hilo |
