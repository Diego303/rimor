# IN-089 · Símbolo «Señal», iconos de app y favicon

## Objetivo y catálogo

Que la marca entre en la app una sola vez, limpia, en los dos temas y en todos los tamaños. Catálogo: marca (`rimor-diseno.md` §6.2). Depende de IN-001.

## Estado de partida

- Los paquetes `rimor-icono` y `rimor-animaciones` ya están copiados tal cual en `docs/marca/originales/` (arranque), con sus LEEME.
- Cada SVG de `rimor-icono` pesa unos 8 KB, casi todo un bloque `<metadata>` de procedencia (C2PA); el dibujo ocupa menos de 0,8 KB (hallazgo M3). El `favicon.svg` ya viene limpio, con `<style>` y `prefers-color-scheme` (M2).
- IN-002: tokens `--ink`, `--key`; página de muestras; el avatar `.rimor .av` está vacío a la espera de este símbolo.
- Aún no existen el raíl (IN-008) ni `RespuestaRimor` (IN-016): usarán `Logotipo` y `SimboloRimor` cuando lleguen.

## Diseño

### Archivos

```
scripts/marca.mjs                 ← `pnpm marca`: optimiza con SVGO, publica y genera el logotipo en contornos
docs/marca/svg/*.svg              ← SVG optimizados (sin metadatos, < 1 KB), para usos fuera de la app
docs/marca/rimor-logotipo-contornos-{claro,oscuro}.svg ← texto en contornos (opentype.js + Archivo 700)
public/marca/favicon.svg          ← el del paquete, pasado por SVGO
public/marca/rimor-app-claro-{32,180,192,512}.png, rimor-maskable-claro-{192,512}.png
public/marca/manifest-iconos.json ← bloque `icons` con las rutas publicadas (lo usará IN-050)
src/ui/marca/geometria.ts         ← onda, punto y guion: la única fuente del dibujo
src/ui/marca/SimboloRimor.tsx     ← símbolo en línea que sigue al tema
src/ui/marca/Logotipo.tsx         ← símbolo + «Rimor» en Archivo 700, texto vivo
src/ui/marca/marca.css            ← clases de los dos componentes
src/layouts/Base.astro            ← favicon, PNG de 32, apple-touch-icon y theme-color por tema
```

### Geometría

```ts
export const VIEWBOX = '0 0 48 48';
export const ONDA = 'M7 24 C10.5 12.5 13.5 12.5 17 24 S23.5 35.5 27 24';
export const PUNTO = { cx: 33, cy: 15.5, r: 3.1 } as const;
export const GUION = 'M40 24 H41';
export const TRAZO = 3;            // 3,6 por debajo de 20 px
export const TRAZO_PEQUENO = 3.6;
export const UMBRAL_PEQUENO = 20;
```

### Componentes

- `SimboloRimor({ variante = 'color', tamano = 24, titulo? })`: SVG en línea con `stroke: var(--ink)` en onda y guion y `fill: var(--key)` en el punto (`var(--ink)` en mono). Con `titulo`, `role="img"` y `<title>`; sin él, `aria-hidden`. Trazo de 3,6 por debajo de 20 px.
- `Logotipo({ tamano = 18 })`: el símbolo y el nombre, como el `.rail .rbrand` de las pantallas (separación de 8 px, Archivo 700, `letter-spacing: -.02em`). El nombre es la constante `NOMBRE_APP` («Rimor»): no se traduce.

### Script `pnpm marca`

1. **SVGO** con `preset-default` sin quitar `viewBox`, `<title>` ni `<style>` ni las clases (`removeViewBox`, `removeTitle`, `inlineStyles`, `minifyStyles` y `cleanupIds` desactivados), más `removeMetadata` y `removeXMLNS` no, y un complemento propio que quita el espacio de nombres `xmlns:c2pa`. Cada salida debe pesar menos de 1 KB, o el script falla.
2. **Publica** en `public/marca/` solo lo que se usa: `favicon.svg`, los PNG de app claro de 32, 180, 192 y 512 y los maskable claros de 192 y 512 (los PNG se copian tal cual).
3. **Escribe** `public/marca/manifest-iconos.json` con las rutas relativas a `marca/`.
4. **Genera** el logotipo en contornos para claro y oscuro con opentype.js y `@fontsource/archivo` 700 (WOFF, que opentype.js sí lee), con la misma composición que `rimor-logotipo-*.svg` (`x=52`, `y=31,5`, 21 px, `letter-spacing: −0,4`).

Las salidas se guardan en el repositorio: la construcción no depende de ejecutar `pnpm marca`.

### HTML

```html
<link rel="icon" href="{BASE}marca/favicon.svg" type="image/svg+xml">
<link rel="icon" href="{BASE}marca/rimor-app-claro-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="{BASE}marca/rimor-app-claro-180.png">
<meta name="theme-color" content="#E8E6E1" media="(prefers-color-scheme: light)">  <!-- rimor-permitir-color -->
<meta name="theme-color" content="#1A1A19" media="(prefers-color-scheme: dark)">
```

`theme-color` no admite variables CSS: son los dos únicos colores literales fuera de `tokens.css`, exentos con el comentario de IN-001.

## Tareas

- [x] Copiar los paquetes a `docs/marca/originales/` (hecho en el arranque).
- [ ] `pnpm marca` con SVGO, por debajo de 1 KB por SVG.
- [ ] Publicar en `public/marca/` solo lo que se usa, con el favicon que conserva su `<style>`.
- [ ] `<link rel="icon">`, `apple-touch-icon` y `theme-color` por tema en el HTML base.
- [ ] `geometria.ts`, `SimboloRimor` y `Logotipo` (texto vivo).
- [ ] Logotipo en contornos para fuera de la app.
- [ ] Raíl con `Logotipo` de 18 px y avatar de `RespuestaRimor` con `SimboloRimor` mono de 13 px: **se conectan en IN-008 e IN-016**, que crean esos componentes; aquí se dejan listos y en las muestras.
- [ ] `/muestras`: símbolo a 16, 20, 24, 48 y 96 px, logotipo e iconos de app, en claro y oscuro.

## Pruebas previstas

- Ningún SVG publicado (ni de `docs/marca/svg/`) lleva `<metadata>` ni pasa de 1 KB; todos conservan `viewBox` y `<title>`.
- El `favicon.svg` publicado conserva su `<style>` con `prefers-color-scheme: dark` y las clases `i` y `k` en sus formas (la comprobación con `emulateMedia` queda para cuando haya Playwright).
- Contraste: el punto naranja sobre `--panel` llega a 3:1 (elemento gráfico, WCAG 1.4.11) en los dos temas; `#191919` sobre `#EE4F1F` ya está en la prueba de IN-002.
- `SimboloRimor`: `stroke` y `fill` por token, trazo 3,6 por debajo de 20 px, mono, y `aria-hidden` o `role="img"` según el título (happy-dom).
- La geometría de `geometria.ts` es la del LEEME y la de los SVG originales.
- `index.html` construido enlaza el favicon, el PNG de 32 y el `apple-touch-icon` con la `BASE` correcta y lleva los dos `theme-color`.

## Criterios de aceptación

- La pestaña muestra el favicon correcto en claro y oscuro (por su `<style>`; confirmación visual pendiente de Playwright).
- La PWA (IN-050) usará `manifest-iconos.json`.
- No queda rastro del símbolo antiguo (nada en `src/` ni `public/` lo dibuja).

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| SVGO podría quitar `<style>`, clases o `viewBox` | Complementos desactivados y prueba sobre la salida |
| Raíl y respuesta de Rimor aún no existen | Se conectan en IN-008 e IN-016; aquí, en las muestras |
| opentype.js no lee WOFF2 | Se usa el WOFF de fontsource |
| `theme-color` con hexadecimales | Exención explícita con `rimor-permitir-color` |

## Autorrevisión

Cubre la ficha; dos tareas dependen de componentes de IN posteriores y se anotan en ellas. Sin contradicciones con ADR-0004.

## Cambios durante la implementación

- **opentype.js 2 no admite una sustitución (`ccmp`, tipo 6, formato 2) de Archivo** y falla con `getPath`. El logotipo en contornos se compone glifo a glifo (avance, kerning y el espaciado de −0,4), sin pasar por las sustituciones; para «Rimor» el resultado es el mismo.
- SVGO pasa los trazados a coordenadas relativas (`M7 24c3.5-11.5…`): mismo dibujo, menos bytes. El favicon no lleva `<title>` (no lo traía el original).
- `scripts/comprobar-dist.mjs` (`pnpm comprobar:dist`, dentro de `verificar`): comprueba que el HTML construido enlaza el favicon, el PNG de 32 y el `apple-touch-icon` con la `BASE` del entorno, que existen en `dist/` y que están los dos `theme-color`.
- Biome no revisa `public/marca/` ni `docs/marca/` (salidas generadas); las pruebas de `marca.test.ts` sí.
