# IN-003 · Textos, idiomas y formatos

## Objetivo y catálogo

Español primero e inglés preparado, y números y fechas siempre bien formateados. Catálogo: **APP-07**. Depende de IN-001.

## Estado de partida

- IN-001: Vitest (Node y happy-dom), Biome y comprobaciones propias en `scripts/`.
- IN-002: componentes sin textos propios; `ChipTipo` e `IconoTipo` reciben el nombre del tipo ya traducido; la página de muestras usa literales.
- Guía §4.3: coma decimal, espacio de no separación antes de la unidad y de `%`, menos U+2212, miles como `Intl.NumberFormat('es-ES')` (`2400`, `10.000`), fechas relativas («hoy, 17:49», «ayer», «2 oct»), p-valores (`p < 0,001`, `p = 0,031`), comillas angulares.

## Diseño

### Decisión: librería propia mínima

`@lingui/core` necesita extracción y compilación de catálogos (o macros de Babel) y añade peso a la carga inicial. Lo que Rimor necesita cabe en unas 100 líneas: claves tipadas, interpolación, plurales con `Intl.PluralRules`, ordinales y cambio en caliente. **Se hace propia.**

### Archivos

```
src/i18n/es.json        ← catálogo de referencia (define las claves)
src/i18n/en.json        ← mismo árbol de claves; una prueba lo exige
src/i18n/i18n.ts        ← tipos de clave, traducir(), plurales, idioma activo y suscripción
src/i18n/useT.ts        ← hook de React: re-pinta al cambiar de idioma
src/i18n/formatos.ts    ← formateadores puros (número, cifra, p, duración, bytes, fechas, ordinal)
scripts/comprobar-textos.mjs ← regla de lint: ningún literal visible en componentes
```

### Claves y traducción

```ts
type Idioma = 'es' | 'en';
type Catalogo = typeof es;                      // es.json es la referencia
type Clave = RutasHoja<Catalogo>;               // 'rail.inicio' | 'feed.sinClasificar' | …
type Vars = Record<string, string | number>;

function traducir(idioma: Idioma, clave: Clave, vars?: Vars): string;
function t(clave: Clave, vars?: Vars): string;  // con el idioma activo
function idiomaActivo(): Idioma;
function cambiarIdioma(i: Idioma): void;        // avisa a los suscriptores (cambio en caliente)
function suscribir(fn: () => void): () => void;
```

- **Interpolación:** `{n}`, `{fecha}`… Una variable que falta se deja como `{n}` (visible en pruebas, nunca rompe).
- **Plurales:** un valor puede ser un objeto `{ "one": "…", "other": "…" }` (categorías de `Intl.PluralRules`); se elige con la variable `n`. El tipo `RutasHoja` trata ese objeto como hoja.
- **Respaldo:** si una clave falta en inglés, se usa la española (y la prueba de catálogos lo impide en el repositorio).
- **Idioma inicial:** el guardado (`localStorage` «rimor:idioma», hasta que IN-038 lo lleve a Ajustes) o, si no hay, el del navegador si empieza por `en`; si no, español. `<html lang>` se actualiza al cambiar.

### Formateadores (`formatos.ts`, puros)

Todos reciben el idioma (y la zona horaria en las fechas) para poder probarlos sin entorno. Si el número no es finito devuelven `—`.

| Función | Ejemplo `es` | Ejemplo `en` |
|---|---|---|
| `fmtNumero(n, dec?)` | `10.000`, `2400`, `38,54`, `−3` | `10,000`, `2,400`, `38.54`, `−3` |
| `fmtCifra(n, dec, unidad?)` | `fmtCifra(-4.515, 1, '%')` → `−4,5 %` (U+00A0) · `38,54 ms` | `−4.5 %` · `38.54 ms` |
| `fmtP(p)` | `p < 0,001` · `p = 0,031` | `p < 0.001` · `p = 0.031` |
| `fmtDuracion(ms)` | `850 ms` · `1,6 s` · `12 min` · `3,5 h` · `1,6 días` | `850 ms` · `1.6 s` · `12 min` · `3.5 h` · `1.6 days` |
| `fmtBytes(b)` | `512 B` · `2,4 KB` · `2,4 MB` | `2.4 MB` |
| `fmtHora(fecha, zona)` | `17:49` | `17:49` |
| `fmtFechaRelativa(fecha, ahora, zona)` | `hoy, 17:49` · `ayer, 18:21` · `2 oct` · `2 oct 2025` | `today, 17:49` · `yesterday, 18:21` · `Oct 2` · `Oct 2, 2025` |
| `fmtFecha(fecha, zona)` | `17 oct 2026, 17:49` (Detalles) | `Oct 17, 2026, 17:49` |
| `fmtOrdinal(n, genero?)` | `3.ª` / `3.º` | `3rd` |

- **Menos U+2212** en toda cifra negativa (también `−0` se pinta `0`).
- **Miles:** `Intl.NumberFormat` con `useGrouping: 'min2'` en español (así sale `2400` y `10.000`, como la guía) y normal en inglés.
- Los días «hoy» y «ayer» se calculan en la zona horaria indicada, no en UTC.

### Regla de textos

`comprobar-textos.mjs` analiza con el compilador de TypeScript cada `.tsx` de `src/` (salvo pruebas y `src/ui/muestras/`) y falla si encuentra:

- texto JSX con letras (`<b>Guardar</b>`);
- un literal con letras en `aria-label`, `title`, `placeholder`, `alt`, `aria-description` o `etiqueta`/`texto`/`titulo` (las propiedades de los componentes de Rimor que acaban en pantalla).

Lo que no tiene letras (`·`, `›`, `−`, cifras) pasa. Se añade a `pnpm lint`.

### Cambios en lo existente

- `ChipTipo` e `IconoTipo` dejan de recibir `nombre`: lo traducen con `tipos.<tipo>`.

## Tareas

- [ ] `i18n.ts` con claves tipadas, interpolación, plurales y respaldo.
- [ ] `formatos.ts` con todos los formateadores.
- [ ] Ordinales («3.ª vez»).
- [ ] Cambio de idioma en caliente (`useT`).
- [ ] Regla de lint de literales visibles.
- [ ] Catálogos `es` y `en` con los nombres de los tipos.

## Pruebas previstas

- Cada formateador en `es` y `en`, con 0, negativos, `−0`, `NaN`, `Infinity`, redondeos (`-4.515` → `−4,5`), y fechas en otra zona horaria (`Europe/Madrid` frente a `America/New_York` alrededor de medianoche).
- `fmtCifra(-4.515, 1, '%')` es exactamente `'−4,5 %'`.
- Plurales y ordinales en los dos idiomas; variable que falta.
- Catálogos: mismo árbol de claves en `es` y `en`, y las mismas variables `{x}` en cada texto.
- Propiedad (fast-check): `fmtNumero` nunca usa el guion `-` ni deja `NaN` visible.
- `comprobar-textos`: un componente con `<b>Guardar</b>` o `aria-label="Cerrar"` falla; `{t('…')}` y `·` pasan.
- `useT` re-pinta al cambiar de idioma (happy-dom).

## Criterios de aceptación

- Ningún literal visible en componentes (regla de lint en `pnpm lint`).
- `fmtCifra(-4.515, 1, '%')` da `−4,5 %` con espacio de no separación.
- `pnpm verificar` en verde.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| `-4.515` es `-4.51499…` en binario | El redondeo de `Intl` da `−4,5` con 1 decimal; con 2 decimales daría `−4,51`, y se acepta: es el valor real |
| Ordinales en español dependen del género | `fmtOrdinal(n, 'f' \| 'm')`, femenino por defecto («3.ª vez») |
| Las respuestas de Rimor (IN-016) se generan en TS puro | Recibirán el idioma por parámetro y usarán `traducir()`; se decide en IN-016 |

## Autorrevisión

Cubre las tareas de la ficha. Sin dependencias nuevas. No contradice decisiones previas; ajusta `ChipTipo` e `IconoTipo` como estaba previsto en IN-002.

## Cambios durante la implementación

- `formatos.ts` usa `en-GB` para el inglés (24 h y miles con coma) y una tabla propia de meses abreviados («2 oct», «Oct 2»), porque el texto de `Intl` para los meses cambia entre versiones de ICU («oct.» frente a «oct»).
- `src/i18n/iniciar.ts` separa lo que toca `localStorage` y `navigator` (idioma inicial y elegido) para que `i18n.ts` siga siendo puro. La isla lo llama al cargarse.
- `SelectorTema` traduce sus propios textos (`tema.*`) y ya no recibe `etiqueta` ni `textos`.
- La regla de textos también detecta literales en plantillas (`` `${n} filas` ``) y no mira la propiedad `nombre` (es el nombre del icono, no se ve).
- Los dos catálogos van en la carga inicial (76,2 KB en total). Si el inglés crece mucho, se cargará bajo demanda.
