# Rimor: diseño y estilo

> **Guía de diseño · estilo «Instrumento».** Versión 1.2 · 18 de octubre de 2026 (símbolo «Señal», animaciones y token `--apagado`).
> Va junto a `rimor-plan.md` (el plan del proyecto; su §17 resume esta guía y remite aquí).
> **Referencias visuales:**
> - «Pantallas de Rimor» (v3): todas las pantallas en este estilo, en modo claro y oscuro.
> - «Estilos de Rimor»: las diez direcciones exploradas antes de elegir esta.
>
> **Si esta guía y las pantallas no coinciden, manda esta guía.**

---

## Índice

1. La idea
2. Principios
3. Color
4. Tipografía
5. Espacio, forma y profundidad
6. Iconos y símbolo
7. Componentes
8. Composición de pantallas
9. La voz de Rimor y los textos
10. Gráficas
11. Movimiento
12. Modo oscuro
13. Accesibilidad
14. Implementación
15. Revisión de diseño
16. Anexo: tokens completos

---

## 1. La idea

**Rimor es un instrumento, no una libreta.** La referencia es el diseño industrial alemán de los años sesenta: aparatos de medida, radios y calculadoras que se entienden con solo mirarlos. Su lema era «menos, pero mejor».

Llevado a la app:

- **Cada pantalla es la carátula de un aparato:** muestra la lectura que importa, en grande, y el resto de los controles solo cuando hacen falta.
- **Materiales sobrios:** gris cálido, tinta casi negra y un solo color de señal, naranja, como el piloto o el botón de grabar de un aparato.
- **Detalles funcionales, no decorativos:** la rejilla de altavoz y el piloto verde del raíl son el único guiño físico. El piloto dice algo real: si la copia de seguridad está al día.

### Por qué este estilo

Se eligió entre diez direcciones (Cuaderno, Cianotipo, Fósforo, Instrumento, Preprint, Control de misión, Taller, Hipertexto, Bata blanca y Observatorio). Instrumento ganó por tres razones:

1. **No cansa.** Es una herramienta de uso diario durante años, y los estilos más temáticos (fósforo, cianotipo, observatorio) se agotan antes.
2. **Deja hablar a los datos.** Con un solo color de señal, una cifra en naranja o un error en rojo se ven al instante.
3. **Tiene carácter sin disfrazarse.** Se distingue de las apps genéricas (que es el riesgo de Bata blanca) sin parecer un decorado.

### Lo que no es

- No es retro: ni texturas de plástico, ni botones en relieve, ni tipografías de época.
- No es minimalismo vacío: la densidad de información es alta; lo que se quita es el ruido.
- No es monocromo por pose: los colores de estado (correcto, aviso, error) siguen ahí, porque comunican.

---

## 2. Principios

| # | Principio | En la práctica |
|---|---|---|
| E1 | **Una pregunta por pantalla** | Cada pantalla responde a algo concreto: ¿qué pasa en este log?, ¿qué opción gana? Si no se puede decir la pregunta, la pantalla sobra. |
| E2 | **Lo que responde, arriba; lo demás, plegado** | Veredicto, resumen y acción principal a la vista. Metadatos, cifras citables, avisos de método y originales, dentro de «Detalles». |
| E3 | **Un veredicto, una cifra** | Si una pantalla tiene un resultado, va en una cifra grande (34 px, peso 800) y una frase. Nunca dos cifras grandes compitiendo. |
| E4 | **Un solo naranja** | El naranja marca lo que importa: el botón de enviar, la serie destacada de una gráfica, los pilotos y el símbolo. Nada más (§3.3). |
| E5 | **Tono antes que línea** | Las tarjetas se separan del fondo por el tono y una sombra mínima, no con bordes. Las líneas quedan para tablas y separadores. |
| E6 | **La forma dice qué es** | Píldora: se pulsa. Círculo: identifica (tipo, avatar, piloto). Rectángulo redondeado: contiene. |
| E7 | **El color es estado, no tipo** | Los tipos de elemento se distinguen por icono y nombre, en neutro. Solo **Error** lleva color, porque además de un tipo es un estado. |
| E8 | **Los datos, en monoespaciada** | Logs, código, refs, horas y cifras de tablas van en Roboto Mono con cifras tabulares. |
| E9 | **Rimor habla poco** | Una o dos frases. Si pregunta, ofrece botones. Nunca formularios (§9). |
| E10 | **Mismo diseño en claro y oscuro** | El modo oscuro se diseña, no se invierte (§12). |

---

## 3. Color

### 3.1. Paleta

Tokens semánticos. Los componentes **solo** usan estos nombres, nunca valores sueltos.

| Token | Uso | Claro | Oscuro |
|---|---|---|---|
| `--page` | Fondo exterior (web de referencia, márgenes) | `#DCD9D2` | `#121211` |
| `--app` | Fondo de la app | `#E8E6E1` | `#1A1A19` |
| `--panel` | Superficie: tarjetas, raíl, compositor | `#F6F5F1` | `#242422` |
| `--panel-2` | Superficie hundida: respuesta de Rimor, segmentados, chips | `#E3E0D9` | `#2E2D2B` |
| `--ink` | Texto principal; también relleno del botón primario | `#191919` | `#EDEBE6` |
| `--muted` | Texto secundario, etiquetas | `#67645E` | `#9D998F` |
| `--faint` | Texto terciario: horas, pistas. Solo sobre `--panel` | `#737068` | `#8F8B83` |
| `--line` | Bordes de controles, separadores visibles | `#CCC8BF` | `#3A3936` |
| `--line-2` | Líneas de tabla, rejillas de gráficas | `#DDD9D1` | `#2F2E2B` |
| `--apagado` | Gris decorativo de las animaciones del símbolo: punto apagado y serie de referencia. Nunca para texto | `#A8A49B` | `#5E5B55` |
| `--accent` | Lo «activo» neutro: botón primario, selección | `#191919` | `#EDEBE6` |
| `--accent-ink` | Texto sobre `--accent` | `#F6F5F1` | `#1A1A19` |
| `--accent-soft` | Fondo de lo seleccionado (raíl, filtros) | `#E3E0D9` | `#34332F` |
| `--key` | **El naranja:** relleno de enviar, serie destacada, pilotos, símbolo | `#EE4F1F` | `#FF6A3D` |
| `--key-ink` | Icono o texto sobre naranja (siempre oscuro) | `#191919` | `#1A1A19` |
| `--key-text` | Naranja para texto pequeño (recuentos activos) | `#C9401A` | `#FF7E55` |
| `--key-soft` | Fondo naranja suave (casi nunca; ver §3.3) | `#F8D9CD` | `#40291F` |
| `--ok` / `--ok-soft` | Correcto, resuelto, mejora | `#336E45` / `#DCEBDF` | `#7DC48F` / `#1F3125` |
| `--warn` / `--warn-soft` | Aviso, abierto, pendiente | `#8A570B` / `#F3E6CF` | `#E2A84C` / `#3A2D16` |
| `--bad` / `--bad-soft` | Error, empeora, roto | `#B32F27` / `#F5DAD6` | `#FF7A6B` / `#3F201D` |
| `--grille` | Rejilla de altavoz y sombras interiores | `rgba(25,25,25,.16)` | `rgba(255,255,255,.10)` |
| `--shadow` | Sombra de las tarjetas | `0 1px 2px rgba(0,0,0,.07)` | `none` |

**Los neutros son cálidos a propósito.** Tiran ligeramente hacia el amarillo, como el plástico y el aluminio lacado de los aparatos de referencia, y así el naranja casa con ellos sin chillar. No uses grises fríos ni el gris medio por defecto.

### 3.2. Tipos de elemento

Todos los tipos usan `--k-x` (icono `#45433F` en claro, `#CFCBC2` en oscuro) sobre `--k-x-bg` (igual que `--panel-2`). Solo Error usa `--k-err` y `--k-err-bg` (los colores de `--bad`).

Los tokens `--k-log`, `--k-med`, `--k-prm`… existen y apuntan a `--k-x`, para poder darle color a un tipo en el futuro sin tocar componentes. **No lo hagas sin una razón de producto:** romper E7 devuelve el ruido que este estilo quita.

### 3.3. Reglas del naranja

**Sí:**
- botón de enviar del compositor;
- la serie que importa en una gráfica (la nueva, la medida, «la tuya»);
- el símbolo de Rimor en el raíl;
- el recuento de la sección activa del raíl;
- el borde de una captura recién añadida, mientras está «fresca»;
- el anillo de foco del teclado;
- como mucho, **una** acción por pantalla que merezca destacarse por encima del primario negro (por ejemplo «Exportar ZIP» en Datos y copias). Si dudas, no.

**No:**
- texto corrido, títulos o enlaces;
- iconos de tipo, chips o etiquetas;
- fondos de tarjeta o de banner;
- más de un botón naranja visible a la vez;
- para expresar «bueno» o «malo»: para eso están `--ok` y `--bad`.

**Sobre naranja, siempre oscuro:** `--key-ink` es casi negro en los dos temas (4,8:1 en claro, 6,1:1 en oscuro). El blanco sobre este naranja no llega al mínimo para texto (3,6:1), así que no se usa. Como en las teclas de grabar de los aparatos de referencia: naranja con la marca en negro.

### 3.4. Colores de estado

Son independientes del naranja y no cuentan como acento.

| Estado | Token | Ejemplos |
|---|---|---|
| Correcto | `--ok` | «resuelto», diferencia que mejora, piloto de copia al día, hipótesis confirmada |
| Aviso | `--warn` | «abierto», «borrador», cifra desfasada, idea pendiente, hueco de «Qué falta» |
| Error | `--bad` | tipo Error, diferencia que empeora, referencia rota, conflicto |

**Nunca solo color:** cada estado lleva también texto («resuelto») o forma (punto, franja). Los veredictos dicen «más rápido» o «más lento», no solo verde o rojo.

---

## 4. Tipografía

### 4.1. Familias

| Papel | Familia | Pesos | Por qué |
|---|---|---|---|
| Títulos y texto | **Archivo** | 400, 500, 600, 700, 800 | Grotesca de tradición industrial, sobria y con cifras claras. Una sola familia para títulos y texto: menos, pero mejor. |
| Datos | **Roboto Mono** | 400, 500 | Monoespaciada neutra y muy legible en tamaños pequeños; distingue bien `0/O` y `1/l/I`. |

Respaldo: `"Archivo","Helvetica Neue",Arial,system-ui,sans-serif` y `"Roboto Mono",ui-monospace,"Cascadia Code",Consolas,monospace`.

**Las fuentes van empaquetadas en la app** (con `@fontsource/archivo` y `@fontsource/roboto-mono`, subconjuntos latin y latin-ext, en woff2). Nunca se cargan desde Google Fonts en producción: Rimor es local y privado (P6) y tiene que funcionar sin conexión.

### 4.2. Escala

| Nombre | Tamaño / interlineado | Peso | Espaciado | Uso |
|---|---|---|---|---|
| `veredicto` | 34 / 1 | 800 | −0,035 em | La cifra de una pantalla (`−4,5 %`) |
| `cifra` | 24 / 1,15 | 800 | −0,035 em | Cifras de tarjetas de métricas y estadísticas |
| `titulo` | 22 / 1,25 | 700 | −0,02 em | Título de pantalla o de elemento |
| `seccion` | 14,5 / 1,3 | 600 | −0,02 em | Título de tarjeta |
| `texto` | 14 / 1,5 | 400 | 0 | Texto corriente, respuestas de Rimor |
| `pequeno` | 13 / 1,5 | 400–600 | 0 | Botones, listas, tablas |
| `meta` | 12–12,5 / 1,4 | 400 | 0 | Fechas, recuentos, pies de gráfica |
| `etiqueta` | 10,5 / 1,3 | 600 | 0,09 em, MAYÚSCULAS | Etiquetas de sección y cabeceras de tabla |
| `mono` | 12–12,5 / 1,6 | 400–500 | 0 | Logs, código, refs, horas |

**Reglas:**
- Mayúsculas solo en `etiqueta`, nunca en títulos ni botones.
- Las cifras que se alinean en columna llevan `font-variant-numeric: tabular-nums`.
- Los títulos llevan `text-wrap: balance`.
- Texto corrido como máximo a unos 72 caracteres de ancho (la columna de lectura ya lo garantiza).

### 4.3. Formato de números, fechas y textos en español

- **Decimales con coma y espacio antes de la unidad:** `38,54 ms`, `4,5 %`. Usa espacio fino o de no separación (U+202F o U+00A0) para que no se parta la línea.
- **Miles:** como los formatea `Intl.NumberFormat('es-ES')`: `2400`, `10.000`. Así lo hace todo el sistema, sin excepciones a mano.
- **Signo menos de verdad (`−`, U+2212) en cifras**, no el guion.
- **Fechas relativas cuando ayudan:** «hoy, 17:49», «ayer, 18:21», «2 oct». La fecha completa queda para Detalles y documentos.
- **Comillas angulares** para citas y nombres: «Revisor de ADR».
- **p-valores:** `p < 0,001`, o `p = 0,031` con tres decimales.

---

## 5. Espacio, forma y profundidad

### 5.1. Espaciado

Base de 2 px, con estos pasos: `2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32`.

| Dónde | Valor |
|---|---|
| Relleno de tarjeta | 16 × 18 px |
| Relleno de mensaje del feed | 12 × 14 px |
| Separación entre tarjetas o mensajes | 12–16 px |
| Separación entre bloques de una pantalla | 16 px |
| Margen del área principal | 22 × 24 px (16 × 14 en móvil) |

Los grupos se maquetan con `flex` o `grid` y `gap`, nunca con márgenes sueltos.

### 5.2. Radios

| Token | Valor | Para |
|---|---|---|
| `--r-xs` | 5 px | Refs y marcas pequeñas |
| `--r-sm` | 8 px | Entradas de texto, bloques de código, huecos de «Qué falta» |
| `--r-md` | 14 px | Tarjetas y mensajes |
| `--r-lg` | 16 px | Marco de la app |
| `--r-xl` | 20 px | Compositor |
| `--r-pill` | 999 px | Botones, filtros, segmentados, chips de estado |
| `--r-round` | 50 % | Iconos de tipo, avatar de Rimor, botón de enviar, pilotos |

### 5.3. Profundidad

Solo hay tres niveles, y ninguno usa bordes:

1. **Hundido** (`--panel-2`): segmentados, respuestas de Rimor y chips. Los segmentados llevan además una sombra interior de 1 px (`inset 0 1px 2px var(--grille)`).
2. **Plano** (`--app`): el fondo.
3. **Elevado** (`--panel` con `--shadow`): tarjetas, mensajes y raíl. El compositor flota un poco más: `--shadow, 0 8px 28px rgba(0,0,0,.08)`.

Los bordes (`--line`) quedan para controles que se pueden pulsar sin relleno (botón secundario, píldora) y para los separadores. En el modo oscuro no hay sombras: la elevación se lee por el tono (§12).

### 5.4. Medidas de la carcasa

| Elemento | Medida |
|---|---|
| Raíl | 212 px |
| Columna de lectura | hasta 780 px, centrada |
| Pantallas anchas (lienzo, línea de tiempo, métricas, documento) | todo el ancho disponible |
| Punto de corte (consulta de contenedor) | 720 px: el raíl pasa a barra inferior y las rejillas, a una columna |
| Diana táctil mínima | 32 px en escritorio, 40 px en móvil |

---

## 6. Iconos y símbolo

### 6.1. Iconos

- **Juego:** Lucide (`lucide-react`), con `strokeWidth={1.8}`, extremos redondeados y `currentColor`. Si falta alguno, se dibuja con la misma retícula de 24 px y el mismo trazo.
- **Tamaños:** 16 px en línea y botones, 17 px en el raíl y 13 px en chips.
- **Iconos de tipo:** dentro de un círculo de 28 px (24 en listas densas) con fondo `--k-x-bg`.

| Tipo | Icono | Tipo | Icono |
|---|---|---|---|
| Log | líneas de texto | Enlace | eslabones |
| Error | triángulo de alerta | Idea | bombilla |
| Mediciones | barras | Datos | tabla |
| Prompt | bocadillo con líneas | Código | `</>` |
| Documento MD | marca de Markdown | Comando | `>_` |
| JSON / TOML | llaves | Comparación | flechas opuestas |
| Investigación | lupa con `+` | Documento | hoja con esquina doblada |
| Hilo | rama con flecha | Texto | párrafo |

### 6.2. Símbolo

**«Señal»:** una onda que se lee y el punto donde se adelanta el resultado. Del rumor a la conclusión.

- **Construcción:** retícula de 48 × 48 con trazo de 3 (3,6 por debajo de 20 px y en el favicon), extremos y uniones redondeados. Onda `M7 24 C10.5 12.5 13.5 12.5 17 24 S23.5 35.5 27 24` en `--ink`; punto en (33; 15,5), de radio 3,1, en `--key` (es el siguiente máximo de la onda); guion `M40 24 H41` en `--ink`.
- **Icono de app:** cuadrado redondeado con radio del 22,5 % del lado, en tres versiones: claro (`#F6F5F1`), oscuro (`#1A1A19`) y señal (fondo naranja, con onda y punto en `#191919`). Los iconos maskable van a sangre.
- **Logotipo:** el símbolo y «Rimor» en Archivo 700, en `--ink`.
- **Variantes:** color (la normal), mono en tinta (avatar de Rimor e impresión) y mono en blanco.
- **Reglas:** sin degradados, sombras ni otros colores; sobre naranja, siempre tinta oscura; margen libre de al menos el diámetro del punto.
- **En la interfaz:** logotipo en el raíl; símbolo mono en el avatar de las respuestas, que solo enciende el punto naranja mientras Rimor contesta (§11.1).
- **Archivos:** paquete `rimor-icono` (SVG, PNG de 16 a 1024 px, favicon y bloque `icons` para el manifest de la PWA).

---

## 7. Componentes

Cada componente usa solo tokens. Los nombres entre paréntesis son las clases de las pantallas de referencia.

### 7.1. Botones (`.btn`)

| Variante | Aspecto | Cuándo |
|---|---|---|
| **Primario** (`.pri`) | Píldora rellena de `--accent` (tinta) con texto `--accent-ink` | La acción principal de un bloque. Puede haber uno por bloque. |
| **Secundario** | Píldora `--panel` con borde `--line` | El resto de acciones visibles |
| **Fantasma** (`.gh`) | Solo texto, sin fondo | Acciones de una línea: «Ver», «Abrir matriz» |
| **Señal** (`.key`) | Píldora rellena de `--key` con texto `--key-ink` | Como mucho una por pantalla (§3.3) |
| **Icono** (`.ibtn`) | Icono + texto en `--muted` y fondo al pasar el ratón | Acciones de mensaje: Responder, Archivar |

Texto en 12,5–13 px y peso 500–600. El texto es siempre un verbo que dice lo que pasa: «Exportar ZIP», no «Aceptar».

### 7.2. Controles de selección

- **Segmentado** (`.seg`): píldora hundida con sombra interior; la opción activa es una píldora `--panel` con texto en negrita. Sirve para 2 a 4 opciones excluyentes: Todo / Sin clasificar, v1 / v2.
- **Filtro** (`.pill`): píldora con borde; al pasar el ratón, borde `--ink`.
- **Raíl** (`.rb`): la sección activa usa fondo `--accent-soft` y texto en negrita, y su recuento va en `--key-text`.

### 7.3. Chips y marcas

| Componente | Aspecto |
|---|---|
| Chip de tipo (`.kchip`) | Píldora `--k-x-bg` con icono y nombre del tipo en `--k-x` |
| Estado (`.st`) | Píldora pequeña con fondo `-soft` y texto del estado (`resuelto` en `--ok`) |
| Referencia (`.ref`) | `LOG-0047` en mono 11,5 px, fondo `--panel-2`, radio `--r-xs`. Se puede pulsar y abre el elemento. Solo aparece donde se puede pulsar; en otro caso va en Detalles. |
| Piloto | Círculo de 7 px. En `--ok` es estado correcto (copia al día) y en `--warn`, pendiente. Nunca parpadea. |

### 7.4. Tarjeta (`.card`)

Superficie elevada sin borde, con radio `--r-md` y relleno 16 × 18 px. Lleva un título `seccion` y, si hace falta, una `etiqueta` encima. **Una tarjeta, una idea:** si necesita dos títulos, son dos tarjetas.

### 7.5. Mensaje del feed (`.msg`)

Es la unidad de Inicio y de los hilos, de arriba abajo:

1. **Cabecera:** icono de tipo, título (una línea con elipsis) y hora en mono `--faint`.
2. **Vista previa** (opcional): una línea en mono `--muted` con el comienzo del original.
3. **Respuesta de Rimor** (§7.6).
4. **Acciones:** botones propuestos por Rimor a la izquierda; Responder y Archivar a la derecha.

Una captura recién enviada lleva borde `--key` mientras está fresca (hasta que se navega o pasan 10 segundos).

### 7.6. Respuesta de Rimor (`.rimor`)

Bloque hundido (`--panel-2`, radio `--r-sm`) con el avatar a la izquierda: el símbolo de Rimor **mono** en un círculo `--panel` de 20 px, en `--ink` (no en naranja: aparece en cada mensaje y gastaría el color). Mientras la respuesta se compone, el avatar pasa a la animación `contestando` y el punto se enciende en naranja (§11.1). El texto va en 13,5 px. Las negritas solo marcan el dato que importa: «Es la **tercera vez**».

### 7.7. Compositor (`.cbox`)

- Fijo abajo en Inicio y en los hilos, con radio `--r-xl` y sombra flotante.
- Área de texto sin borde, de 14 px, que crece hasta 220 px.
- **Vista previa en vivo** bajo el texto: «Se guardará como [chip de tipo]», confianza en mono, `@colección`, `#etiquetas` y secretos que se ocultarán.
- Fila inferior: adjuntar (icono), pistas de sintaxis en mono `--faint` y el botón de enviar: círculo de 34 px en `--key`.
- Con el foco dentro, el borde pasa a `--ink`.

### 7.8. Veredicto (`.verdict`)

La cifra (`veredicto`, en el color de estado que corresponda) y a su derecha la frase en negrita, con la explicación en `--muted` debajo: «ureq es un 4,5 % más rápido · Mann-Whitney, p < 0,001». Si no hay diferencia clara, la cifra es `≈` en `--warn`. Un veredicto por pantalla (E3).

### 7.9. Detalles plegables (`details.more`)

Línea superior `--line-2`, resumen en 13 px `--muted` con un chevron `›` que gira 90° al abrirse. El resumen lleva el recuento cuando lo hay: «Avisos de método (4)». Dentro van metadatos (lista clave-valor), cifras citables, originales y avisos.

### 7.10. Avisos y huecos

- **Banner:** fondo `--warn-soft` con el recuento en negrita y una frase: «3 cosas por revisar». Uno por pantalla como mucho.
- **Hueco** (`.gap`): fila hundida con un punto de color (`--bad` grave, `--warn` normal, `--ok` resuelto), una frase y una acción fantasma a la derecha.

### 7.11. Tablas

Cabecera en `etiqueta`, filas de 8 × 9 px, líneas `--line-2`, cifras en mono tabular alineadas a la derecha si son comparables. Sin rayado alterno ni bordes verticales.

### 7.12. Estados

| Estado | Forma |
|---|---|
| Vacío | Recuadro con borde discontinuo `--line`: qué aparecerá aquí y cómo empezar. «Lo que pegues aparecerá aquí con lo que Rimor haya entendido.» |
| Cargando | Barra fina de 6 px con un tramo `--ink` que avanza y una frase de qué se carga: «DuckDB, solo la primera vez». |
| Error | Tarjeta con borde `--bad`: qué pasó y qué hacer. «El ZIP tiene rutas fuera del espacio. No se ha escrito nada.» |
| Aviso efímero | Píldora `--ink` con texto `--panel`, abajo en el centro, 2,6 s, en participio: «Exportado», «Copiado con valores». |

### 7.13. Detalles físicos

- **Rejilla de altavoz:** puntos de 1,5 px cada 8 px en `--grille`, en el pie del raíl. Es el único adorno y no se repite en ningún otro sitio.
- **Piloto de copia:** junto al nombre del espacio, en `--ok` si la copia está al día y en `--warn` si toca hacerla.

---

## 8. Composición de pantallas

### 8.1. Carcasa

```
┌─────────┬────────────────────────────────────────────┐
│ Raíl    │        Columna de lectura (≤ 780 px)        │
│ Inicio  │  Título · meta                    [control] │
│ Buscar  │  ┌───────────────────────────────────────┐  │
│ Métricas│  │ Lo que responde (veredicto / resumen)  │  │
│ ─────── │  └───────────────────────────────────────┘  │
│ Colecc. │  ┌───────────────────────────────────────┐  │
│ Invest. │  │ Lo siguiente más útil                  │  │
│ Docs    │  └───────────────────────────────────────┘  │
│         │  › Detalles                                  │
│ ░░░░░░  │                                              │
│ ● Espac.│  [ compositor fijo abajo (Inicio, hilos) ]   │
└─────────┴────────────────────────────────────────────┘
```

Sin panel inspector: lo que antes iba en él vive en «Detalles». En el móvil, el raíl pasa a una barra inferior con Inicio, Buscar y Métricas, y el compositor queda encima de ella.

### 8.2. Orden dentro de una pantalla

1. **Cabecera:** chip de tipo y estado, título y una línea de meta (cuándo, de dónde). A la derecha, como mucho, un control (segmentado o una acción).
2. **Lo que responde:** veredicto, resumen o la gráfica principal.
3. **Lo siguiente más útil:** por ejemplo, las plantillas de un log o «Copiar con valores» en un prompt.
4. **Acciones** de la pantalla, si no están ya en su bloque.
5. **Detalles plegados**, de lo más útil a lo menos: avisos, originales y metadatos con cifras citables.

### 8.3. Densidad

- Como mucho **tres bloques abiertos** antes de los plegables.
- Como mucho **una línea de meta** por bloque.
- Si una pantalla tiene más de seis chips a la vista, sobran chips.

---

## 9. La voz de Rimor y los textos

### 9.1. Cómo habla Rimor

Rimor contesta a cada captura en el feed. Sus respuestas salen de **plantillas deterministas por lector**, con los números calculados por código (P7 del plan). No es un chat con IA: lo parece porque es la forma más natural de dejar algo y recibir una respuesta.

| Regla | Bien | Mal |
|---|---|---|
| Empieza por lo que es | «Log de 1042 líneas.» | «¡He analizado tu log!» |
| Da el dato concreto | «16 errores entre 17:40 y 17:43.» | «Hay varios errores.» |
| Si recuerda algo, lo cita | «El 15 oct escribiste: «Pasa cuando…»» | «Esto te suena de algo.» |
| Pregunta solo con dos salidas, y con botones | «¿Lo añado a su hilo?» [Sí, al hilo] [No] | «¿Qué quieres hacer con esto?» |
| Una o dos frases | «Idea guardada. Volverá dentro de 7 días si no haces nada con ella.» | Un párrafo |
| Tutea, sin efusividad | «Puedes copiarlo con el valor rellenado.» | «¡Genial! 🎉» |
| Sin culpa | «7 elementos sin clasificar, todos de hoy.» | «Tienes 7 elementos pendientes.» |
| Honesto con lo que no sabe | «No reconozco el lenguaje de la traza: se guarda como texto.» | Inventar un resultado |

Prohibido: emojis, exclamaciones, disculpas, «¡Hola!», y adjetivos que valoran («increíble», «perfecto»).

### 9.2. Textos de la interfaz

- **Botones con verbo** que dice lo que pasa: «Exportar ZIP», «Convertir en investigación», «Marcar resuelto».
- **Avisos efímeros en participio:** «Exportado», «Archivado», «Copiado con valores».
- **Errores:** qué pasó y qué hacer, sin disculpas: «No se pudo leer el ZIP: le falta `manifest.json`. Exporta de nuevo desde Rimor.»
- **Nombres que reconoce la persona:** «Datos y copias», no «Almacenamiento OPFS».
- **Sin jerga del sistema** en la interfaz: «huella» sí, porque es un concepto de Rimor; «hash» no, salvo en Detalles.

---

## 10. Gráficas

| Elemento | Regla |
|---|---|
| Serie de referencia | `--muted` |
| Serie destacada (la nueva, la medida, la tuya) | `--key` |
| Mejora o empeora | `--ok` y `--bad`, solo cuando la gráfica trata de eso |
| Rejilla | `--line-2`, 0,7 px, solo horizontal salvo en puntos |
| Texto | Roboto Mono 10–10,5 px en `--muted`; valores en `--ink` sobre los puntos |
| Leyenda | Mejor con etiquetas en la propia gráfica; si hace falta, una fila de cuadrados de 10 px debajo |
| Intervalos | Banda del color de la serie al 14–16 % de opacidad |
| Medianas | Línea de 2–2,5 px del color de la serie |
| Barras apiladas | Escala de neutros (`--ink`, `--muted`, `--faint`, `--line`) más `--key` para la categoría que importa |

**Reglas:**
- Todo a escala, y las etiquetas solo nombran valores que la gráfica alcanza.
- Cada gráfica lleva una descripción textual (`aria-label`) y un pie que dice qué se ve.
- **Con pocos datos, no hay gráfica** (P8 del plan): «La gráfica aparece con 3 mediciones».
- Sin 3D, sin degradados, sin animación al cargar y sin tartas.

Configuración base para Observable Plot:

```ts
const tema = {
  style: { fontFamily: 'var(--f-m)', fontSize: '10.5px', color: 'var(--muted)', background: 'transparent' },
  grid: true,
  color: { range: ['var(--muted)', 'var(--key)'] },
};
```

---

## 11. Movimiento

- **Duración y curva:** 150 ms con `ease-out` para hover, apertura de Detalles y aparición de mensajes. 200 ms como máximo para desplazamientos.
- **Nada rebota ni se escala.** Los mensajes nuevos aparecen sin animación de entrada, y el borde naranja ya basta para señalarlos.
- **El cursor** del compositor parpadea con el del sistema, sin reproducir uno propio.
- Con `prefers-reduced-motion: reduce` no hay ninguna transición.

### 11.1. Animaciones del símbolo

El símbolo «Señal» tiene un pequeño repertorio de animaciones (paquete `rimor-animaciones`) para las esperas y los momentos clave. Son la única excepción a «nada se anima al cargar», y siguen estas reglas:

- **Curva** `cubic-bezier(.4, 0, .2, 1)`, y lineal en los recorridos continuos (cargando, indexando, leyendo datos). Sin rebotes ni escalados bruscos: solo se animan el trazo, la opacidad, el desplazamiento, el radio del punto y su color.
- **El punto cuenta la historia:** se enciende cuando hay resultado (copia al día), parpadea antes de hablar (Rimor contesta), viaja al guion cuando algo sale (exportando) y se vuelve rojo cuando la señal se pierde (error, con la onda aplanada).
- **Umbral de 400 ms:** una espera más corta no muestra animación; si se muestra, dura al menos 600 ms.
- **Siempre con texto al lado** y anunciada como estado (`role="status"`).
- **Una por zona** y bucles con límite de 20 s.
- **Con movimiento reducido,** el símbolo fijo.

Estados que se usan: arranque, primer uso, cargando, analizando, indexando, Rimor contesta, exportando, copia al día, guardado y error; más adelante, comparando, leyendo datos, sin conexión, evidencia vinculada y procesando. La especificación exacta de cada uno son los SVG del paquete `rimor-animaciones`; dónde va cada uno y su fotograma de reposo están en la ficha IN-090 de `rimor-implementacion.md`.

---

## 12. Modo oscuro

Se diseña, no se invierte:

- **Elevación por tono, sin sombras:** `#1A1A19` (fondo) → `#242422` (tarjeta) → `#2E2D2B` (hundido) → `#34332F` (seleccionado).
- **El texto no es blanco puro:** `#EDEBE6`, que cansa menos.
- **Naranja más luminoso** (`#FF6A3D`) para mantener su peso sobre fondo oscuro. Lo que va encima, en el color del fondo.
- **Estados más claros** (`--ok #7DC48F`, `--warn #E2A84C`, `--bad #FF7A6B`), todos por encima de 6:1 sobre la superficie.
- **El botón primario se invierte:** relleno claro con texto oscuro, como las teclas claras de un aparato oscuro.

El modo sigue al sistema por defecto, y en Ajustes se puede fijar en Claro u Oscuro (APP-02). Técnicamente, `prefers-color-scheme` aplica el tema y el atributo `data-theme` en `<html>` lo fuerza (§14.2).

---

## 13. Accesibilidad

### 13.1. Contraste medido (WCAG 2.x)

| Par | Claro | Oscuro |
|---|---|---|
| Tinta sobre superficie | 16,1:1 | 13,1:1 |
| Secundario sobre superficie | 5,4:1 | 5,5:1 |
| Secundario sobre hundido | 4,5:1 | 4,8:1 |
| Tenue sobre superficie | 4,5:1 | 4,6:1 |
| Naranja de texto (`--key-text`) sobre superficie | 4,5:1 | 6,2:1 |
| Correcto / aviso / error sobre superficie | 5,6 / 5,6 / 5,7:1 | 7,5 / 7,4 / 6,1:1 |
| Correcto / aviso / error sobre su fondo suave | 4,9 / 4,9 / 4,7:1 | — |
| Icono o texto sobre naranja (`--key-ink`) | 4,8:1 | 6,1:1 |

**Reglas que se derivan:**
- `--faint` solo sobre `--panel`, nunca sobre `--panel-2`.
- Sobre `--key`, solo `--key-ink` (§3.3).
- Si se añade un color, se mide antes de usarlo.

### 13.2. Más allá del color

- Foco visible siempre: anillo de 2 px en `--key` con 2 px de separación.
- Navegación completa con teclado (Anexo H del plan).
- Ningún dato solo por color: los estados llevan texto y los tipos, nombre.
- Gráficas con `aria-label` y pie de texto.
- Dianas táctiles de 40 px en el móvil.
- Respeto a `prefers-reduced-motion` y al tamaño de letra del sistema (todo en `rem` en la implementación).

---

## 14. Implementación

### 14.1. Dónde vive

```
app/src/ui/
├── tema/
│   ├── tokens.css        ← variables CSS de los dos temas (Anexo de esta guía)
│   ├── tailwind.css      ← @theme que expone los tokens a Tailwind v4
│   └── fuentes.ts        ← importa @fontsource/archivo y @fontsource/roboto-mono
├── componentes/          ← Boton, Segmentado, Chip, Ref, Tarjeta, Mensaje, RespuestaRimor,
│                            Compositor, Veredicto, Detalles, Hueco, Tabla, Piloto…
└── graficas/             ← tema de Observable Plot y SVG propios
```

### 14.2. Temas

```css
:root { /* tokens claros (Anexo) */ }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* tokens oscuros */ color-scheme: dark; }
}
:root[data-theme="dark"] { /* tokens oscuros */ color-scheme: dark; }
```

### 14.3. Tailwind v4

```css
@import "tailwindcss";
@import "./tokens.css";

@theme inline {
  --color-app: var(--app);
  --color-panel: var(--panel);
  --color-panel-2: var(--panel-2);
  --color-ink: var(--ink);
  --color-muted: var(--muted);
  --color-faint: var(--faint);
  --color-line: var(--line);
  --color-key: var(--key);
  --color-ok: var(--ok);
  --color-warn: var(--warn);
  --color-bad: var(--bad);
  --font-sans: var(--f-b);
  --font-mono: var(--f-m);
  --radius-card: 14px;
  --radius-compositor: 20px;
  --shadow-card: var(--shadow);
}
```

Clases resultantes: `bg-panel`, `text-muted`, `rounded-card`, `shadow-card`, `font-mono`…

**Prohibido** en el código de componentes: colores literales (`#…`, `bg-orange-500`), sombras inventadas y radios fuera de la escala. Biome, con una regla de búsqueda en CI, rechaza hexadecimales fuera de `tokens.css`.

### 14.4. Componentes

- Una sola implementación por componente, con variantes por propiedades (`<Boton variante="primario">`).
- Cada componente tiene su historia en una página de muestras interna (`/muestras`, solo en desarrollo) con los dos temas lado a lado. Sustituye a Storybook: menos, pero mejor.
- Las pantallas de referencia («Pantallas de Rimor») son la especificación visual. Al implementar una pantalla, se compara con su captura en los dos temas.

---

## 15. Revisión de diseño

Lista para cada pull request que toque interfaz:

- [ ] ¿La pantalla responde a una pregunta que se pueda decir en una frase? (E1)
- [ ] ¿Lo secundario está plegado? ¿Hay como mucho tres bloques abiertos? (E2, §8.3)
- [ ] ¿Un solo veredicto y como mucho un elemento naranja más allá de los fijos? (E3, E4)
- [ ] ¿Las tarjetas se separan sin bordes? (E5)
- [ ] ¿Los tipos van en neutro y solo los estados llevan color? (E7)
- [ ] ¿Las cifras van en mono tabular y en formato español? (§4.3)
- [ ] ¿Rimor habla en una o dos frases, sin exclamaciones? (§9)
- [ ] ¿Está revisado en claro, en oscuro y a 400 px de ancho?
- [ ] ¿Se puede usar todo con teclado, con foco visible?
- [ ] ¿Ningún color, radio ni sombra está fuera de los tokens?

---

## 16. Anexo: tokens completos

Listo para `app/src/ui/tema/tokens.css`.

```css
:root {
  /* Superficies y texto */
  --page: #DCD9D2;  --app: #E8E6E1;  --panel: #F6F5F1;  --panel-2: #E3E0D9;
  --ink: #191919;   --muted: #67645E; --faint: #737068;
  --line: #CCC8BF;  --line-2: #DDD9D1;
  --apagado: #A8A49B;  /* decorativo: animaciones del símbolo */

  /* Activo neutro */
  --accent: #191919; --accent-ink: #F6F5F1; --accent-soft: #E3E0D9;

  /* Señal: el único naranja */
  --key: #EE4F1F; --key-ink: #191919; --key-text: #C9401A; --key-soft: #F8D9CD;

  /* Estados */
  --ok: #336E45;   --ok-soft: #DCEBDF;
  --warn: #8A570B; --warn-soft: #F3E6CF;
  --bad: #B32F27;  --bad-soft: #F5DAD6;

  /* Tipos (neutros; solo Error con color) */
  --k-x: #45433F; --k-x-bg: #E3E0D9;
  --k-err: #B32F27; --k-err-bg: #F5DAD6;
  --k-log: var(--k-x);  --k-log-bg: var(--k-x-bg);
  --k-med: var(--k-x);  --k-med-bg: var(--k-x-bg);
  --k-prm: var(--k-x);  --k-prm-bg: var(--k-x-bg);
  --k-md: var(--k-x);   --k-md-bg: var(--k-x-bg);
  --k-url: var(--k-x);  --k-url-bg: var(--k-x-bg);
  --k-idea: var(--k-x); --k-idea-bg: var(--k-x-bg);
  --k-dat: var(--k-x);  --k-dat-bg: var(--k-x-bg);
  --k-cod: var(--k-x);  --k-cod-bg: var(--k-x-bg);
  --k-cmp: var(--k-x);  --k-cmp-bg: var(--k-x-bg);
  --k-inv: var(--k-x);  --k-inv-bg: var(--k-x-bg);
  --k-doc: var(--k-x);  --k-doc-bg: var(--k-x-bg);

  /* Calor (calendario de actividad) */
  --heat-1: #EAD9CC; --heat-2: #F0B79E; --heat-3: #EE8A60; --heat-4: #EE4F1F;

  /* Detalles físicos y profundidad */
  --grille: rgba(25, 25, 25, .16);
  --shadow: 0 1px 2px rgba(0, 0, 0, .07);

  /* Forma */
  --r-xs: 5px; --r-sm: 8px; --r-md: 14px; --r-lg: 16px; --r-xl: 20px; --r-pill: 999px;

  /* Tipografía */
  --f-d: "Archivo", "Helvetica Neue", Arial, system-ui, sans-serif;
  --f-b: "Archivo", "Helvetica Neue", Arial, system-ui, sans-serif;
  --f-m: "Roboto Mono", ui-monospace, "Cascadia Code", Consolas, monospace;

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --page: #121211;  --app: #1A1A19;  --panel: #242422;  --panel-2: #2E2D2B;
    --ink: #EDEBE6;   --muted: #9D998F; --faint: #8F8B83;
    --line: #3A3936;  --line-2: #2F2E2B;
    --apagado: #5E5B55;
    --accent: #EDEBE6; --accent-ink: #1A1A19; --accent-soft: #34332F;
    --key: #FF6A3D; --key-ink: #1A1A19; --key-text: #FF7E55; --key-soft: #40291F;
    --ok: #7DC48F;   --ok-soft: #1F3125;
    --warn: #E2A84C; --warn-soft: #3A2D16;
    --bad: #FF7A6B;  --bad-soft: #3F201D;
    --k-x: #CFCBC2; --k-x-bg: #2E2D2B; --k-err: #FF7A6B; --k-err-bg: #3F201D;
    --heat-1: #3A2A22; --heat-2: #6A3A26; --heat-3: #B5502E; --heat-4: #FF6A3D;
    --grille: rgba(255, 255, 255, .10);
    --shadow: none;
    color-scheme: dark;
  }
}

:root[data-theme="dark"] {
  /* Mismos valores que el bloque anterior, para que el selector de Ajustes mande. */
  --page: #121211;  --app: #1A1A19;  --panel: #242422;  --panel-2: #2E2D2B;
  --ink: #EDEBE6;   --muted: #9D998F; --faint: #8F8B83;
  --line: #3A3936;  --line-2: #2F2E2B;
  --apagado: #5E5B55;
  --accent: #EDEBE6; --accent-ink: #1A1A19; --accent-soft: #34332F;
  --key: #FF6A3D; --key-ink: #1A1A19; --key-text: #FF7E55; --key-soft: #40291F;
  --ok: #7DC48F;   --ok-soft: #1F3125;
  --warn: #E2A84C; --warn-soft: #3A2D16;
  --bad: #FF7A6B;  --bad-soft: #3F201D;
  --k-x: #CFCBC2; --k-x-bg: #2E2D2B; --k-err: #FF7A6B; --k-err-bg: #3F201D;
  --heat-1: #3A2A22; --heat-2: #6A3A26; --heat-3: #B5502E; --heat-4: #FF6A3D;
  --grille: rgba(255, 255, 255, .10);
  --shadow: none;
  color-scheme: dark;
}
```
