# IN-046 · Petición HTTP

## Objetivo y catálogo

Que un `curl` pegado (el «Copiar como cURL» del navegador, el de una documentación o el de un compañero) se guarde como una petición legible: método, URL, cabeceras y cuerpo separados, con los secretos ocultos, en una tabla, y que se pueda copiar otra vez como cURL o como `fetch`. Catálogo: **LEC-13** (plan §8, «Separa método, URL, cabeceras y cuerpo, con secretos ocultos»). Depende de IN-010 (ocultación de secretos).

## Estado de partida

- El tipo `http` (prefijo `HTP`, icono propio, clase `k-url`) existe en `@rimor/formato` y en los iconos; `ORDEN_DETECCION` reserva el puesto 9 («empieza por `curl`»). Hoy un `curl` es un Comando (`fixtures/deteccion/comando/08.txt`: `curl -sS -H … | jq …`).
- La referencia no dibuja la pantalla: solo el tipo («Petición HTTP», `HTP`, color de enlace) y la detección del prototipo (`^curl\s` → 0,9). Se compone con sus piezas (tarjetas, `kv`, tablas, `pre`, botones).
- Ocultación (IN-010): `ocultar` corre antes de detectar; hay reglas para `Authorization`, contraseñas en URL y cadenas, JWT y claves de proveedores. Faltan las de una petición: `Cookie` (y `curl -b`), cabeceras de clave (`X-Api-Key`, `Private-Token`…), claves en la consulta de la URL (`?api_key=`, `access_token=`, `X-Amz-Signature=`) y `curl -u usuario:contraseña`.
- El compositor de respuestas ya añade «He ocultado N secretos antes de guardar.» si los hubo: la del lector, una frase.

## Diseño

### Analizar un `curl` (`src/lectores/http/analisis.ts`, TS puro)

- Palabras como las parte un shell: comillas simples y dobles (con sus escapes), `$'…'`, `\` al final de línea (y `^` del «Copiar como cURL (cmd)» de Windows), un `$ ` de prompt delante. Lo que va tras `|`, `;`, `&&` o `>` fuera de comillas es la **tubería** (`| jq '.x'`): se conserva aparte.
- Opciones: `-X/--request`, `-H/--header`, `-d/--data/--data-raw/--data-binary/--data-ascii/--data-urlencode` (varias se unen con `&`; con datos y sin `-X`, POST), `--json` (cuerpo, `Content-Type` y `Accept` JSON, POST), `-F/--form` (multipart, partes), `-u/--user`, `-b/--cookie` (como cabecera `Cookie`), `-A/--user-agent`, `-e/--referer`, `-G/--get` (los datos a la consulta), `-I/--head` (HEAD), `--url`; cortas juntas (`-sSL`), pegadas (`-XPOST`, `-H'…'`) y `--opcion=valor`. Las demás (`-L`, `-k`, `--compressed`, `-o x`…) se guardan como opciones, con su valor si lo llevan.
- Resultado: `{ metodo, url, consulta: [nombre, valor][], cabeceras: [nombre, valor][], cuerpo?: { tipo: 'json' | 'formulario' | 'multipart' | 'texto', texto, partes? }, usuario?, opciones: string[], tuberia? }`, o `null` si no es un único `curl` con URL.
- `aCurl(p)`: el `curl` canónico en varias líneas (`\`), con lo oculto tal cual. `aFetch(p)`: `await fetch(url, { method, headers, body })` (con `credentials: 'include'` si lleva cookies; el usuario, como `Authorization: Basic` solo si no está oculto; una nota si hay tubería u opciones que `fetch` no tiene).

### El lector `http`

- Puesto 9; `detectar`: 0,92 si el texto entero es **un** `curl` con URL (con continuaciones y tubería); varios comandos siguen siendo Comando. `leer`: título «POST api.example.org/v1/pagos», resumen `{ metodo, host, cabeceras }`.
- `derivar`: el análisis. Respuesta: «POST a `api.example.org/v1/pagos` con 3 cabeceras y un cuerpo JSON.» (la URL sin esquema, en mono y recortada a 60), «GET a `…`» sin cuerpo; la frase de los secretos la añade el compositor.
- Cifras: `cabeceras`.

### Secretos (IN-010, reglas nuevas para todo lo que se captura)

- `cookie` (tipo `cookie`): el valor de `Cookie:` y `Set-Cookie:` y de `curl -b 'a=b'` (con `=`: `-b cookies.txt` es un archivo).
- `cabecera-clave` (tipo `clave-api`): el valor de `X-Api-Key`, `Api-Key`, `X-Auth-Token`, `X-Access-Token`, `Private-Token`, `X-Goog-Api-Key` y `Ocp-Apim-Subscription-Key`.
- `clave-url` (tipo `clave-api`): el valor de `api_key`, `apikey`, `access_token`, `token`, `client_secret`, `secret`, `password`, `X-Amz-Signature` y `X-Amz-Security-Token` en la consulta de una URL.
- `usuario-curl` (tipo `contrasena`): la contraseña de `curl … -u usuario:contraseña` (no el usuario; solo en un `curl`: `docker -u 1000:1000` no es una contraseña).
- Ajustes las enseña con sus nombres; el corpus de secretos y el de logs limpios las vigilan.

### La vista

- Tarjeta con el método (chip) y la URL en mono; «Consulta» (tabla nombre · valor) si la URL la lleva; «Cabeceras» (tabla); «Cuerpo» (`pre`, el JSON con sangría); «Opciones» y «Tubería» si las hay. Botones «Copiar como cURL» y «Copiar como fetch», con el respaldo de copiar a mano si el navegador no deja.

## Tareas

- [x] Analiza cURL: método, URL, cabeceras y cuerpo, con secretos ocultos.
- [x] Vista en tabla.
- [x] Copiar como cURL o como `fetch`.

## Pruebas previstas

- Análisis: el «Copiar como cURL» de Chrome y Firefox (bash), el de Windows (cmd), `--json`, `-F`, `-G`, `-I`, `-u`, `-b`, cortas juntas y pegadas, `--opcion=valor`, tubería; no es una petición: varios comandos, un `curl` sin URL, prosa que menciona curl.
- `aCurl` y `aFetch` (cabeceras, cuerpo, cookies, lo oculto tal cual) y que `aCurl(analizar(x))` se vuelva a analizar igual.
- Secretos: casos nuevos en el corpus de secretos; el de logs limpios sin falsos positivos (`docker run -u 1000:1000`, `?key=valor`).
- Detección: corpus `fixtures/deteccion/http/` (25) y el resto sin bajar del 90 %; `comando/08` (un `curl | jq`) pasa a `http/`.
- Respuesta es y en, reglas de estilo; vista (tablas, cuerpo, copiar).

## Criterios de aceptación

- `pnpm verificar` en verde; un `curl` pegado se guarda con el lector `http`, con sus secretos ocultos, su tabla, su respuesta y «Copiar como cURL» y «como fetch».

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `curl … \| jq` es un comando o una petición | Petición: lo esencial es la petición; la tubería se conserva y se enseña, y «Copiar como cURL» la mantiene. El ejemplo del corpus pasa de Comando a HTTP. |
| Falsos positivos de las reglas nuevas | Cabeceras con nombre propio, parámetros de consulta concretos y `-u` solo dentro de un `curl`; el corpus de logs limpios las vigila. |
| `fetch` no tiene todas las opciones de curl (`-k`, `-L`, proxies) | Se dice en un comentario del código copiado; no se inventa nada. |
| El «Copiar como cURL (cmd)» de Windows escapa con `^` | Se reconoce y se deshace al partir las palabras. |

## Autorrevisión

Cubre las tres tareas. Reutiliza el contrato de lectores, la ocultación de IN-010 (con reglas nuevas, también útiles fuera de las peticiones), la frase común de secretos, las tablas y el copiar con respaldo de IN-023.

## Implementación

- `src/lectores/http/`: `analisis.ts` (palabras de shell en bash y en `cmd`, opciones de curl, consulta, cuerpo; `urlCorta`, `hostDe`), `exportar.ts` (`aCurl`, `aFetch`; solo lo carga la vista), `lector.ts` (`lectorHttp`, puesto 9, con «ilegible» si el original ya no es un curl), `textos.ts`, `Vista.tsx` y `Tarjeta.tsx`.
- `BotonCopiar` (en `CopiarConValores.tsx`): el botón de copiar sin fila, con el respaldo de copiar a mano; `CopiarTexto` lo usa.
- Secretos (`seguridad/secretos/reglas.ts`): `cookie` y `cookie-curl` (el valor de cada cookie, con su nombre a la vista), `cabecera-clave`, `clave-url` y `usuario-curl`; en Ajustes, los tipos `cookie` y `clave-api` (y `contrasena` nombra `curl -u`). Ni ellas ni la de `Authorization` ocultan una variable (`$TOKEN`, `{{token}}`).
- Corpus: `fixtures/deteccion/http/` (25; el `curl … | jq` de `comando/08` pasa a `http/01`); casos nuevos en el de secretos y negativos en el de líneas limpias. El corpus entero, al 100 %.
- Pruebas: `http/http.test.ts` (palabras, opciones, ida y vuelta de `aCurl`, `aFetch`, detección, secretos, respuestas) y `http/Vista.test.tsx` (tablas, copiar como cURL y como fetch, ilegible y la captura con el token oculto y la frase de secretos).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| La regla de cookies oculta el valor de cada una, no la cabecera entera | Los nombres dicen algo (`sesion`, `tema`) y, si un valor es un JWT, se queda esa regla, más precisa. |
| Las reglas no ocultan variables (`$TOKEN`, `{{token}}`), tampoco la de `Authorization` | No son secretos: ocultarlas quitaba información (y una petición de una documentación dejaba de leerse igual). |
| `aCurl` escribe `-I` para HEAD | Con `-X HEAD`, curl espera un cuerpo que no llega. |
| `aCurl` y `aFetch` van en un módulo que solo carga la vista | La carga inicial lleva solo lo que necesita la detección (268,6 KB de 300). |

## Verificación

**`pnpm verificar`**: en verde, 119 archivos y 1541 pruebas, más la de rendimiento aparte; carga inicial 271,0 KB de 300 (+2,4 KB: las reglas de secretos van con la captura, en la carga inicial). Dos ejecuciones anteriores fallaron por tiempos agotados al azar en pruebas que no tocan esto (un `render` de un SVG, lecturas de fixtures): atascos de WSL leyendo de la unidad `D:`; la siguiente, en verde.

**Criterios de aceptación:** un `curl` pegado se guarda con el lector `http`, con sus secretos ocultos, su tabla, su respuesta y «Copiar como cURL» y «como fetch» (`http.test.ts`, `Vista.test.tsx`; corpus al 100 % en todos los tipos).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Analiza cURL con secretos ocultos | `http.test.ts` (bash, cmd real de Chrome, `$'…'`, opciones, URL), `ocultar.test.ts` y el corpus de secretos (cookies, cabeceras, URL, cuerpo, JSON, `-u`) |
| Vista en tabla | `Vista.test.tsx` |
| Copiar como cURL o como `fetch` | `http.test.ts` (ida y vuelta, notas), `Vista.test.tsx` (los dos botones) |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | `usuario-curl` cuadrática: segundos con un JSON de logs con `curl/7.81.0` | `contrasenasDeCurl` lineal (un recorrido por orden curl). `ocultar.test.ts` |
| 2 | El «Copiar como cURL (cmd)» real (`^"…^"`, `\^"`, `^&`) se leía mal; los secretos rompían sus comillas | `palabrasCmd` en dos capas (cmd y MS CRT); las reglas no se comen `^`; fixture `http/09` real. `http.test.ts`, `ocultar.test.ts` |
| 3 | Cookies con comillas dentro o en `$'…'` quedaban a la vista | El valor llega hasta la comilla que cierra su argumento (`peticiones.ts`). `ocultar.test.ts`, corpus |
| 4 | Secretos del cuerpo (`-d client_secret=…`, `"password": "…"`) sin ocultar | `clave-url` también tras `-d`/`--data*`/`-F`, con `refresh_token`, `id_token`…; regla `clave-json`. Corpus |
| 5 | Varias órdenes tras una tubería pasaban por una petición; notas de varias líneas rompían el JavaScript | La tubería acaba en su orden; cada línea de nota, comentada. `http.test.ts` |
| 6 | Opciones con valor sin listar (`--max-redirs`, `--unix-socket`, `-D`…): la URL tomaba su valor | Las de `curl --help all` y la URL tiene que parecer una URL. `http.test.ts` |
| 7 | «Curl no funciona…» se tomaba por una petición | Ídem (sin URL, no es una petición). `http.test.ts` |
| 8 | `fetch` con GET y cuerpo lanza TypeError | Sin cuerpo y con una nota. `http.test.ts` |
| 9 | `@archivo` se exportaba como texto literal | `cuerpo.archivo`: `--data-binary @x` y una nota en `fetch` (también en las partes de `-F`). `http.test.ts` |
| 10 | Cabeceras repetidas: `fetch` se quedaba con la última | Cabeceras como pares. `http.test.ts` |
| 11 | Faltaban cabeceras (`X-RapidAPI-Key`, `apikey`, `X-Auth-Key`…), esquemas de Authorization, `--oauth2-bearer`, `#access_token`, `private_token`, `sig`, `-U` | Ampliadas (con el prefijo acotado: sin retroceso cuadrático); regla `oauth2-bearer`. `ocultar.test.ts`, corpus |
| 12 | `-uadmin:…`, `-su …`, `'admin:clave con espacios'` sin ocultar; `docker -u 1000:1000` tras una tubería, oculto | `contrasenasDeCurl` (pegado, cortas juntas, argumento entero, solo dentro de su orden). `ocultar.test.ts` |
| 13 | `Set-Cookie` no se ocultaba (la ficha decía que sí) | Se oculta su primer valor si parece una sesión (16 caracteres o más); `tema=oscuro` y los atributos, no. `ocultar.test.ts` |
| 14 | `$'…'` sin `\u`, octal ni `\cX` | Añadidos. `http.test.ts` |
| 15 | Un comentario `#` delante impedía reconocerlo | Se saltan las líneas de comentario de delante. `http.test.ts` |
| 16 | Un `^"` dentro de un argumento de bash pasaba a modo cmd | Modo cmd solo si empieza por `curl ^"` o hay líneas que acaban en ` ^`. `http.test.ts` |
| 17 | `-T` daba GET | PUT implícito. `http.test.ts` |
| 18 | `--data-urlencode '=x'` dejaba el `=`; `nombre@archivo` se codificaba | Como lo manda curl. `http.test.ts` |
| 19 | `-u usuario` sin contraseña daba un Basic incompleto | Una nota (curl la pediría). `http.test.ts` |
| 20 | Notas de `fetch` inexactas (`-L`, `--compressed`) | Las opciones que `fetch` ya hace no se avisan. `http.test.ts` |
| 21 | Un método raro (`-X 'GET. Y luego!'`) rompía las reglas de estilo | Si no es una palabra en mayúsculas, en mono. `http.test.ts` |
| 22 | `x.org\|jq` sin espacios; continuaciones de PowerShell | Se corta también pegado; `` ` `` al final de línea continúa. `http.test.ts` |

### Decisiones de la verificación

| Decisión | Por qué |
|---|---|
| `curl … \| sh` (instaladores) es una Petición | Lo esencial sigue siendo la petición; la tubería se enseña y se conserva al copiar. |
| Las reglas de petición viven en `seguridad/secretos/peticiones.ts` | Leen argumentos de shell (dónde acaba cada uno); una expresión sola cortaba en comillas de dentro o retrocedía. |
| Set-Cookie, solo si parece una sesión | El corpus de líneas limpias tiene `Set-Cookie: tema=oscuro` (un ajuste); una sesión es larga. |
