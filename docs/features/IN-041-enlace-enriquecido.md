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

- **Al capturar** un enlace, si todos los dominios de su proveedor están activados (y no hay modo sin red, IN-061): se consulta en segundo plano y se guarda la ficha. La respuesta de Rimor se recompone con ella.
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

- [ ] Proveedores con interfaz común `Enriquecedor` (`acepta`, `consultar` → ficha), solo los validados por F0-7: GitHub (token opcional), GitLab; deps.dev, OSV, npm, crates.io y PyPI; Crossref y arXiv (por DataCite).
- [ ] Ficha con fecha de consulta; «Volver a consultar» con los cambios respecto a la anterior.
- [ ] Dominios visibles antes de la primera consulta y lista de dominios activados en Ajustes.
- [ ] Sin red o con el dominio bloqueado, `<Senal estado="sin-conexion">` con «Sin red: guardado sin enriquecer».
- [ ] Respuestas enriquecidas.

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
