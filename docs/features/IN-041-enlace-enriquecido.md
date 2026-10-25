# IN-041 · Enlace enriquecido

## Objetivo y catálogo

Que un enlace a un repositorio, un paquete o un paper guarde, además de la dirección, una **ficha con fecha** de lo que dicen sus APIs públicas (actividad, último lanzamiento, licencia, vulnerabilidades, autores…), consultando solo los dominios que se hayan activado y diciendo antes cuáles son. Sin red, todo sigue como en v0.1. Catálogo: **LEC-03b** (plan §8.6). Depende de IN-019 (lector Enlace) y F0-7 (qué APIs admiten CORS).

## Estado de partida

- El lector Enlace (IN-019) normaliza la URL y la clasifica: `repositorio`, `issue`, `pr` (GitHub y GitLab, con `nombre` = `dueño/repo` y `numero`), `paquete` (npm, crates.io, PyPI, pkg.go.dev, Maven Central…, con `nombre`), `paper` (arXiv y DOI, con `nombre` = id) y otros. No usa la red.
- La CSP (`scripts/csp.mjs`) ya lleva en `connect-src` los diez dominios que F0-7 validó: `api.github.com`, `gitlab.com`, `api.deps.dev`, `registry.npmjs.org`, `crates.io`, `pypi.org`, `api.osv.dev`, `api.crossref.org`, `doi.org` y `api.datacite.org`.
- `.rimor/ajustes.json` admite `red: { sinRed, dominios }` en su esquema; nada lo usa. La tarjeta «Red» de Ajustes dice que Rimor no se conecta a ningún sitio.
- La `Senal` no tiene el estado `sin-conexion` (SVG 16 de rimor-animaciones). Su CSS y `Senal.tsx` tienen que pesar menos de 4 KB comprimidos (prueba de IN-090): hoy, 4.079 bytes.

## Diseño

### Proveedores (`src/lectores/enlace/enriquecer/`, TS puro)

```ts
interface Enriquecedor {
  id: 'github' | 'gitlab' | 'paquete' | 'crossref' | 'arxiv';
  acepta(d: DatosEnlace): boolean;
  /** Los dominios que consultaría para este enlace (se enseñan antes de la primera consulta). */
  dominios(d: DatosEnlace): string[];
  consultar(d: DatosEnlace, c: Consulta): Promise<CamposFicha>;
}
interface Consulta { pedir: (url: string, init?: RequestInit) => Promise<Response>; activos: ReadonlySet<string>; token?: string; senal?: AbortSignal }
interface Ficha { fuente: Enriquecedor['id']; consultada: string /* ISO con zona */; campos: CamposFicha }
type CamposFicha = Record<string, string | number | boolean | null>;
```

Solo los validados por F0-7:

| Enlace | Proveedor | Consultas | Campos |
|---|---|---|---|
| Repositorio, issue o PR de GitHub | `github` | `api.github.com/repos/{o}/{r}` (+ `/releases/latest`; issue o PR: `/issues/{n}`) con `Authorization: Bearer` si hay token | descripción, estrellas, licencia, issues abiertas, último push, archivado, último lanzamiento y su fecha; de issue o PR, título, estado y comentarios |
| Repositorio de GitLab | `gitlab` | `gitlab.com/api/v4/projects/{ruta}?license=true` | descripción, estrellas, licencia, última actividad, archivado |
| Paquete npm, crates.io o PyPI | `paquete` | su registro (`registry.npmjs.org`, `crates.io`, `pypi.org`) + `api.osv.dev` (vulnerabilidades de esa versión) | última versión, su fecha, licencia, vulnerabilidades |
| Paquete Go o Maven | `paquete` | `api.deps.dev` (versión por defecto, fecha y licencias) + `api.osv.dev` | igual |
| Paper con DOI | `crossref` | `api.crossref.org/works/{doi}` | título, autores, año, revista |
| Paper de arXiv | `arxiv` | `api.datacite.org/dois/10.48550/arXiv.{id}` (arXiv no admite CORS, F0-7) | título, autores, año |

- Un dominio no activado no se consulta: si es el principal, no hay consulta; si es secundario (OSV), la ficha va sin ese campo.
- Cada respuesta se valida a mano (campos que faltan o con otro tipo se dejan fuera); una respuesta rara no rompe nada.
- Errores con nombre: `sin-red` (sin conexión o petición bloqueada: el navegador no distingue), `limite` (GitHub 403/429 con `x-ratelimit-remaining: 0`; dice cuándo se puede volver a intentar), `no-encontrado` (404) y `fallo`.

### La ficha en el elemento

- Va en el frontmatter del enlace: `ficha` (la última) y `fichaAnterior` (la de la consulta previa), sin crear versión nueva (no es contenido). Viaja con el ZIP.
- **«Volver a consultar»** guarda la nueva como `ficha` y la que había como `fichaAnterior`; la vista enseña los cambios entre las dos («Estrellas: 1.204 → 1.290»; «Último lanzamiento: v2.9.0 → v2.10.1»).

### Cuándo se consulta

- **Al capturar** un enlace, si el dominio imprescindible de su proveedor está activado (y no hay modo sin red, IN-061): se consulta en segundo plano, con los secundarios que estén activados, y se guarda la ficha. La respuesta de Rimor se recompone con ella. (Cambiado al implementar: con «todos» un paquete sin OSV activado no se enriquecería nunca al capturar.)
- **Desde la vista**, siempre a mano: «Consultar» (la primera vez) o «Volver a consultar».
- **Antes de la primera consulta** la tarjeta dice qué dominios consultaría: «Se puede completar consultando api.github.com.» con «Activar y consultar» (activa esos dominios en los ajustes del espacio y consulta) o, si ya están activados, «Consultar».
- **Sin red** o con la petición bloqueada: `<Senal estado="sin-conexion">` con «Sin red: guardado sin enriquecer.» y «Reintentar».

### Ajustes · Red

La tarjeta «Red» (plegada) lista los diez dominios agrupados por uso (repositorios, paquetes, papers) con su casilla, lo que se activa en `red.dominios`; y el **token de GitHub** opcional, guardado solo en este navegador (`localStorage`, nunca en el espacio ni en el ZIP), con su explicación («sube el límite de 60 a 5.000 consultas por hora»).

### Respuestas enriquecidas

La respuesta del lector Enlace usa la ficha si la hay:

- repositorio: «Repositorio activo: último lanzamiento hace 12 días, licencia MIT.» (activo si hubo push en los últimos 90 días; si no, «sin actividad desde el 3 mar»; archivado, «Repositorio archivado»);
- paquete: «serde 1.0.210, publicado hace 3 días, licencia MIT; sin vulnerabilidades conocidas.» (o «2 vulnerabilidades conocidas»);
- paper: «Paper de 2023 en Nature: «Título».».

### `sin-conexion` en la Señal

El estado del SVG 16: onda discontinua al 55 % y punto hueco que respira (opacidad de 1 a 0,35), 2,4 s en bucle; reposo, onda discontinua y punto hueco. Para que quepa en los 4 KB (que no se tocan) se compacta el CSS de la señal (comentarios largos y reglas repetidas).

## Tareas

- [x] Proveedores con interfaz común `Enriquecedor` (`acepta`, `consultar` → ficha), solo los validados por F0-7: GitHub (token opcional), GitLab; deps.dev, OSV, npm, crates.io y PyPI; Crossref y arXiv (por DataCite).
- [x] Ficha con fecha de consulta; «Volver a consultar» con los cambios respecto a la anterior.
- [x] Dominios visibles antes de la primera consulta y lista de dominios activados en Ajustes.
- [x] Sin red o con el dominio bloqueado, `<Senal estado="sin-conexion">` con «Sin red: guardado sin enriquecer».
- [x] Respuestas enriquecidas.

## Pruebas previstas

- Cada proveedor con un `pedir` falso que devuelve respuestas como las reales: los campos que saca, el token en la cabecera, un dominio secundario sin activar, respuestas incompletas, 404, límite de GitHub y sin red.
- `consultarFicha`: solo dominios activados; sin proveedor, `null`.
- Cambios entre fichas.
- Vista: dominios antes de la primera consulta, «Activar y consultar» (guarda los dominios y la ficha), la ficha con su fecha, «Volver a consultar» con los cambios, sin red con la señal y «Reintentar».
- Ajustes: activar dominios se guarda en `red.dominios`; el token se guarda en este navegador y no en el espacio.
- Captura: con los dominios activados la ficha llega sola; sin activar, ninguna petición.
- Respuestas con ficha (repositorio activo, sin actividad, archivado; paquete con y sin vulnerabilidades; paper) en español e inglés, con las reglas de estilo de las respuestas.
- `Senal` `sin-conexion` y la fidelidad con su SVG; el presupuesto de 4 KB sigue.

## Criterios de aceptación

- `pnpm verificar` en verde. Sin red, el lector funciona como en v0.1; con red, solo consulta dominios activados (probado con un `pedir` que registra cada URL).

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| La CSP es una `<meta>` fija: no puede cambiar con Ajustes | Lleva los diez dominios siempre; qué se consulta lo decide la app con `red.dominios` (la ficha de F0-7 ya lo dejaba así en `csp.mjs`). |
| El token de GitHub es un secreto | Solo en este navegador; nunca en el espacio, en el ZIP ni en la ficha. |
| arXiv no admite CORS | DataCite por su DOI `10.48550/arXiv.{id}` (F0-7). |
| Maven sin CORS | Solo por deps.dev (F0-7). |
| ¿Enriquecer los enlaces antiguos al activar un dominio? | No: muchas peticiones de golpe. Se consulta al capturar y a mano; las fichas de más de 90 días (QF-07) llegan con las preguntas de seguimiento. |
| El presupuesto de 4 KB de la señal está casi lleno | Se compacta su CSS; el límite no cambia. |
| Las respuestas de las APIs cambian de forma | Validación campo a campo; lo que no se entiende se deja fuera. |

## Autorrevisión

Cubre las cinco tareas con solo los proveedores de F0-7. Reutiliza el lector Enlace, los ajustes del espacio (`guardarAjustes`), la tarjeta «Red», `RespuestaRimor` y la `Senal`. Lo pesado (los proveedores) se carga al consultar, fuera de la carga inicial.

## Implementación

- `src/lectores/enlace/enriquecer/`: `contrato.ts` (`Enriquecedor`, `Ficha`, `FalloConsulta` y `pedirJson`, que solo pide a dominios activados y da nombre a los fallos), `forjas.ts` (GitHub y GitLab), `paquetes.ts` (deps.dev, OSV y la fecha del registro si falta), `papers.ts` (Crossref y DataCite para arXiv), `enriquecer.ts` (proveedor, dominios, consulta y cambios entre fichas), `ficha.ts` (la ficha y la anterior en el frontmatter), `frase.ts` (la respuesta con la ficha), `dominios.ts` (los grupos de Ajustes y el token de este navegador) y `aplicar.ts` (consultar y guardar; activar dominios).
- `src/lectores/enlace/FichaEnlace.tsx`, en la vista del enlace.
- `src/espacio/ajustes.ts`: `red: { sinRed, dominios }` normalizado (lo desconocido se conserva) y `dominiosActivos`.
- Ajustes · Red: los dominios por grupos y el token de GitHub.
- `Captura.tsx`: un enlace nuevo se enriquece en segundo plano si su proveedor tiene sus dominios activados (sin ninguno activado no se carga ni el módulo).
- `Senal`: el estado `sin-conexion` (SVG 16). Para que quepa en los 4 KB, la duración de cada animación pasa a una variable que pone `Senal.tsx` (estaba repetida en el CSS y en `estadosSenal.ts`) y los comentarios se acortan.
- `useElemento`: el elemento recordado se reconoce por su frontmatter entero (`modificado` va al segundo y la ficha llega en el mismo segundo que la captura).
- Pruebas: `enriquecer/enriquecer.test.ts` (cada proveedor con un `fetch` falso, dominios y CSP, fallos con nombre, cambios, frases y sus reglas de estilo), `FichaEnlace.test.tsx` (activar y consultar, volver a consultar con cambios, sin red, sin proveedor, Ajustes y la consulta al capturar), `copias.test.ts` (ajustes de red) y las de la señal (fidelidad de `sin-conexion` con su SVG).

### Decisiones tomadas al implementar

| Decisión | Por qué |
|---|---|
| Sin BibTeX en la ficha | No lo pide la ficha de IN-041; `doi.org` queda en la CSP para la bibliografía (IN-086, BibTeX desde enlaces a papers y DOI). |
| deps.dev es el dominio imprescindible de un paquete; OSV y el registro, secundarios | deps.dev da versión, fecha y licencias de los cinco ecosistemas (F0-7); sin OSV, sus avisos cuentan como vulnerabilidades. |
| Las fechas de la ficha se enseñan como día («20 oct»); la consulta, con hora | Lo que importa de una actividad es el día; de la consulta, cuándo exactamente. |

## Verificación

**`pnpm verificar`**: en verde, 105 archivos y 1370 pruebas; carga inicial 249,1 KB de 300 (los proveedores se cargan con la vista del enlace o al capturar con algún dominio activado).

**Criterios de aceptación:** sin red, el lector funciona como en v0.1 (sin dominios activados no se pide nada ni se carga el módulo: `FichaEnlace.test.tsx`); con red, solo se consultan dominios activados (`pedirJson` rechaza los demás y no lee lo que llega redirigido a ellos; `enriquecer.test.ts` registra cada URL).

**Tareas, con su evidencia:**

| Tarea | Evidencia |
|---|---|
| Proveedores con interfaz común, solo los de F0-7 | `enriquecer.test.ts` (GitHub, GitLab, deps.dev con OSV y el registro, Crossref y DataCite; dominios en la CSP) |
| Ficha con fecha; «Volver a consultar» con los cambios | `FichaEnlace.test.tsx`, `enriquecer.test.ts` (cambios) |
| Dominios visibles antes de la primera consulta; lista en Ajustes | `FichaEnlace.test.tsx` (tarjeta y Ajustes · Red) |
| Sin red, `sin-conexion` con «Sin red: guardado sin enriquecer» | `FichaEnlace.test.tsx`; fidelidad de la señal con su SVG |
| Respuestas enriquecidas | `enriquecer.test.ts` (frases y sus reglas de estilo), `FichaEnlace.test.tsx` (la respuesta del feed tras capturar) |

**Revisión independiente** (subagente con contexto limpio). Hallazgos y lo hecho:

| # | Hallazgo | Corrección y prueba |
|---|---|---|
| 1 | «Volver a consultar» volvía a activar dominios apagados sin decirlo | Solo «Activar y consultar» activa, y con su texto de qué se consultaría. `FichaEnlace.test.tsx` |
| 2 | El foco se perdía al consultar | Un solo botón que se queda deshabilitado mientras consulta |
| 3 | Sin plazo, una petición colgada bloqueaba la tarjeta | 15 s (`PLAZO_CONSULTA_MS`), que cuentan como sin red. `enriquecer.test.ts` |
| 4 | Los fallos de la consulta al capturar no se veían | El último fallo de cada elemento en la pestaña; la vista empieza por él. `FichaEnlace.test.tsx` |
| 5 | Token caducado, con caracteres inválidos o límite con token, con textos engañosos | 401 es `token` con su texto; el token se valida al guardarlo; límite con token, otro texto. `enriquecer.test.ts`, `FichaEnlace.test.tsx` |
| 6 | pkg.go.dev con versión, un paquete de un módulo o `std` daban «no lo encuentra» | Sin versión, recortando hasta el módulo, y `std` sin ficha. `enriquecer.test.ts` |
| 7 | Los DOI de DataCite iban a Crossref | Los de arXiv, por DataCite; si Crossref no lo conoce y DataCite está activado, DataCite. `enriquecer.test.ts` |
| 8 | Importar como espacio nuevo traía los dominios del otro activados | Se apagan al importar. `importar.test.ts` |
| 9 | El token, al alcance de otras páginas del mismo dominio | El texto lo dice y recomienda un token fino sin permisos (riesgo registrado) |
| 10 | «Issues abiertas» incluía los PR | «Issues y PR abiertos» |
| 11 | Un fallo del último lanzamiento tiraba la ficha del repositorio | Se tolera. `enriquecer.test.ts` |
| 12 | Una respuesta rara de OSV contaba como «sin vulnerabilidades» | No cuenta; con más páginas, tampoco (cuentan los avisos de deps.dev). `enriquecer.test.ts` |
| 13 | Las redirecciones no pasaban por la comprobación de dominios | Lo que llega de un dominio no activado no se lee (la CSP limita la petición a los diez de F0-7). `enriquecer.test.ts` |
| 14 | Los textos nombraban dominios que no se iban a consultar | Solo los activados, o todos si se van a activar; el diseño, alineado con lo hecho |
| 15 | Los avisos podían no anunciarse | Región viva fija junto al botón. `FichaEnlace.test.tsx` |
