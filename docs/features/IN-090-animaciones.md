# IN-090 · Animaciones del símbolo (núcleo)

## Objetivo y catálogo

Que las esperas y los momentos clave hablen con el símbolo, con pocas animaciones, tranquilas y siempre con texto al lado. Catálogo: movimiento (`rimor-diseno.md` §11). Depende de IN-002, IN-089 y D18.

## Estado de partida

- IN-089: `geometria.ts` (onda, punto, guion) y `SimboloRimor`.
- IN-002: `Cargando` con barra indeterminada y `ErrorTarjeta` sin animación; muestras en dos temas; `prefers-reduced-motion` anula toda animación en `base.css`.
- Especificación: los 40 SVG SMIL de `docs/marca/originales/rimor-animaciones/svg/` (claro y oscuro solo cambian colores).

## Diseño

### Técnica (D18)

Cada estado se porta del SVG a `@keyframes` CSS sobre un SVG en línea dibujado con `geometria.ts`:

- cada `keyTimes` es un porcentaje del `@keyframes`; cada tramo con `keySplines` lleva `animation-timing-function: cubic-bezier(.4, 0, .2, 1)` (en CSS, la función de un fotograma rige el tramo que empieza en él); los recorridos `calcMode="linear"` van con `linear`;
- `stroke-dashoffset` con `pathLength="100"`, `opacity`, `transform` (con `transform-box: view-box` y el mismo origen que el `translate/scale` del SVG), `r` y `fill` por token, y `offset-path` para el `animateMotion` de «indexando»;
- colores por token: onda `--ink`, punto `--key`, error `--bad`, apagado `--apagado`, frase `--muted`.

### Archivos

```
src/ui/marca/Senal.tsx          ← componente: SVG en línea por estado, propiedades de abajo, texto al lado
src/ui/marca/senal.css          ← @keyframes de los 11 estados (01, 02, 04, 06, 09, 11, 14, 15, 17, 19, 20)
src/ui/marca/estadosSenal.ts    ← tabla pura: duración, veces por defecto, fotograma de reposo (%) y si es bucle
src/ui/marca/useEsperaVisible.ts← umbral de 400 ms y mínimo de 600 ms
src/ui/marca/referencia/        ← copia de los SVG originales (solo para pruebas; no se publican)
```

### Componente

```tsx
type EstadoSenal = 'arranque' | 'primer-uso' | 'cargando' | 'analizando' | 'indexando' | 'contestando'
  | 'exportando' | 'copia-al-dia' | 'guardado' | 'error' | 'comparando'
  | 'leyendo-datos' | 'sin-conexion' | 'evidencia' | 'procesando';   // estos cuatro, en sus IN

<Senal estado="indexando" tamano={24} veces="bucle" etiqueta={t('…')} />
```

- `veces`: `'bucle'` o `1`; por defecto, el de la tabla de la ficha. Con `1`, `animation-iteration-count: 1` y `fill-mode: forwards` hasta el fotograma de reposo: la animación se corta en ese porcentaje (se define la duración total y un `@keyframes` «hasta el reposo» que termina en él).
- **Bucles con límite:** tras 20 s en bucle, el componente pasa a su fotograma de reposo (cambia a la clase `reposo`).
- **Nunca sola:** `etiqueta` es obligatoria y se pinta al lado (o se pasa como texto visible por quien lo usa con `soloSimbolo` cuando el texto ya está en su sitio, como el avatar de Rimor); el contenedor lleva `role="status"` y `aria-live="polite"`.
- **Movimiento reducido:** `base.css` ya quita las animaciones; además, `.senal` en `prefers-reduced-motion` muestra el fotograma de reposo con estilos estáticos (no la primera imagen de la animación).
- **Una por zona:** regla de uso; se comprueba en las revisiones de diseño de cada pantalla (IN-040).

### Fotogramas de reposo (de la ficha)

| Estado | Reposo |
|---|---|
| arranque | logotipo completo (88 %) |
| primer-uso | logotipo con la frase (90 %) |
| cargando | símbolo con la onda tenue |
| analizando, indexando, exportando, guardado | símbolo |
| contestando | símbolo mono |
| copia-al-dia | punto encendido (88 %) |
| error | onda normal y punto en `--bad` |
| comparando | ondas alineadas y punto (75 %) |

### `useEsperaVisible(activo)`

Devuelve `visible`: pasa a `true` si `activo` sigue siéndolo a los 400 ms; una vez visible, se mantiene al menos 600 ms aunque `activo` vuelva a `false`. Con temporizadores, sin dependencias.

### Cambios en lo existente

- `Cargando` sin progreso usa `<Senal estado="cargando">` en vez de la barra indeterminada; la barra queda para el progreso determinado.
- `ErrorTarjeta` lleva `<Senal estado="error" veces={1}>`.
- Muestras: cada estado en claro y oscuro, con botón para repetir y un interruptor de movimiento reducido (clase en la página que fuerza el reposo).

## Tareas

- [ ] `Senal.tsx` y `senal.css` con los estados de v0.1 (01, 02, 04, 06, 09, 11, 14, 15, 19, 20) y el 17.
- [ ] Copiar los SVG originales a `src/ui/marca/referencia/`.
- [ ] `useEsperaVisible`.
- [ ] `Cargando` y `ErrorTarjeta` con su `Senal`.
- [ ] Muestras de cada estado.

## Pruebas previstas

- **Fidelidad con el original sin navegador:** una prueba lee cada SVG de `referencia/` y extrae sus `keyTimes`, `values`, `dur`, `calcMode` y colores, y comprueba que `estadosSenal.ts` y `senal.css` tienen la misma duración, los mismos porcentajes, los mismos valores y la misma curva por tramo, y el color por token equivalente (tinta, señal, error, apagado). La comparación de píxeles en cinco instantes queda para Playwright.
- Movimiento reducido: `senal.css` contiene la regla de reposo para `prefers-reduced-motion` de cada estado.
- `useEsperaVisible`: una espera de 300 ms no muestra nada; una de 450 ms se ve al menos 600 ms (temporizadores falsos).
- `Senal`: `role="status"`, texto al lado, clase por estado; tras 20 s en bucle pasa a reposo; con `veces={1}`, sin bucle.
- Peso de `Senal.tsx` y `senal.css` < 4 KB comprimidos (prueba con gzip sobre los archivos fuente).

## Criterios de aceptación

- Los 10 estados de v0.1 (y el 17) coinciden con sus SVG originales en tiempos, valores y curvas (prueba de fidelidad estructural; la de píxeles, pendiente de Playwright).
- Ninguna pantalla muestra dos bucles a la vez (revisión de cada pantalla).
- Con movimiento reducido no se mueve nada.

## Riesgos y dudas

| Riesgo o duda | Decisión |
|---|---|
| Sin Playwright no hay comparación de píxeles | Prueba estructural contra los SVG; la de píxeles queda pendiente |
| `animateMotion` (indexando) | `offset-path: path(…)` con la misma ruta y `offset-distance` lineal |
| `r` animable en CSS | Lo es en todos los navegadores actuales (propiedad geométrica de SVG 2) |
| `fill` del texto en arranque y primer uso | Texto SVG con `fill: var(--ink)` y la frase con `--muted` |

## Autorrevisión

Cubre la ficha. La prueba de fidelidad se adapta a la ausencia de navegador sin rebajar lo que comprueba en tiempos, valores y curvas.

## Cambios durante la implementación

- **Una vez = iteraciones fraccionarias:** con `veces={1}`, `animation-iteration-count` es la fracción del ciclo del reposo (0,88 en arranque y copia al día, 0,9 en primer uso, 0,75 en comparando) y `fill-mode: both` deja el fotograma ahí. Error no usa `fill-mode`: al acabar vuelve a la base, que es su reposo (onda normal y punto en `--bad`).
- Los estilos sin animación de cada estado **son** su reposo, así que el movimiento reducido (que `base.css` ya anula) y el corte de los bucles a los 20 s (clase `reposo`) enseñan el fotograma correcto sin reglas aparte.
- `Senal` admite `decorativa` (sin rol ni texto, oculta al lector) para `ErrorTarjeta`, que ya se anuncia con `role="alert"` y su título.
- **`Espera`** (en `Estados.tsx`): `Cargando` detrás de `useEsperaVisible`; la usa el `Suspense` de la carcasa para que una pantalla que tarda menos de 400 ms no enseñe nada.
- La barra indeterminada de `Cargando` desaparece (su `@keyframes` también): la espera indeterminada es la señal y la barra queda para el progreso.
- La regla de textos de IN-003 ya no confunde comparaciones (`estado === 'cargando'`) con texto visible: en `cond && x` solo mira la derecha.
- La prueba de fidelidad se comprobó con una mutación (cambiar un 42 % por 43 % y una escala de 0,4 por 0,5 la hace fallar).
