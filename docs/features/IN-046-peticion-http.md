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
