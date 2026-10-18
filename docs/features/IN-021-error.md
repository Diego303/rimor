# IN-021 · Lector Error y huella

## Objetivo y catálogo

Lo que importa de un error: qué es, si ya pasó y qué se hizo entonces. Catálogo: **LEC-05** y **ORG-06** (huella y ocurrencias; plan §8.2). Depende de IN-017; usa el contexto de IN-016 (misma huella y notas de los resueltos).

## Estado de partida

- `construirContexto` ya busca otros elementos con la misma `lector.resumen.huella` (con el resumen de los derivados) y lee la primera línea de las notas de los que están `resuelto`.
- La pantalla de referencia del Error: tarjeta con el mensaje en mono y «en `src/gateway/stream.rs:142:17`»; tarjeta con el veredicto `bad` «3.ª vez», «Ya te pasó el 2 y el 15 de octubre.» y «El 15 escribiste: «…»», con [Ver el hilo] y [Añadir cómo lo resolví]; «Dónde, en tu código» (función en mono y ruta en mono pequeña); y plegados «Librerías y sistema (N marcos)», «Traza original» y «Detalles» (huella, cómo se calcula y cifras). Su huella: lenguaje, mensaje con los números como `<N>` y los dos primeros marcos propios.

## Diseño

### `src/lectores/error/trazas.ts` (puro)

`analizarTraza(texto)` → `{ lenguaje, tipo, mensaje, donde?, marcos: [{ funcion, ruta, linea?, propio }] }` para:

- **Rust**: `thread '…' panicked at ruta:l:c:` + mensaje; `stack backtrace:` con `N: función` / `at ruta:l:c`; tipo del mensaje (`called Result::unwrap() on an Err value: Timeout(…)` → `Timeout`) o `panic`.
- **Python**: `Traceback (most recent call last):`, `File "ruta", line N, in función`; la última línea `Tipo: mensaje` (también con módulo, `requests.exceptions.ConnectionError`); marcos en el orden de la traza (el más interno al final).
- **JavaScript y Node**: `Tipo: mensaje` y `at función (ruta:l:c)` o `at ruta:l:c`; también `Uncaught Tipo: …`.
- **Java y Kotlin**: `Exception in thread "x" paquete.Tipo: mensaje` o `paquete.Tipo: mensaje`, `at paquete.Clase.método(Archivo.java:N)`, `Caused by:` (la causa más profunda da el tipo y el mensaje).
- **Go**: `panic: mensaje`, `goroutine N [running]:`, pares `paquete.función(…)` / `\truta.go:N +0x…`.
- **.NET**: `Unhandled exception. System.Tipo: mensaje` o `System.Tipo: mensaje`, `at Espacio.Clase.Método() in ruta:line N`.

**Tus marcos frente a librerías y sistema** (heurísticas del plan): de librería si la ruta tiene `node_modules`, `site-packages`, `dist-packages`, `/usr/lib/python`, `.cargo/registry`, `/rustc/`, `/usr/local/go/`, `/go/pkg/mod/`, `node:internal`, `internal/`, `<anonymous>`, o si la función es de `java.`, `javax.`, `jdk.`, `sun.`, `kotlin.`, `kotlinx.`, `android.`, `org.springframework.`, `org.apache.`, `com.fasterxml.`, `System.`, `Microsoft.`, `std::`, `core::`, `alloc::`, `tokio::`, `runtime.`; propios, los demás (y en Rust, las rutas relativas `src/…`).

### Huella

`huella = sha256(v1 | lenguaje | tipo | mensaje normalizado | 2 primeros marcos propios)`, recortada a 16 caracteres hexadecimales. El **mensaje normalizado** quita números, hexadecimales, UUID, IP, rutas y direcciones de memoria (`<N>`, `<HEX>`, `<ID>`, `<IP>`, `<RUTA>`); los **marcos** se toman por su función sin números de cierre (`{{closure}}#2`), sin el hash de Rust (`::h1a2b3c4d…`) ni la lambda de Java (`lambda$main$0`). **Versionada**: `VERSION_HUELLA = 1` va en el resumen junto a la huella; si cambia el algoritmo, sube la versión del lector y todos los derivados (y sus huellas, vía `alDerivar`) se recalculan; los hilos (IN-030) se enlazan por ref y no se pierden.

### El lector (`src/lectores/error/`)

- `detectar`: 0,9 con una traza reconocible (las cabeceras y marcos de arriba); 0,7 con una línea `Tipo: mensaje` de error conocido sin traza (`TypeError: …`, `java.lang.NullPointerException`, `panic: …`); si no, 0.
- `leer`: título `Tipo: mensaje` recortado; resumen provisional `{ lenguaje, tipo }`.
- `derivar` → `DatosError`: lo de `analizarTraza` más `huella` y `version`.
- `resumen`: `{ lenguaje, tipo, huella, huellaVersion, propios }`; `resumenLegible`: «Rust · Timeout».
- **Respuesta**: con ocurrencias anteriores, «Es la tercera vez.» y, si alguna resuelta tiene nota, «El 15 oct escribiste: «…».» (cita); si no, «Error de Rust nuevo. 2 marcos de tu código.» (o «Ningún marco es de tu código.»). Así cuenta además `erroresReconocidos` (contadores de IN-016) cuando la reconoce.
- **Cifras**: `ocurrencias`, `primera_vez`, `ultima_vez`. Dependen de los demás elementos: el contrato admite que una cifra reciba el contexto (`(d, ctx?) => Cifra`, compatible con los lectores existentes).

### Vista y «así lo resolví»

Como la pantalla de referencia. La tarjeta de ocurrencias sale si hay alguna anterior (la vista las busca en el repositorio por la huella) y lleva **Añadir cómo lo resolví**: un área de texto en la propia tarjeta que guarda la nota al principio de las notas del elemento y lo marca `resuelto` (con `actualizarElemento`); la próxima vez que aparezca la misma huella, la respuesta y la vista citan esa nota. «Ver el hilo» llega con IN-030.

### Corpus

- `fixtures/trazas/<lenguaje>/*.txt`: 6 lenguajes × 5 trazas reales, con `esperado.json` (tipo, mensaje, nº de marcos propios).
- `fixtures/deteccion/error/`: 25 de ellas para la matriz.

## Tareas

- [x] Analizadores de trazas: Rust, Python, JavaScript y Node, Java y Kotlin, Go y .NET.
- [x] Marcos de tu código frente a librerías y sistema.
- [x] Huella versionada.
- [x] Ocurrencias anteriores con la misma huella y su nota «así lo resolví».
- [x] Vista: mensaje; «3.ª vez» con la nota; tus marcos; librerías y traza original, plegadas.
- [x] Cifras: `ocurrencias`, `primera_vez`, `ultima_vez`.
- [x] Respuesta: «Es la tercera vez. El 15 oct escribiste: «…».» o «Error de Rust nuevo. 2 marcos de tu código.»

## Pruebas previstas

- Las 30 trazas: lenguaje, tipo, mensaje y marcos propios esperados.
- La misma traza con otras rutas absolutas, números de línea, direcciones y valores da la misma huella; dos errores con el mismo mensaje y marcos propios distintos, no.
- Respuesta nueva y repetida (con nota) en es y en; reglas de estilo de IN-016; cifras con contexto.
- Vista (happy-dom): mensaje, «3.ª vez» con la nota, tus marcos, plegados; «Añadir cómo lo resolví» guarda la nota y marca resuelto.
- Matriz con la carpeta `error`; ningún log ni texto pasa por error.

## Criterios de aceptación

- Las pruebas de la ficha (6 × 5 trazas; huella estable; huellas distintas con marcos propios distintos).
- `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Un log que contiene una traza | Si el texto es sobre todo líneas de log, gana Log (0,85 frente a 0,9 solo si la traza domina); la duda se ofrece al capturar |
| Las cifras dependen de otros elementos | Firma de cifra con contexto opcional |
| Cambiar el algoritmo de huella | Versión de huella y del lector; se recalculan al pedirse |

## Autorrevisión

Cubre las siete tareas y las pruebas de la ficha. «Así lo resolví» se apoya en las notas y el estado que ya existen; los hilos (IN-030) y la comparación de errores no son de esta IN.

## Cambios durante la implementación

- Las cifras reciben el contexto **y el propio elemento** (`FuncionCifra<D> = (d, ctx?, el?) => Cifra`): `ocurrencias`, `primera_vez` y `ultima_vez` cuentan también la captura actual.
- La fecha de la nota citada es la del elemento resuelto (`modificado`: cuando se escribió la nota).
- «Errores reconocidos» (contadores de IN-016) se cuenta en la captura cuando, con sus derivados, la huella ya estaba en otro elemento.
- Un texto forzado con `/error` que no es una traza ni un error conocido se guarda con su primera línea como mensaje (lenguaje «código»).
- En Rust solo es propio un marco con ruta (los de la librería estándar a menudo no la llevan); en Go, los de `main.` y los de módulos con punto en su primera parte fuera de `pkg/mod`.
- El corpus de detección `error` toma 4 trazas de cada lenguaje y una más de Rust.


## Verificación

**`pnpm verificar`** (2026-10-18 21:50): tipos 0 errores; Biome, colores y textos, OK; Vitest 51 archivos y 724 pruebas, OK; construcción OK; carga inicial 193,5 KB. **`pnpm deteccion`**: 100 % de 150 ejemplos.

| Criterio | Evidencia |
|---|---|
| Analizadores de seis lenguajes | Las 30 trazas del corpus y 25 variantes reales de `fixtures/trazas/variantes/`, con tipo, mensaje y **nombre** de cada marco propio |
| Marcos de tu código frente a librerías y sistema | Variantes con Spring, PostgreSQL, Gradle, la librería estándar de Go fuera de `/usr/local/go`, `-trimpath`, Python en Windows y `Promise.all` |
| Huella estable | Otras rutas, números, direcciones (`RUST_BACKTRACE=full`), goroutines y celdas de Jupyter dan la misma huella |
| Huellas distintas con marcos propios distintos | Métodos de Go con receptor, Python con los mismos marcos externos, funciones anónimas de archivos distintos, Java con otra clase |
| Ocurrencias y «así lo resolví» | Respuesta y vista citan solo notas de ocurrencias anteriores; ya resuelto, la vista enseña lo que escribiste y no ofrece añadirlo otra vez |
| Vista | Prueba de la vista: «3.ª vez», «el 2 y el 15 de octubre», la nota, tus marcos, plegados; guardar la nota y verla después |
| Cifras | `ocurrencias`, `primera_vez`, `ultima_vez` con el contexto y el propio elemento |
| Respuesta | Nueva y repetida (con nota) en es y en; ordinales ingleses correctos |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Go: los métodos con receptor puntero perdían el nombre** (y dos métodos distintos compartían huella): el nombre llega hasta el paréntesis de los argumentos.
2. **`java.lang.Exception`, `java.lang.Error` y `System.Exception` no se reconocían**: el prefijo antes del sufijo es opcional.
3. **La cabecera de .NET Framework y Mono** (`Unhandled Exception: …`) se reconoce.
4. **Un log con una traza en medio pasaba a Error**: si el texto es sobre todo log, Error baja a 0,75 (Log gana con 0,85 y se ofrece la duda).
5. **Python tomaba los dos marcos más externos para la huella**: se toman los dos propios más internos, en cualquier lenguaje.
6. **Direcciones de `RUST_BACKTRACE=full` y «in goroutine N» de `created by`** ya no entran en la función.
7. **Node con ` {` al final del marco o con `[cause]`**: se quita la llave; los marcos de la causa no cuentan; `Promise.all (index 0)` es de sistema.
8. **Funciones anónimas que chocaban**: cada marco entra en la huella con su archivo (sin carpetas); la celda de Jupyter, sin su número.
9. **Python tomaba como tipo la última línea sin sangría** (pydantic, uvicorn): es la primera tras los marcos; con excepciones encadenadas manda el último bloque.
10. **Librerías tomadas por tuyas**: más espacios de nombres de Java, proxies de Spring, la librería estándar de Go por su paquete (sin punto antes de la barra), módulos con versión (`@v1.9.1`) y `\Lib\` de Python en Windows.
11. **Formatos que no se leían**: Gradle (`app//`), módulos de Java (`modulo@1.0/`), genéricos de Go, IPython y Jupyter, pilas de Firefox y Safari.
12. **Título repetido en Go**: «runtime error: …» sin repetir el tipo.
13. **Ordinales ingleses**: «2nd», «21st», «22nd» con `fmtOrdinal`.
14. **«Así lo resolví» no se veía en el propio elemento**: ya resuelto, la vista enseña la nota y no ofrece añadir otra; solo se citan notas de ocurrencias anteriores.
15. **«Errores reconocidos» contaba de más con dos errores iguales a la vez**: cuenta solo si la huella está en un elemento anterior (por ULID).
16. **Un texto con «  at least…» se tomaba por traza**: un marco de JavaScript necesita una ubicación (`ruta:línea` o una de sistema).
17. **Expresión cuadrática en los marcos de JavaScript**: se parten a mano por el último « (».
18. **Diferencias con la referencia**: la nota del veredicto va con el color del texto (`p.sm`) y las fechas del mismo mes se dicen «el 2 y el 15 de octubre».

Sin cambiar: la fecha de la nota citada es `modificado` del elemento resuelto (una edición posterior la mueve); deshacer una captura no descuenta «errores reconocidos». La versión de la huella sigue en 1: no se ha publicado ninguna versión con la anterior.
