# IN-001 · Repositorio, herramientas e integración continua

## Objetivo y catálogo

Un esqueleto que compila, prueba y despliega, para que el resto de IN solo añadan código de producto. Sin IDs de catálogo. Depende de D5 (licencia, sin decidir) y D15 (pnpm con workspaces).

## Estado de partida

- Web base de Astro 5.17 (plantilla «basics»): `src/pages/index.astro`, `src/layouts/Layout.astro`, `src/components/Welcome.astro`, `src/assets/*.svg`, `public/favicon.*`.
- `pnpm-workspace.yaml` creado en el arranque (`paquetes/*`, `allowBuilds` sin scripts de esbuild ni sharp: en `/mnt/d` el renombrado de directorios de pnpm falla con los paquetes que tienen script de instalación, y ninguno de los dos lo necesita).
- ADR-0001 y ADR-0002 fijan la estructura y cómo vive la app en Astro.
- Fase 0 cerrada: sus decisiones entran en las fichas que afectan (F0-2 → IN-035/036, F0-5 → IN-044, …).

## Diseño

### Versiones

El ecosistema ya va por Astro 7, Vitest 5 y TypeScript 7 (nativo). Se mantiene la base del repositorio (**Astro 5.17, Vite 6**) y se eligen las versiones que la acompañan sin fricciones:

| Herramienta | Versión | Por qué |
|---|---|---|
| React / React DOM | 19 | Plan §14.1 |
| `@astrojs/react` | 4.4 | La que admite Astro 5 |
| TypeScript | 5.9 | `astro check` usa la API de TypeScript 5; la 7 aún no la ofrece |
| `@astrojs/check` | 0.9 | `astro check` |
| Vitest | 3.2 | Admite Vite 6 y `getViteConfig` de Astro 5 |
| fast-check | 4 | Propiedades |
| happy-dom + Testing Library | 21 / 16 | Pruebas de componentes mientras no hay Playwright |
| Biome | 2 | Plan §14.1 |
| Tailwind | 4 con `@tailwindcss/vite` | ADR-0002 |

Subir a Astro 7 queda como mejora futura con su propio ADR.

### Archivos

```
package.json            ← "rimor", scripts de §10 del prompt maestro, dependencias
pnpm-workspace.yaml     ← paquetes/* (y cli/ en v0.3)
tsconfig.base.json      ← opciones estrictas comunes (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
tsconfig.json           ← la app (extiende astro/tsconfigs/strict y la base; jsx react-jsx)
astro.config.mjs        ← output static, react(), tailwind en vite.plugins, site/base desde el entorno
vitest.config.ts        ← proyectos: app (getViteConfig) y cada paquete
biome.json              ← reglas recomendadas + noExplicitAny, useImportType, formato del repositorio
scripts/comprobar-colores.mjs  ← rechaza colores literales fuera de src/ui/tema/tokens.css
scripts/tamano-carga.mjs       ← suma la carga inicial comprimida y falla por encima de 300 KB
src/pages/index.astro   ← monta <App client:only="react" />
src/layouts/Base.astro  ← HTML base (idioma, viewport, título); IN-009 añade la CSP e IN-089 los iconos
src/app/App.tsx         ← raíz de la isla: de momento, la carcasa mínima con el raíl vacío (IN-008 la completa)
src/app/App.test.tsx    ← prueba de humo
paquetes/formato/, paquetes/estadistica/  ← package.json, tsconfig, src/index.ts y una prueba cada uno
.github/workflows/ci.yml     ← pnpm verificar en cada push y PR
.github/workflows/pages.yml  ← construye con BASE=/<repo>/ y despliega en GitHub Pages desde main
README.md, CONTRIBUTING.md, docs/arquitectura.md
```

Se borran `src/components/Welcome.astro`, `src/assets/` y `src/layouts/Layout.astro` de la plantilla.

### Scripts

| Script | Hace |
|---|---|
| `dev` | `astro dev` |
| `build` / `preview` | `astro build` / `astro preview` |
| `typecheck` | `astro check` (app) y `tsc --noEmit` en cada paquete |
| `lint` | `biome check .` + `scripts/comprobar-colores.mjs` (IN-003 añade la regla de textos) |
| `test` | `vitest run` (todos los proyectos) |
| `tamano` | `scripts/tamano-carga.mjs` sobre `dist/` |
| `verificar` | `typecheck` + `lint` + `test` + `build` + `tamano` |

`test:e2e` (Playwright) no se crea todavía: el autor ha pedido no usar Playwright hasta el final. `deteccion` llega con IN-013 y `marca` con IN-089.

### Comprobación de colores

`comprobar-colores.mjs` recorre `src/**/*.{ts,tsx,css,astro}` y falla si encuentra, fuera de `src/ui/tema/tokens.css`:

- hexadecimales de color (`#abc`, `#abcd`, `#aabbcc`, `#aabbccdd`);
- `rgb(`, `rgba(`, `hsl(`, `hsla(` con números;
- clases de paleta de Tailwind (`bg-orange-500`, `text-red-600`…).

Una línea puede eximirse con el comentario `rimor-permitir-color` (por ejemplo, el `<meta name="theme-color">` de IN-089, que no admite variables CSS). La aceptación pide que un hexadecimal en un componente falle: hay una prueba del propio script con un archivo de ejemplo.

### Tamaño de la carga inicial

`tamano-carga.mjs` lee `dist/index.html`, toma los módulos que carga al abrir (`<script src>`, `modulepreload`, y los `component-url` y `renderer-url` de la isla), sigue sus `import` estáticos (no los dinámicos, que son carga diferida) y suma su tamaño con gzip. Por encima de 300 KB **falla**: el plan lo pide como aviso, pero es un requisito del «terminado» común, así que se trata como error.

### Despliegue

- **GitHub Pages** (instrucción del autor): `pages.yml` se lanza en `main`, construye con `SITIO=https://<usuario>.github.io` y `BASE=/<repositorio>/` (de `github.repository`) y publica con `actions/deploy-pages`.
- GitHub Pages no admite vistas previas por rama: la CI de cada rama sube `dist/` como artefacto descargable.

## Tareas

- [ ] Monorepo pnpm con `paquetes/formato` y `paquetes/estadistica` (esqueletos).
- [ ] React 19, TypeScript estricto y la isla en `/`.
- [ ] Biome y la comprobación de colores.
- [ ] Vitest (unidades y fast-check) con proyectos por paquete.
- [ ] Integración continua y despliegue en GitHub Pages.
- [ ] README, CONTRIBUTING (método SDD adaptado) y `docs/arquitectura.md`.
- [ ] Licencia: **no** (D5, pendiente del autor).

## Pruebas previstas

- Humo: `App` se monta (happy-dom) y muestra el raíl de navegación.
- Paquetes: una prueba trivial en cada uno para que Vitest los recorra.
- `comprobar-colores`: un componente de ejemplo con `#EE4F1F` falla; `tokens.css` y una línea con `rimor-permitir-color` pasan.

## Criterios de aceptación

- `pnpm verificar` pasa en limpio.
- Un hexadecimal en un componente hace fallar `pnpm lint`.
- «Terminado» común: lo aplicable a un esqueleto (tipos estrictos, pruebas, carga inicial < 300 KB). Las pruebas en tres navegadores quedan aplazadas (seguimiento).

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `pnpm install` falla en `/mnt/d` con paquetes que ejecutan scripts | `allowBuilds: false` para esbuild y sharp (usan binarios opcionales ya precompilados) |
| Licencia sin decidir | No se añade; queda en «Pendientes de validación humana» |
| Vistas previas por rama | No existen en GitHub Pages; artefacto de CI |
| Astro 5 frente a 7 | Se queda en 5 (ver Versiones) |

## Autorrevisión

- Cubre todas las tareas de la ficha salvo la licencia (D5) y la vista previa por rama, ambas justificadas.
- No contradice ADR-0001 ni ADR-0002.
- Lo más simple: sin herramientas extra (ni Turborepo ni Storybook).

## Cambios durante la implementación

- **Proyectos de Vitest en el archivo raíz.** Los proyectos anidados en un archivo aparte no se respetaban (la app corría en Node y los paquetes, dos veces). `vitest.config.ts` usa `getViteConfig` y declara en línea `app` (Node), `app-dom` (happy-dom) y los paquetes.
- **`enableGlobalVirtualStore: true`** en `pnpm-workspace.yaml`: `node_modules` solo enlaza el almacén global de pnpm. En esta máquina, además, el almacén está en el disco Linux (`pnpm config set store-dir … --location global`, ajuste local, no del repositorio): `tsc` pasa de 80 s a 5 s y `pnpm verificar` completo tarda unos 30 s.
- Se borran también `public/favicon.*` de la plantilla (logotipo de Astro); IN-089 trae los de Rimor.
- `site` solo se pasa a Astro si `SITIO` existe (`exactOptionalPropertyTypes`).
