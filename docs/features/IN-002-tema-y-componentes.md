# IN-002 · Tema Instrumento y componentes base

## Objetivo y catálogo

Que ninguna pantalla tenga que inventar estilos. Catálogo: **APP-02** (tema claro y oscuro). Depende de IN-001 y F0-9.

## Estado de partida

- IN-001: isla React en `/`, Tailwind 4 con `@tailwindcss/vite`, comprobación de colores fuera de `tokens.css`, pruebas de componentes con happy-dom.
- F0-9: fuentes de `@fontsource` por subconjunto y peso, 182 KB, sin peticiones externas.
- ADR-0004: el CSS de las pantallas es la referencia de medidas e iconos.
- Aún no hay i18n (IN-003) ni router (IN-008).

## Diseño

### Archivos

```
src/ui/tema/tokens.css       ← anexo de rimor-diseno.md §16, tal cual
src/ui/tema/tailwind.css     ← theme y utilities de Tailwind (sin preflight) + @theme inline de la guía §14.3
src/ui/tema/base.css         ← base del documento portada de las pantallas (*, body, h1–h4, foco, .mono, .lbl…)
src/ui/tema/fuentes.ts       ← importa Archivo 400–800 y Roboto Mono 400–500, latin y latin-ext
src/ui/tema/estilos.css      ← punto de entrada: tailwind + base + componentes
src/ui/tema/tema.ts          ← preferencia de tema (sistema | claro | oscuro): leer, guardar y aplicar
src/ui/tema/contraste.ts     ← luminancia y contraste WCAG (puro), para la prueba de §13.1
src/ui/componentes/componentes.css ← clases de componentes portadas de las pantallas
src/ui/componentes/*.tsx     ← un archivo por componente (o por familia pequeña)
src/ui/iconos/Icono.tsx      ← trazados de las pantallas (ADR-0004) y mapa tipo → icono
src/ui/muestras/Muestras.tsx ← página de muestras (solo en desarrollo)
src/layouts/Base.astro       ← script en línea que aplica el tema antes de pintar (IN-009 añade su hash a la CSP)
```

**Sin preflight de Tailwind:** el CSS de las pantallas cuenta con los estilos por defecto del navegador (listas con viñeta, márgenes de `p` anulados a mano…). Para que se vea igual, se importan solo `theme` y `utilities`, y la base es la de las pantallas.

### Componentes

Cada uno usa solo clases de `componentes.css`, que solo usan tokens. Propiedades mínimas, sin texto propio (lo pasa quien lo usa, ya traducido).

| Componente | Clase | Propiedades |
|---|---|---|
| `Boton` | `.btn`, `.pri`, `.gh`, `.key`, `.sm`, `.dan` · `.ibtn` | `variante: 'primario' \| 'secundario' \| 'fantasma' \| 'senal' \| 'icono'`, `peligro?`, `pequeno?`, `icono?` y los de `<button>` |
| `Segmentado` | `.seg` | `opciones: {valor, etiqueta}[]`, `valor`, `alCambiar`, `etiqueta` (aria) |
| `Filtro` | `.pill` | píldora pulsable, `activo?` |
| `ChipTipo` | `.kchip k-*` | `tipo` |
| `IconoTipo` | `.ti k-*` | `tipo`, `denso?` (24 px) |
| `Estado` | `.st` + `acc/ok/warn/bad` | `tono`, hijos |
| `Ref` | `.ref` | `refe`, `alPulsar?` |
| `Piloto` | `.piloto` (7 px) | `tono: 'ok' \| 'warn'`, `etiqueta` |
| `Kbd` | `.kbd` | hijos |
| `Tarjeta` | `.card` + `h3` | `titulo?`, `etiqueta?` (`.lbl` encima) |
| `Detalles` | `details.more` | `resumen`, `recuento?`, `abierto?` |
| `Banner` | `.banner` | hijos (recuento en `<b>`) |
| `Hueco` | `.gap` + `hi/okk/acc` | `gravedad`, `accion?` |
| `Tabla` | `.tbl-wrap table` | `columnas`, `filas`, alineación numérica |
| `BarraH` | `.hb` | `etiqueta`, `valor`, `maximo`, `texto` |
| `Medidor` | `.meter` | `fraccion` (0–1), `etiqueta` |
| `Vacio` | `.empty` | `titulo`, hijos |
| `Cargando` | `.loading` | `texto`; IN-090 sustituye la barra indeterminada por `<Senal estado="cargando">` |
| `ErrorTarjeta` | `.card.error` | `titulo`, hijos (qué pasó y qué hacer) |
| `Aviso` | `.toast` | proveedor con cola (`useAvisos().avisar(texto)`), 2,6 s |
| `Rejilla` | `.rejilla` | adorno del raíl (puntos de 1,5 px cada 8 px) |
| `Veredicto` | `.verdict` + `ok/warn/bad` | `cifra`, `frase`, `explicacion`, `tono` |
| `Cifra` | `.cifra` + `old/bad` | cifra viva en documentos |
| `SelectorTema` | `Segmentado` | sistema · claro · oscuro |

`Icono` dibuja los trazados de las pantallas: `nombre`, `tamano` (16 por defecto), `aria-hidden`. Mapa tipo → icono de la guía §6.1 (`log`, `error`, `mediciones`, `prompt`, `markdown`, `enlace`, `idea`, `datos`, `codigo`, `comando`, `json`, `texto`, `http`, `comparacion`, `investigacion`, `documento`, `hilo`).

### Tema

```ts
type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';
function leerPreferencia(): PreferenciaTema;          // localStorage «rimor:tema»; por defecto 'sistema'
function aplicarTema(p: PreferenciaTema): void;       // data-theme en <html> (sin atributo si 'sistema')
function guardarPreferencia(p: PreferenciaTema): void;
```

Mientras no existan los ajustes del espacio (IN-038), la preferencia vive en `localStorage`; IN-038 la moverá a `.rimor/ajustes.json` y mantendrá `localStorage` como copia para aplicar el tema antes de abrir el espacio. Un script en línea de `Base.astro` aplica el tema antes de pintar, sin parpadeo.

### Muestras

`/muestras` (solo con `import.meta.env.DEV`): mientras no hay router, la isla muestra `Muestras` si la URL es `#/muestras`; IN-008 lo convierte en ruta. Enseña cada componente **en los dos temas lado a lado** con dos `<iframe>` de la propia página (`#/muestras?marco=claro|oscuro`), cada uno con su `data-theme`. Los textos de ejemplo son literales: es una página de desarrollo y queda fuera de la regla de textos de IN-003.

## Tareas

- [ ] `tokens.css` del anexo, `tailwind.css` con `@theme inline`, `base.css` y `fuentes.ts`.
- [ ] `Icono` con los trazados de las pantallas e `IconoTipo`/`ChipTipo` con el mapa de tipos.
- [ ] Los componentes de la tabla, con sus clases portadas.
- [ ] Selector de tema guardado en local.
- [ ] Página de muestras con los dos temas lado a lado.

## Pruebas previstas

- **Contraste (§13.1):** prueba que lee `tokens.css`, calcula el contraste WCAG de cada par de la tabla en claro y oscuro (y `#191919` sobre `#EE4F1F`, IN-089) y exige el mínimo de la tabla (con 0,1 de tolerancia por redondeo).
- `tema.ts`: preferencia por defecto, guardar y aplicar (`data-theme`).
- Componentes (happy-dom): `Boton` aplica la clase de cada variante; `Segmentado` marca `aria-pressed` y avisa al cambiar; `Detalles` muestra el recuento; `Aviso` desaparece a los 2,6 s (temporizadores falsos); `Veredicto` aplica el tono.
- La comparación visual con Playwright queda aplazada por instrucción del autor.

## Criterios de aceptación

- `/muestras` reproduce la pantalla «Sistema de diseño» (mismas clases y medidas que su CSS).
- El contraste de cada par de §13.1 se comprueba en una prueba automática.
- `pnpm verificar` en verde; carga inicial < 300 KB.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Guía y pantallas difieren en medidas e iconos | ADR-0004: mandan las pantallas en lo visual |
| Las muestras en dos temas a la vez, con tokens en `:root` | Dos `iframe` de la misma página |
| Parpadeo del tema forzado | Script en línea en `Base.astro` (su hash irá a la CSP en IN-009) |
| Peso de las fuentes en la carga inicial | Las `.woff2` no cuentan como JS; el CSS de `@font-face` es pequeño |

## Autorrevisión

- Cubre todas las tareas de la ficha; se aparta en `lucide-react` (ADR-0004).
- No contradice ADR-0001/0002. Lo más simple: CSS portado con los mismos nombres y componentes finos.

## Cambios durante la implementación

- **Tokens añadidos al final de `tokens.css`** (bloque marcado, ADR-0004): `--sombra-flotante`, `--sombra-pulsado` y `--sombra-tarjeta-lienzo`, las sombras que las pantallas usan además de `--shadow`. Así ningún componente lleva un `rgba()` suelto.
- **Tamaños de letra en `rem`** (14 px = `.875rem`), como pide la guía §13.2; con el tamaño de letra por defecto se ven igual que en las pantallas.
- `ChipTipo` e `IconoTipo` reciben el nombre del tipo ya traducido (`nombre`) hasta que exista i18n (IN-003). El mapa tipo → icono y clase vive en `src/ui/iconos/tipos.ts` con los nombres de tipo del plan; IN-004 definirá `TipoElemento` con los mismos nombres.
- Iconos añadidos con la misma retícula para lo que las pantallas no dibujan: imagen, PDF, fórmula, diagrama, cálculo, datos y copias, ajustes, fijar, papelera, cerrar, copiar, descargar, subir, más y hecho.
- `Medidor` y `Segmentado` usan `role="meter"` y `role="group"` sobre `div` (con su comentario para Biome): `<meter>` no admite el aspecto de la guía en todos los navegadores y `<fieldset>` obliga a una leyenda visible.
- Biome: `noImportantStyles` desactivada; los dos `!important` (`[hidden]` y movimiento reducido) son intencionados.
- Los estilos globales y las fuentes se importan en `Base.astro`, no en la isla, para que Astro los enlace en el HTML aunque la isla sea `client:only`.
