# IN-019 · Lector Enlace básico

## Objetivo y catálogo

Guardar URL y DOI limpios, saber a qué apuntan y recordar si ya se guardaron, sin red. Catálogo: **LEC-03** (el enriquecido, LEC-03b, es IN-041). Depende de IN-017.

## Estado de partida

- El detector manda a `enlace` un texto que es entero una URL o un DOI si el lector existe (atajo de IN-013, puesto 3 del Anexo D).
- `construirContexto` busca otros elementos con la misma `huella` del resumen (IN-016).
- D7: sin red en v0.1.

## Diseño

### `src/lectores/enlace/`

- `normalizar(texto)`: acepta `http(s)://…`, `doi:10.…`, `10.…/…` y `https://(dx.)doi.org/…`. Con `URL`: host en minúsculas, sin puerto por defecto ni usuario; DOI a `https://doi.org/10.…`; quita los parámetros de seguimiento (`utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `mc_cid`, `mc_eid`, `igshid`, `yclid`, `ref`, `ref_src`) y ordena el resto; quita el fragmento vacío y los de texto (`#:~:text=…`); sin barra final salvo en la raíz.
- `clasificar(url)` → `{ clase, sitio, nombre?, numero? }` con `clase` entre `repositorio`, `issue`, `pr`, `paquete`, `paper`, `documentacion`, `pregunta`, `video` y `otro`:
  - repositorio: GitHub, GitLab, Codeberg, Bitbucket (`dueño/repo`);
  - issue y PR: `/issues/N`, `/pull/N`, `/-/issues/N`, `/-/merge_requests/N`;
  - paquete: npm, crates.io, PyPI, pkg.go.dev, Maven Central, RubyGems, Packagist, NuGet, Hex;
  - paper: arXiv (`abs`/`pdf`), DOI, ACL Anthology, OpenReview, ACM DL, Semantic Scholar, bioRxiv;
  - documentación: `docs.*`, docs.rs, Read the Docs, MDN, Microsoft Learn, `devdocs.io` o rutas `/docs/`;
  - pregunta: Stack Overflow y los sitios de Stack Exchange (`/questions/N`);
  - vídeo: YouTube (`watch`, `youtu.be`, `shorts`), Vimeo, Twitch.
- **Título provisional** desde la URL, legible: «ureq en docs.rs», «rust-lang/rust», «rust-lang/rust #12345», «serde en crates.io», «arXiv 2310.06825», «DOI 10.1145/3368089», la pregunta con las palabras de su ruta, o «dominio · ruta legible».
- `leer`: título provisional, el original tal cual, `metadatos: { url }` (la normalizada) y resumen con `{ url, clase, sitio, huella: url }`: la **huella es la URL normalizada**, así el contexto encuentra lo ya guardado.
- `derivar`: lo mismo calculado sobre el original (sin red).
- `respuesta` (es y en), una frase por clase («Documentación de ureq en docs.rs.», «Repositorio rust-lang/rust en GitHub.», «Issue #123 de dueño/repo en GitHub.», «Paquete serde en crates.io.», «Paper de arXiv 2310.06825.», «Pregunta de Stack Overflow.», «Vídeo de YouTube.», «Enlace a ejemplo.org.») y, si ya existía la misma URL normalizada, «Ya lo guardaste el 2 oct.» (con la fecha del más antiguo).
- `textoIndexable`: la URL normalizada y las palabras de su ruta.
- `Vista.tsx`: la URL normalizada como enlace (otra pestaña, `noopener noreferrer`), clase y sitio en `kv`, y lo pegado si era distinto («Pegado: …»). `Tarjeta.tsx`: sitio · clase.

### Corpus

- `fixtures/deteccion/enlace/`: 25 URL y DOI (para la matriz).
- `fixtures/enlaces/clasificacion.json`: **73 URL reales** con su clase esperada, con las formas corrientes de cada destino (subgrupos de GitLab, `/q/` de Stack Overflow, `m.youtube.com`, arXiv antiguo, ACM `/doi/abs/`…), que la prueba recorre.

## Tareas

- [x] Normaliza: quita `utm_*`, `fbclid`, `gclid` y `ref` de seguimiento, y ordena los parámetros.
- [x] Clasifica por destino: repositorio, paquete, paper (arXiv, DOI), documentación, issue o PR, Stack Overflow, vídeo u otro.
- [x] Título provisional desde la URL (dominio y ruta legibles).
- [x] Sin red en v0.1 (D7).
- [x] Respuesta: «Documentación de ureq en docs.rs.» y, si ya existía, «Ya lo guardaste el 2 oct.»

## Pruebas previstas

- `normalizar`: parámetros de seguimiento, orden, mayúsculas del host, puertos, DOI en sus formas, fragmentos, barra final; idempotente.
- `clasificar` con las 60 URL del corpus (todas bien) y casos límite (un `github.com` sin repo es otro; un repo con `/tree/main` sigue siendo repositorio).
- Título provisional por clase.
- Respuesta por clase en es y en, y con un elemento previo de la misma URL (también si se pegó con `utm_*` distintos).
- Matriz de detección con la carpeta `enlace`.
- Vista con el enlace seguro.

## Criterios de aceptación

- Las 60 URL reales del corpus se clasifican bien (prueba).
- Ninguna llamada de red (no hay `fetch` en el lector; la CSP tampoco la permitiría).
- `pnpm verificar` y `pnpm deteccion` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Quitar `ref` puede romper alguna URL donde no es seguimiento | Solo `ref` y `ref_src`, como pide la ficha; el original queda guardado tal cual |
| La misma URL pegada dos veces con distinto seguimiento no es un duplicado exacto | Se guarda (el original es distinto) y la respuesta lo recuerda: «Ya lo guardaste el …» |
| Rutas de documentación ambiguas | Solo hosts y rutas claros; lo demás es «otro» |

## Autorrevisión

Cubre las cinco tareas y la aceptación. Reusa la huella del contexto (IN-016) para «ya lo guardaste», sin estructuras nuevas. El enriquecido (IN-041) partirá de la clase y el nombre que se calculan aquí.

## Cambios durante la implementación

- `normalizar` quita también un `#` final sin nada detrás (la API `URL` lo conserva en el texto aunque su `hash` esté vacío).
- El número de una issue o un PR va tal cual («#57465»), no como cantidad con separador de miles.
- `detectar` puntúa 0,95 con un texto que es entero una URL o un DOI (además del atajo del detector) y 0 con archivos.
- Lo forzado con `/enlace` que no es una URL se guarda como «otro», sin dirección.

## Verificación

**`pnpm verificar`** (2026-10-18 20:07): tipos 0 errores; Biome, colores y textos, OK; Vitest 49 archivos y 608 pruebas, OK; construcción OK; carga inicial 181,7 KB. **`pnpm deteccion`**: 100 % de 100 ejemplos (archivo, enlace, idea y texto).

| Criterio | Evidencia |
|---|---|
| Normaliza sin seguimiento y con los parámetros ordenados | Pruebas de `normalizar` (también DOI, `?flag`, barras, fragmentos e idempotencia sobre todo el corpus) |
| Clasifica por destino | Las 73 URL del corpus, todas bien, más los nombres de las formas corrientes |
| Título provisional legible | Pruebas por clase (y dominios IDN en Unicode) |
| Sin red | Ninguna llamada de red en el lector; la CSP tampoco las permitiría |
| Respuesta y «Ya lo guardaste el …» | Pruebas por clase en es y en, y de punta a punta con la misma URL pegada con otro seguimiento |

### Revisión independiente

Hallazgos corregidos, con prueba:

1. **Una URL con un `%` suelto o en Latin-1 hacía perder la captura** (`decodeURIComponent` lanzaba): se decodifica sin lanzar y, además, la captura sobrevive a un lector que falla al leer (se guarda con lo mínimo).
2. **Los DOI no se limpiaban**: pasan por la misma normalización que cualquier URL.
3. **`docs.google.com` salía como documentación**: es «otro» (Google Docs).
4. **Forjas**: los subgrupos de GitLab dan el repositorio entero (y sus issues y merge requests); las páginas propias de GitHub (`settings`, `marketplace`, `topics`…) no son repositorios.
5. **Stack Overflow**: también `/q/ID`, `/a/ID` y los sitios por idioma.
6. **YouTube y Twitch**: `m.youtube.com`, `live`, `embed` y los canales de Twitch.
7. **arXiv y ACM**: identificadores antiguos con categoría, `/html/` y `/doi/abs|pdf|full/`.
8. **El corpus estaba hecho a medida**: ahora tiene 73 URL reales con esas variantes corrientes, y la carpeta de detección sale de él.
9. **«Ya lo guardaste el …» podía citar una vez posterior**: solo cuentan las anteriores al propio elemento.
10. Más seguimiento: `si`, `srsltid`, `share_id`, `gbraid`, `wbraid` y los de boletines.
11. **La normalización alteraba `?flag` y no era idempotente con `//`**: la consulta se rehace sin tocarla y las barras finales se quitan todas; el resaltado de texto dentro de un fragmento se quita.
12. Forzado con `/enlace` sin URL: «Enlace guardado.»
13. **Dominios IDN** se enseñan en Unicode.
14. `docs.rs/crate/…`, la raíz de docs.rs y las páginas de pkg.go.dev (`search`…) dan nombres correctos o ninguno.

