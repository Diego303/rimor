# IN-009 · Saneado y política de seguridad de contenido

## Objetivo y catálogo

Que nada pegado se ejecute nunca. Catálogo: **SEG-01** (saneado) y **SEG-02** (CSP; red solo para enriquecer, con dominios visibles). Depende de IN-001.

## Estado de partida

- La isla React se monta en `/` con `client:only`; Astro añade su propio script en línea para hidratarla.
- `Base.astro` ya tiene un script en línea (tema antes de pintar, IN-002).
- GitHub Pages no permite cabeceras propias: la CSP solo puede ir en `<meta>` (ADR-0002).
- F0-7: lista de dominios de enriquecimiento que admiten CORS.

## Diseño

### Saneado (`src/seguridad/sanear.ts`)

Tubería unified: `remark-parse` → `remark-gfm` → `remark-rehype` (con HTML) → `rehype-raw` → **`rehype-sanitize`** con un esquema propio → árbol hast → React con `hast-util-to-jsx-runtime` (nunca `dangerouslySetInnerHTML`).

Esquema propio, partiendo del de GitHub (`defaultSchema`):

- sin `script`, `style`, `iframe`, `object`, `embed`, `form`, `input` (salvo casillas de tareas, deshabilitadas), `base`, `meta`, `link`;
- sin atributos `on*` ni `style`;
- `href` y `src` solo con `http`, `https`, `mailto` y anclas internas (`#…`); nada de `javascript:`, `data:` ni `vbscript:`;
- imágenes externas **no se cargan** al pintar (se sustituyen por un enlace con su texto alternativo): cargar una imagen remota avisa a un servidor de que has abierto el elemento (P6);
- enlaces externos con `rel="noopener noreferrer nofollow"` y `target="_blank"`;
- los `id` generados llevan prefijo (`clobberPrefix`) para que el contenido no pise elementos de la app.

```ts
function markdownAHast(md: string): Root;              // ya saneado
function sanearHtml(html: string): Root;               // HTML suelto pegado
function sanearSvg(svg: string): string;               // SVG (diagramas, IN-066): sin script, foreignObject, on*, href externos
```

`MarkdownSeguro` (`src/ui/componentes/MarkdownSeguro.tsx`) es la **única** forma de pintar Markdown pegado. Va en un módulo de carga diferida para no sumar unified a la carga inicial.

### CSP (`scripts/csp.mjs` tras `astro build`)

Una `<meta http-equiv="Content-Security-Policy">` que se inserta al principio de `<head>` de cada HTML construido, con los **hashes SHA-256 de cada script en línea** (el del tema y los de Astro), calculados sobre el resultado final:

```
default-src 'self';
script-src 'self' 'sha256-…' …;
style-src 'self' 'unsafe-inline';
img-src 'self' blob: data:;
font-src 'self';
connect-src 'self' https://api.github.com https://gitlab.com https://api.deps.dev https://registry.npmjs.org
            https://crates.io https://pypi.org https://api.osv.dev https://api.crossref.org https://doi.org https://api.datacite.org;
worker-src 'self' blob:;
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'none'
```

Decisiones (ADR-0005):

- **Solo en la construcción.** En desarrollo, Vite inyecta scripts en línea para la recarga en caliente; la CSP se añade al final de `pnpm build`.
- **`style-src 'unsafe-inline'`:** CodeMirror, KaTeX y Mermaid (v0.3) crean `<style>` en tiempo de ejecución y una web estática no puede dar *nonces*. Los estilos no ejecutan código; el riesgo que queda (filtrar datos con selectores CSS) se cierra porque el contenido pegado nunca lleva `style` (saneado) ni se pinta como HTML crudo.
- **`connect-src` fijo:** una `<meta>` no cambia después de cargar la página, así que lleva todos los dominios de enriquecimiento de F0-7. Qué dominios se consultan de verdad lo decide la capa de red de la app según lo que el usuario active en Ajustes y el modo sin red (IN-041, IN-061).
- **Sin `unsafe-eval`.** Los módulos WASM (DuckDB, Pandoc, Typst, Tesseract) necesitarán `'wasm-unsafe-eval'`, que solo permite compilar WebAssembly; se añadirá con el primero (IN-044) en este mismo ADR.

### Comprobación

`scripts/comprobar-dist.mjs` comprueba además que el HTML construido lleva la CSP antes de cualquier script y que cada script en línea tiene su hash en `script-src`.

## Tareas

- [ ] `sanear.ts` con `rehype-sanitize` y el esquema propio; SVG por la misma vía.
- [ ] `MarkdownSeguro` (unified → rehype → React) como única forma de pintar Markdown pegado.
- [ ] CSP en `<meta>` con los hashes de los scripts en línea; ADR de la política y sus excepciones.

## Pruebas previstas

- Corpus de 25 cargas XSS (de la *XSS Filter Evasion Cheat Sheet* de OWASP): pintadas con `MarkdownSeguro` en happy-dom, el DOM resultante no tiene `script`, `iframe`, `object`, `embed`, atributos `on*`, `style`, ni `href`/`src` con `javascript:`, `data:` o `vbscript:`; ninguna imagen remota se carga.
- `<img src=x onerror=alert(1)>` pegado en Markdown: queda sin `onerror` (la prueba de extremo a extremo que pega en el compositor queda para Playwright).
- `sanearSvg`: quita `script`, `foreignObject`, `on*` y `href` externos; conserva formas y texto.
- Markdown normal (títulos, listas, tareas, tablas, código, enlaces) sale bien.
- `csp.mjs`: sobre un HTML de ejemplo inserta la `<meta>` antes del primer script y sus hashes coinciden con los de los scripts en línea.

## Criterios de aceptación

- Ninguna carga del corpus ejecuta código ni hace peticiones (DOM saneado; sin imágenes remotas).
- La construcción lleva una CSP estricta para scripts; `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Hashes de scripts que cambian en cada construcción | Se calculan sobre el HTML final, después de `astro build` |
| `style-src 'unsafe-inline'` | Necesario para CodeMirror, KaTeX y Mermaid; justificado en ADR-0005 |
| Peso de unified en la carga inicial | `MarkdownSeguro` en carga diferida |

## Autorrevisión

Cubre las tres tareas. La CSP en `<meta>` es la única posible en GitHub Pages y se documenta su límite (`connect-src` fijo).

## Cambios durante la implementación

- La CSP se inserta en el propio `pnpm build` (`astro build && node scripts/csp.mjs`), así la construcción de GitHub Pages ya la lleva; `comprobar-dist` verifica que va antes de cualquier script, que autoriza cada script en línea por su hash y que no permite `unsafe-inline` ni `unsafe-eval` en scripts.
- `MarkdownSeguro` se exporta por defecto para cargarlo con `React.lazy` desde las vistas que lo usen (IN-017, IN-024), fuera de la carga inicial.
- El corpus XSS (`src/seguridad/xss.ts`) tiene 27 cargas.
