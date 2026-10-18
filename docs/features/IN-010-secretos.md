# IN-010 · Ocultación de secretos

## Objetivo y catálogo

Que ninguna clave llegue nunca al disco. Catálogo: **CAP-05**. Depende de IN-001.

## Estado de partida

- Nada de seguridad de contenido pegado más allá del saneado (IN-009).
- El flujo de captura (IN-014) llamará a `ocultar` **antes de nada**; el compositor (IN-015) enseñará qué se ocultará y permitirá desactivar una regla para ese pegado; Ajustes (IN-038), las reglas activas.

## Diseño

### Módulos

```
src/seguridad/secretos/reglas.ts    ← REGLAS_SECRETOS: id, tipo y expresión (adaptadas de gitleaks)
src/seguridad/secretos/ocultar.ts   ← buscarSecretos(texto, opciones) y ocultar(texto, opciones) puras
src/seguridad/secretos/corpus/      ← secretos falsos que deben ocultarse y líneas de log que no
```

```ts
interface Hallazgo { regla: string; tipo: string; posicion: number; longitud: number }
interface Ocultado { texto: string; hallados: Hallazgo[] }
function ocultar(texto: string, opciones?: { desactivadas?: ReadonlySet<string> }): Ocultado;
```

- El secreto se sustituye por `‹oculto:tipo›` (`‹oculto:github›`, `‹oculto:contrasena›`). **El valor original no se devuelve nunca**: los hallazgos solo dicen regla, tipo, posición y longitud en el texto de entrada.
- **Solo la parte secreta:** en una cabecera `Authorization: Bearer abc`, se oculta `abc`; en `postgres://ana:clave@host`, solo `clave`. Así el contexto sigue siendo legible.
- **Idempotente:** ninguna regla casa con un texto que empieza por `‹oculto:` (búsqueda negativa delante del secreto) y las marcas no contienen nada que case con otra regla.
- **Solapes:** si dos reglas encuentran el mismo trozo, gana la que empieza antes y, a igualdad, la más larga.
- **Desactivar una regla para un pegado:** `desactivadas` con su `id`.

### Reglas

| Regla | Qué detecta |
|---|---|
| `clave-privada` | Bloques PEM `-----BEGIN … PRIVATE KEY-----` (RSA, EC, OPENSSH, PKCS#8; también la clave de una cuenta de servicio de GCP) |
| `aws-id`, `aws-secreto` | `AKIA…`/`ASIA…` de 20 caracteres; `aws_secret_access_key = …` de 40 |
| `gcp-api` | `AIza…` de 39 caracteres |
| `azure-almacen`, `azure-cliente` | `AccountKey=…==` de 88; secreto de cliente de Entra ID (`xxx8Q~…`) |
| `github` | `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` y `github_pat_` |
| `gitlab` | `glpat-…` |
| `slack`, `slack-webhook` | `xoxb-`, `xoxp-`…; la ruta secreta de `hooks.slack.com/services/…` |
| `openai`, `anthropic`, `openrouter` | `sk-…` (incluidos `sk-proj-`), `sk-ant-api03-…`, `sk-or-v1-…` |
| `jwt` | `eyJ….eyJ….…` |
| `authorization` | Valor de una cabecera `Authorization` (Bearer, Basic, Token, Bot), también dentro de `-H "…"` de cURL |
| `contrasena-url` | La contraseña de `esquema://usuario:contraseña@host` (cadenas de conexión y URL) |
| `contrasena-cadena` | `Password=…` / `Pwd=…` en cadenas clave-valor (ADO.NET, JDBC) |

## Tareas

- [ ] Reglas adaptadas de gitleaks (la tabla).
- [ ] `ocultar(texto)` pura con `‹oculto:tipo›`.
- [ ] Idempotencia.
- [ ] Desactivar una regla para un pegado concreto.

## Pruebas previstas

- **Corpus de secretos:** 40 secretos falsos con su contexto (variables de entorno, JSON, YAML, cURL, logs, cadenas de conexión), uno o más por regla. Todos deben ocultarse y el texto resultante no contiene ningún trozo del secreto. Los valores se construyen en el propio archivo concatenando trozos, para que ningún escáner de secretos del repositorio los tome por reales.
- **Corpus de falsos positivos:** 120 líneas de logs reales sin secretos (hashes de commit, UUID, sumas SHA-256, base64 de datos, rutas, versiones, IP, URL sin contraseña, `sk-` en palabras corrientes). Menos del 2 % de líneas con algún hallazgo.
- **Propiedad** (fast-check): `ocultar` es idempotente sobre textos arbitrarios y sobre mezclas de secretos del corpus con texto aleatorio.
- La parte oculta es solo el secreto (cabeceras, URL); `desactivadas` respeta la regla; los hallazgos no llevan el valor.

## Criterios de aceptación

- El 100 % del corpus de secretos se oculta.
- Menos del 2 % de falsos positivos en el corpus de logs.
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Expresiones demasiado anchas (falsos positivos en logs) | Solo formatos con prefijo reconocible o con contexto (cabecera, `clave=`); nada de «cadena larga aleatoria» |
| Escáneres de secretos que bloqueen el `push` del autor | Corpus construido por concatenación; ningún secreto literal en el código |
| Coste en textos grandes | Expresiones sin retroceso catastrófico (sin cuantificadores anidados); prueba con 1 MB |

## Autorrevisión

Cubre la ficha. La interfaz (qué se ocultó, desactivar para un pegado) la ponen IN-015 e IN-038 sobre esta función.

## Cambios durante la implementación

- Las expresiones llevan la bandera `d` (posiciones de los grupos) para ocultar exactamente el grupo `secreto` cuando la regla tiene contexto.
- Corpus en `src/seguridad/secretos/corpus/` (42 secretos falsos y 125 líneas de log limpias), con los valores armados por concatenación.
- La comprobación de colores no mira las carpetas `corpus/` (son datos de prueba; un log con «build #4123» no es un color).
