# Rimor: plan de implementación

> **Plan de implementación.** Versión 2.1 · 18 de octubre de 2026. La v2 añadió el símbolo «Señal», los iconos de app y las animaciones (IN-089 e IN-090); la v2.1 los ajusta al paquete corregido, que ya trae las animaciones reales.
> Se deriva de `rimor-plan.md` (v2), que dice **qué** es Rimor y **por qué**, y de `rimor-diseno.md`, que dice **cómo se ve**. Este documento dice **qué se construye, en qué orden, con qué dependencias y cuándo está terminado**.
> **Referencia visual:** el artefacto «Pantallas de Rimor» (v3).
> **Marca:** los paquetes `rimor-icono` (símbolo «Señal», iconos de app, favicon y logotipo) y `rimor-animaciones` (20 animaciones del símbolo, en claro y oscuro).
> **Si hay conflicto:** sobre el producto, manda `rimor-plan.md`; sobre el aspecto, `rimor-diseno.md`; sobre el orden y el «terminado», este documento.

---

## Índice

1. Cómo usar este plan
2. Antes de empezar
3. Incoherencias del plan v2 resueltas aquí
4. Visión de conjunto: hitos, olas y camino crítico
5. Tabla maestra de funcionalidades
6. Convenciones y «terminado» común
7. Fase 0: pruebas técnicas
8. v0.1 «La puerta y los lectores»: fichas
9. v0.2 «Ver y agrupar»: fichas
10. v0.3 «Investigar y escribir»: fichas
11. v0.4 «Publicar»: fichas
12. Después
13. Cobertura del catálogo
14. Estrategia de pruebas
15. Riesgos de ejecución

---

## 1. Cómo usar este plan

### 1.1. Unidades de trabajo

- **IN-NNN** es una funcionalidad de implementación: la unidad del ciclo SDD (§20 del plan). Agrupa uno o varios IDs del catálogo (`CAP-03`, `LEC-04`…).
- Cada IN pasa por: **exploración → diseño → aprobación humana (GATE#1) → implementación con pruebas → revisión**. El diseño de cada IN parte de su ficha y la completa; no la contradice sin pasar por un cambio de este documento.
- Las IN de una misma **ola** se pueden hacer en paralelo, cada una en su worktree. Una ola empieza cuando las IN de las que depende están fusionadas.
- Los agentes nunca hacen commit, push ni cambian de rama. Eso lo hace el autor.

### 1.2. Tamaños

Relativos, no de calendario (el tiempo del autor está compartido con Struo):

| Tamaño | Significado |
|---|---|
| **S** | Un ciclo SDD corto. Un módulo pequeño, sin decisiones abiertas. |
| **M** | Un ciclo normal. Varios archivos, alguna decisión de diseño local. |
| **L** | Un ciclo largo o dos. Dependencias externas pesadas o mucha interfaz. |

### 1.3. Formato de las fichas

Cada IN tiene una ficha con: **objetivo**, **catálogo** (IDs que cubre), **depende de**, **ola**, **tamaño**, **dónde vive** (módulos), **tareas**, **pruebas** y **aceptación**. Las fichas de v0.1 están al máximo detalle. Las de v0.2 a v0.4 están completas pero más compactas: se refinan en su exploración, cuando la versión anterior haya enseñado lo que hace falta.

---

## 2. Antes de empezar

### 2.1. Decisiones que hay que cerrar

| # | Decisión | Propuesta | Bloquea |
|---|---|---|---|
| D5 | Licencia | La misma que Struo | IN-001 |
| D6 | Router | TanStack Router (rutas tipadas) | IN-008 |
| D13 | ¿Un elemento en varios hilos? | No: un hilo por elemento | IN-030 |
| D14 | ¿Desactivar respuestas por tipo? | Sí, desde Ajustes | IN-016, IN-038 |
| D15 *(nueva)* | Gestor de paquetes y monorepo | pnpm con workspaces | IN-001 |
| D16 *(nueva)* | Resaltado de sintaxis en vistas de solo lectura | Lezer (los mismos analizadores de CodeMirror), sin Shiki, para no duplicar gramáticas | IN-025 |
| D17 *(nueva)* | Lista virtual para el feed | `@tanstack/react-virtual` | IN-026 |
| D18 *(nueva)* | Técnica de las animaciones del símbolo | Los SVG del paquete (SMIL) son la **especificación exacta**: tiempos (`keyTimes`), valores y curvas (`keySplines`). Se portan uno a uno a animaciones CSS (`@keyframes` sobre `stroke-dashoffset`, `opacity`, `transform`, `r` y `offset-path`) en un SVG en línea dentro de un componente React. Así heredan los tokens de los dos temas (los SVG llevan los colores fijos, un archivo por tema, y SMIL no admite variables CSS en `values`), respetan `prefers-reduced-motion` desde CSS y se controlan por propiedades (una vez o en bucle) | IN-090 |
| D19 *(resuelta)* | Movimiento exacto de las animaciones | El paquete corregido trae las animaciones; la ficha de IN-090 describe el movimiento real de cada una | — |

### 2.2. Qué sale de la Fase 0

La Fase 0 (§7) no produce código de producto. Produce **un informe por prueba** en `docs/f0/` y **cuatro decisiones** que condicionan fichas posteriores:

| Resultado de F0 | Afecta a |
|---|---|
| F0-1: OPFS y `persist()` por navegador | IN-005, IN-007, IN-037 |
| F0-4: Typst a PDF viable o no | IN-085 (sí o se descarta) |
| F0-7: qué APIs admiten peticiones desde el navegador | IN-041 (alcance real) |
| F0-3 y F0-5: peso y tiempos de pandoc-wasm y DuckDB | IN-044, IN-084 (estrategia de carga) |

---

## 3. Incoherencias del plan v2 resueltas aquí

Al bajar el plan a tareas aparecen dependencias que la v2 no recoge. Se resuelven así:

| # | Incoherencia | Resolución |
|---|---|---|
| 1 | La respuesta de una idea promete «volverá dentro de 7 días», pero el resurgimiento (ORG-13) es de v0.3. | **Resurgimiento mínimo en v0.1** dentro de IN-018: solo ideas, a 7 y 30 días, en el feed. ORG-13 completo (investigaciones, espaciado) sigue en v0.3 (IN-068). |
| 2 | «Convertir en investigación» aparece en Inicio y en los hilos, pero la investigación es de v0.3. | En v0.1 y v0.2 ese botón **no se muestra**. Lo activa IN-070. |
| 3 | El raíl de las pantallas muestra Métricas, que es de v0.2. | En v0.1 el raíl muestra Inicio, Buscar, Colecciones y Datos. Métricas entra con IN-059. |
| 4 | Las respuestas de datos y JSON del prototipo («cambian 2 claves») usan lectores de v0.2. | En v0.1 esos contenidos caen en Código o Texto, con su respuesta genérica. Las plantillas llegan con sus lectores. |
| 5 | La tarjeta de «sesión de ayer» en Inicio depende de las sesiones (ORG-08, v0.2). | Entra con IN-051 e IN-055. |
| 6 | Soltar archivos (CAP-02) es de v0.1, pero CSV, imagen y PDF tienen lector en v0.2 y v0.3. | IN-017 incluye un **lector genérico de archivo**: guarda el adjunto, muestra nombre, tamaño y tipo, y lo reprocesa cuando llegue su lector. |
| 7 | MET-06 («lo que te ha ahorrado Rimor») cuenta cosas desde el principio, pero llega en v0.2. | **Contadores locales desde v0.1** (IN-016): errores reconocidos, duplicados evitados, copias con valores, búsquedas con resultado. Así, en v0.2 ya hay historia. |
| 8 | BUS-06 está en v0.2 y en v0.4. | Se parte en IN-056 (por huella y etiquetas) e IN-081 (por significado). |
| 9 | La puerta de v0.1 mide cuántas respuestas se corrigen o descartan, pero nada lo registra. | IN-016 registra en local cada corrección de tipo y cada «No» o descarte de una respuesta. |
| 10 | `rimor-plan.md` (§17.2) y `rimor-diseno.md` (§6.2) describen el símbolo antiguo (una grieta en un cuadrado). El paquete `rimor-icono` trae el definitivo: **«Señal»**, una onda en tinta, un punto naranja y un guion. | Manda el paquete. Los dos documentos quedan actualizados en esta misma revisión. IN-089 lo implementa. |

**Hallazgos al revisar los paquetes de marca** (se resuelven en IN-089 e IN-090):

| # | Hallazgo | Resolución |
|---|---|---|
| M1 | *(Resuelto en el paquete corregido.)* La primera entrega de `rimor-animaciones` llegó sin las etiquetas SMIL. La corregida las trae en los 40 SVG (20 animaciones × 2 temas). | Los SVG son la especificación de IN-090 (D18). |
| M2 | *(Resuelto en el paquete corregido.)* El primer `favicon.svg` había perdido su `<style>`. El corregido lo trae, con `prefers-color-scheme`. | IN-089 lo usa tal cual. |
| M3 | Los SVG de `rimor-icono` siguen llevando unos 8 KB de metadatos de procedencia cada uno, para menos de 0,8 KB de dibujo. Los de animaciones y el favicon ya vienen limpios. | IN-089 optimiza con SVGO los iconos que se publican y guarda los originales en `docs/marca/originales/`. |
| M5 | Dos animaciones (14 «Copia al día» y 17 «Comparando») usan un gris que no está en la paleta: `#A8A49B` en claro y `#5E5B55` en oscuro (el punto «apagado» y la serie de referencia). | Nuevo token `--apagado` en `rimor-diseno.md` (§3.1 y anexo). Es decorativo: nunca se usa para texto. |
| M4 | El logotipo usa texto en Archivo 700; el LEEME pide pasarlo a contornos en producción. | Dentro de la app, texto vivo (la fuente va empaquetada). Para usos fuera de la app (README, redes, documentos exportados), un SVG con el texto en contornos, generado por script. |

---

## 4. Visión de conjunto: hitos, olas y camino crítico

### 4.1. Hitos

```
F0 ─▶ v0.1 ───────────────────────────▶ v0.2 ─────────▶ v0.3 ─────────▶ v0.4
      olas 0 a 7                         olas 8 a 10     olas 11 a 13    olas 14 a 15
      puerta: 4 semanas de uso real      puerta: 2       puerta: informe puerta: minipaper
                                         preguntas       < 30 min        exportado
```

### 4.2. Olas de v0.1

| Ola | Contenido | IN |
|---|---|---|
| 0 | Repositorio, y en paralelo: tema, textos, formato de archivos y marca | 001 → 002, 003, 004, 089 |
| 1 | Almacén, caché, carcasa, seguridad, secretos, estadística y animaciones | 005, 006, 008, 009, 010, 011, 090 |
| 2 | Espacio de trabajo, contrato de lectores y arnés del detector | 007, 012, 013 |
| 3 | Núcleo de captura y lector de referencia | 014, 015, 016, 017 |
| 4 | Lectores (en paralelo) | 018 a 025 |
| 5 | Inicio, elemento, comparaciones, versiones, hilos, colecciones y búsqueda | 026 a 032 |
| 6 | Paleta, listas, exportar, importar, copias, ajustes y primer uso | 033 a 039 |
| 7 | Cierre: rendimiento, accesibilidad, pruebas de extremo a extremo y puerta | 040 |

### 4.3. Camino crítico

```
IN-001 ─▶ IN-004 ─▶ IN-005 ─▶ IN-012 ─▶ IN-014 ─▶ IN-026 ─▶ IN-040
 repo      formato   almacén   contrato  captura   Inicio    cierre
                        │                    ▲
                        └─▶ IN-006 ──────────┘ (caché e índice)
```

Todo lo demás cuelga de este eje. Si una IN del camino crítico se retrasa, se retrasa la versión; si se retrasa un lector, solo se retrasa ese lector.

---

## 5. Tabla maestra de funcionalidades

### 5.1. v0.1 «La puerta y los lectores»

IN-089 e IN-090 se añadieron en la versión 2 de este plan. Llevan números al final para no renumerar el resto; su orden lo marca la ola, no el número.

| IN | Funcionalidad | Catálogo | Depende de | Ola | Tam. |
|---|---|---|---|---|---|
| 001 | Repositorio, herramientas e integración continua | — | — | 0 | S |
| 002 | Tema Instrumento y componentes base | APP-02 | 001 | 0 | M |
| 089 | Símbolo «Señal», iconos de app y favicon | Marca (`rimor-diseno.md` §6.2) | 001 | 0 | S |
| 003 | Textos, idiomas y formatos | APP-07 | 001 | 0 | S |
| 004 | Formato de archivos (`paquetes/formato`) | DAT-01 (formato) | 001 | 0 | M |
| 005 | Almacén OPFS y en memoria | DAT-01 | 004 | 1 | L |
| 006 | Caché de derivados e índice | DAT-02 | 004 | 1 | M |
| 007 | Espacio de trabajo y persistencia | DAT-06 | 005, 090 | 2 | S |
| 008 | Carcasa, navegación, atajos y diseño adaptable | APP-01, APP-05 | 002, 003 | 1 | M |
| 009 | Saneado y política de seguridad de contenido | SEG-01, SEG-02 | 001 | 1 | S |
| 010 | Ocultación de secretos | CAP-05 | 001 | 1 | M |
| 011 | Paquete de estadística | (LEC-06, CMP-01) | 001 | 1 | M |
| 090 | Animaciones del símbolo (núcleo) | Movimiento (`rimor-diseno.md` §11) | 002, 089 | 1 | M |
| 012 | Contrato y registro de lectores | VIS-01 | 004, 006 | 2 | M |
| 013 | Detector de tipo y corpus | CAP-04 | 012 | 2 | M |
| 014 | Flujo de captura | CAP-01, CAP-02, ORG-05 | 005, 010, 012 | 3 | M |
| 015 | Compositor | CAP-03, CAP-13 | 008, 014 | 3 | M |
| 016 | Respuestas de Rimor y contadores locales | CAP-14 | 012, 003 | 3 | M |
| 017 | Lector Texto y lector genérico de archivo | LEC-01 | 012, 016 | 3 | S |
| 018 | Lector Idea y resurgimiento mínimo | LEC-02, ORG-13 (parcial) | 017 | 4 | S |
| 019 | Lector Enlace básico | LEC-03 | 017 | 4 | S |
| 020 | Lector Log | LEC-04 | 017 | 4 | M |
| 021 | Lector Error y huella | LEC-05, ORG-06 | 017 | 4 | M |
| 022 | Lector Mediciones | LEC-06 | 011, 017 | 4 | M |
| 023 | Lector Prompt | LEC-07 | 017 | 4 | M |
| 024 | Lector Documento Markdown | LEC-08 | 017 | 4 | M |
| 025 | Lector Código | LEC-09 | 017 | 4 | S |
| 026 | Inicio: feed y triaje | ORG-01 | 015, 016, 017 | 5 | M |
| 027 | Vista de elemento, estados, fijar y papelera | VIS-01, ORG-04, ORG-07 | 012, 008 | 5 | M |
| 028 | Comparaciones de logs y mediciones | CMP-01 | 020, 022 | 5 | M |
| 029 | Versiones e historial | CMP-02, DAT-08 | 005, 023, 024 | 5 | M |
| 030 | Hilos | ORG-15, ORG-06 | 021, 026 | 5 | M |
| 031 | Colecciones y etiquetas | ORG-02, ORG-03 | 014, 008 | 5 | S |
| 032 | Búsqueda | BUS-01, BUS-02 | 006, 012 | 5 | M |
| 033 | Paleta de comandos | BUS-03 | 032 | 6 | S |
| 034 | Mosaico y lista densa | VIS-02, VIS-03 | 027 | 6 | S |
| 035 | Exportar ZIP y JSON | DAT-03, DAT-05 | 005 | 6 | M |
| 036 | Importar ZIP y JSON | DAT-04, SEG-04 | 035, 029 | 6 | M |
| 037 | Datos y copias | DAT-06, DAT-07 | 007, 035 | 6 | S |
| 038 | Ajustes | APP-04 | 010, 016 | 6 | S |
| 039 | Primer uso y espacio de ejemplo | APP-03 | 026, 036 | 6 | S |
| 040 | Cierre de v0.1 | (puerta) | todas | 7 | M |

### 5.2. v0.2 «Ver y agrupar»

| IN | Funcionalidad | Catálogo | Depende de | Ola | Tam. |
|---|---|---|---|---|---|
| 041 | Enlace enriquecido | LEC-03b | 019, F0-7 | 8 | M |
| 042 | Diff y parche | LEC-09b | 025 | 8 | S |
| 043 | Comando con huecos | LEC-10 | 023 | 8 | S |
| 044 | Datos tabulares con DuckDB | LEC-11 | 012, F0-5 | 8 | L |
| 045 | JSON, YAML y TOML con comparación estructural | LEC-12, CMP-03 | 028 | 8 | M |
| 046 | Petición HTTP | LEC-13 | 010 | 8 | S |
| 047 | Mediciones: más formatos y Hodges-Lehmann | LEC-06 (v0.2) | 022 | 8 | S |
| 048 | Logs: plantillas con Drain | LEC-04 (v0.2) | 020 | 8 | M |
| 049 | Reglas aprendidas y captura múltiple | CAP-06, CAP-07 | 013, 014 | 9 | M |
| 050 | PWA, sin conexión y compartir | CAP-08, APP-06 | 014 | 9 | M |
| 051 | Sesiones automáticas | ORG-08 | 026 | 9 | S |
| 052 | Grupos automáticos y pantalla de colección | ORG-09, VIS-04 | 031, 051 | 9 | M |
| 053 | Enlaces automáticos | ORG-10 | 012 | 9 | M |
| 054 | Vistas guardadas | ORG-11 | 032 | 9 | S |
| 055 | Inicio con memoria | ORG-12 | 051, 018 | 9 | S |
| 056 | Búsqueda: facetas, contenido derivado y parecidos | BUS-04, BUS-05, BUS-06 (huella y etiquetas) | 032 | 9 | M |
| 057 | Línea de tiempo y calendario | VIS-05, VIS-06 | 051 | 10 | M |
| 058 | Gráficos de datos | VIS-07 | 044 | 10 | M |
| 059 | Métricas I | MET-01, MET-02, MET-04, MET-06 | 016, 030, 058 | 10 | M |
| 060 | Varios espacios y exportación parcial | DAT-09, DAT-10 | 035, 036 | 10 | S |
| 061 | Modo sin red | SEG-03 | 041 | 10 | S |
| 062 | Cierre de v0.2 | (puerta) | todas | 10 | S |

### 5.3. v0.3 «Investigar y escribir»

| IN | Funcionalidad | Catálogo | Depende de | Ola | Tam. |
|---|---|---|---|---|---|
| 063 | Sobre de terminal (CLI) | CAP-09 | 004, 014 | 11 | M |
| 064 | Imagen y OCR | CAP-10, LEC-14 | 017 | 11 | M |
| 065 | PDF | LEC-15 | 017 | 11 | M |
| 066 | Fórmula y diagrama | LEC-16, LEC-17 | 009 | 11 | S |
| 067 | Comparar varias series | CMP-04 | 028, 047 | 11 | S |
| 068 | Resurgimiento completo | ORG-13 | 018, 070 | 12 | S |
| 069 | Tablero por estado y vecinos | VIS-08, VIS-09 | 053 | 12 | S |
| 070 | Investigación | INV-01 a INV-05, INV-08 | 027, 031 | 11 | L |
| 071 | Decisión y sensibilidad | INV-06, VIS-11 | 070 | 12 | M |
| 072 | Qué falta | INV-07 | 070, 071 | 12 | M |
| 073 | Lienzo | VIS-10 | 070 | 12 | L |
| 074 | Editor y resolvedor de documentos | DOC-01, DOC-02, DOC-03 | 012, 066 | 12 | L |
| 075 | Plantillas y documento desde investigación | DOC-04, DOC-05 | 074, 070 | 13 | S |
| 076 | Exportación Markdown, HTML y PDF por impresión | DOC-06, DOC-07 | 074 | 13 | M |
| 077 | Métricas II | MET-03, MET-05, MET-07 | 059, 074 | 13 | S |
| 078 | Importar Obsidian y Markdown suelto | DAT-11 | 036 | 13 | M |
| 079 | Cierre de v0.3 | (puerta) | todas | 13 | S |

### 5.4. v0.4 «Publicar»

| IN | Funcionalidad | Catálogo | Depende de | Ola | Tam. |
|---|---|---|---|---|---|
| 080 | Cálculo con unidades | LEC-18 | 017 | 14 | M |
| 081 | Búsqueda por significado | ORG-14, BUS-06 (significado) | 056 | 14 | L |
| 082 | Mapa afirmación × evidencia | VIS-12 | 070 | 14 | M |
| 083 | Minipaper y numeración | DOC-08, DOC-13 | 075 | 14 | M |
| 084 | Word y LaTeX con Pandoc | DOC-09 | 076, F0-3 | 15 | M |
| 085 | PDF con Typst | DOC-10 | 084, F0-4 | 15 | M |
| 086 | Bibliografía y verificador | DOC-11, DOC-12 | 041, 084 | 15 | M |
| 087 | Qué falta del documento y anexo reproducible | DOC-14, DOC-15 | 072, 076 | 15 | S |
| 088 | Cierre de v0.4 | (puerta) | todas | 15 | S |

---

## 6. Convenciones y «terminado» común

### 6.1. Estructura del repositorio

Amplía la del plan (§14.3) con lo decidido en la v2:

```
rimor/
├── app/src/
│   ├── rutas/                  ← una carpeta por pantalla (inicio, elemento, hilo, buscar, coleccion, datos, ajustes…)
│   ├── ui/
│   │   ├── tema/               ← tokens.css, tailwind.css, fuentes.ts (rimor-diseno.md §14)
│   │   ├── componentes/        ← Boton, Segmentado, Chip, Ref, Tarjeta, Mensaje, RespuestaRimor, Compositor…
│   │   ├── graficas/           ← tema de Observable Plot y SVG propios
│   │   ├── marca/              ← geometría del símbolo, SimboloRimor, Logotipo, Senal (animaciones) y senal.css
│   │   └── muestras/           ← página /muestras (solo en desarrollo)
│   ├── estado/                 ← stores de Zustand
│   ├── dominio/                ← TS puro: elementos, hilos, comparaciones, investigación, qué falta, sensibilidad
│   ├── captura/                ← flujo de captura, indicaciones del compositor
│   ├── respuestas/             ← motor de respuestas de Rimor, contadores locales
│   ├── lectores/<tipo>/        ← detectar.ts · leer.ts · derivar.ts · respuesta.ts · Vista.tsx · Tarjeta.tsx · fixtures/
│   ├── almacen/                ← opfs/, memoria.ts, zip.ts, json.ts, cache/
│   ├── busqueda/
│   ├── documentos/             ← editor, resolvedor, exportadores (v0.3)
│   ├── seguridad/              ← secretos/, sanear.ts, importacion-segura.ts
│   ├── i18n/                   ← es.json, en.json, formatos.ts
│   └── workers/                ← derivados.worker.ts, almacen.worker.ts, busqueda.worker.ts, zip.worker.ts
├── paquetes/
│   ├── estadistica/
│   └── formato/
├── cli/                        ← v0.3
├── app/public/marca/           ← favicon.svg, PNG de app y maskable, manifest de iconos (optimizados)
├── fixtures/                   ← corpus compartido del detector
└── docs/                       ← plan, diseño, implementación, ADR, f0/, olas/, marca/ (LEEME y originales)
```

### 6.2. Reglas de código

- TypeScript estricto (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Sin `any` fuera de los adaptadores de librerías.
- **`dominio/`, `paquetes/` y los `detectar`, `leer`, `derivar` y `respuesta` de cada lector son TS puro:** sin React, sin DOM y sin almacenamiento. Se prueban sin navegador.
- Todo lo que pueda tardar más de 50 ms va en un Worker (Comlink).
- Textos de interfaz solo por clave de i18n (`es` y `en`). Ningún literal visible en componentes.
- Colores, radios y sombras solo por token (`rimor-diseno.md` §14.3). La integración continua rechaza hexadecimales fuera de `tokens.css`.
- Errores: el dominio devuelve `Resultado<T, ErrorRimor>` (código, mensaje con clave de i18n y datos); nunca lanza por casos esperados.
- Decisiones de arquitectura en `docs/adr/` (formato MADR).

### 6.3. «Terminado» común a toda IN

Además de su aceptación propia, una IN está terminada cuando:

- [ ] Sus pruebas pasan en la integración continua, incluidas las de extremo a extremo que la toquen, en Chromium, Firefox y WebKit.
- [ ] El dominio tiene pruebas unitarias; las funciones con invariantes, pruebas de propiedades (fast-check).
- [ ] Funciona con teclado, sin violaciones graves de axe, en claro, en oscuro y a 400 px de ancho.
- [ ] Respeta la lista de revisión de diseño (`rimor-diseno.md` §15).
- [ ] No rompe los presupuestos de rendimiento (§14.7 del plan) ni el tamaño de la carga inicial (< 300 KB comprimidos).
- [ ] Textos en español e inglés.
- [ ] El PR cita los IDs del catálogo que cubre y actualiza `docs/olas/` con el estado.

---

## 7. Fase 0: pruebas técnicas

Cada prueba es un proyecto mínimo en `f0/<prueba>/` que se tira al acabar; lo que queda es el informe `docs/f0/F0-N.md` con datos, conclusión y decisión.

| # | Prueba | Cómo | Criterio de éxito | Decide |
|---|---|---|---|---|
| F0-1 | OPFS a escala | Escribir y leer 5.000 `.md` de 2 a 20 KB desde un Worker con `createSyncAccessHandle`; medir en Chrome, Firefox y Safari; llamar a `persist()` con y sin PWA instalada | Lectura completa < 2 s; persistencia concedida al menos en Chrome con PWA | Diseño del adaptador (IN-005) y textos de persistencia (IN-007) |
| F0-2 | ZIP de ida y vuelta | 200 MB (5.000 archivos + 30 adjuntos grandes) con fflate en streaming en un Worker; comparar hashes | Idéntico byte a byte; la interfaz no se bloquea (sin tareas largas > 50 ms) | Estrategia de IN-035 e IN-036 |
| F0-3 | pandoc-wasm | Markdown con tablas, figuras y citas → Word, LaTeX y Typst | Tres salidas correctas; peso y tiempo de carga medidos | Carga diferida y caché de IN-084 |
| F0-4 | typst.ts a PDF | Compilar un minipaper con fuentes empaquetadas, sin red | PDF correcto sin conexión | Si falla, IN-085 se descarta y el PDF queda por impresión y LaTeX |
| F0-5 | DuckDB-WASM | Perfil de un CSV de 100 MB (tipos, nulos, histogramas) | < 5 s en un portátil normal | Límites de IN-044 |
| F0-6 | Logs grandes | Normalizar y agrupar 50.000 líneas en un Worker | < 2 s | Límites y bloques de IN-020 |
| F0-7 | CORS de APIs | GitHub, Crossref, arXiv, npm, crates.io, PyPI, deps.dev, OSV, desde una página estática | Tabla de qué funciona; para lo que no, alternativa | Alcance de IN-041 |
| F0-8 | MiniSearch | Indexar 10.000 elementos realistas; serializar en IndexedDB | Índice < 20 MB; búsqueda < 50 ms por pulsación | Campos y estrategia de IN-032 |
| F0-9 *(nueva)* | Fuentes empaquetadas | Archivo y Roboto Mono con `@fontsource`, subconjuntos latin y latin-ext, en una página con CSP estricta | Sin peticiones externas; tamaño total < 250 KB | IN-002 |

**Salida de la Fase 0:** los nueve informes y una actualización de este documento si alguna ficha cambia.

---

## 8. v0.1 «La puerta y los lectores»: fichas

**Objetivo de la versión:** usar Rimor a diario para capturar, encontrar y comparar.

---

### IN-001 · Repositorio, herramientas e integración continua

- **Objetivo:** un esqueleto que compila, prueba y despliega, para que el resto de IN solo añadan código de producto.
- **Depende de:** D5, D15. · **Ola:** 0 · **Tamaño:** S
- **Tareas:**
  - [ ] Monorepo con pnpm workspaces: `app`, `paquetes/estadistica`, `paquetes/formato`.
  - [ ] Vite + React 19 + TypeScript estricto (opciones de §6.2).
  - [ ] Biome con las reglas de Struo, más una regla de búsqueda que rechace hexadecimales fuera de `tokens.css`.
  - [ ] Vitest (unidades y fast-check) y Playwright (Chromium, Firefox, WebKit).
  - [ ] Integración continua (GitHub Actions): tipos, lint, unidades, extremo a extremo, tamaño de la carga inicial (aviso por encima de 300 KB comprimidos).
  - [ ] Despliegue estático de vista previa por rama (Cloudflare Pages o GitHub Pages).
  - [ ] `docs/` con plan, diseño, este documento, `adr/`, `f0/` y `olas/`.
  - [ ] Licencia, README mínimo y `CONTRIBUTING` con el método SDD.
- **Pruebas:** la integración continua corre en verde con una prueba de humo («la app arranca y muestra el raíl»).
- **Aceptación:** un PR vacío pasa todos los pasos; uno con un hexadecimal en un componente falla.

---

### IN-002 · Tema Instrumento y componentes base

- **Objetivo:** que ninguna pantalla tenga que inventar estilos.
- **Catálogo:** APP-02. · **Depende de:** IN-001, F0-9. · **Ola:** 0 · **Tamaño:** M
- **Dónde vive:** `ui/tema/`, `ui/componentes/`, `ui/muestras/`.
- **Tareas:**
  - [ ] `tokens.css` copiado del anexo de `rimor-diseno.md` (claro, oscuro por `prefers-color-scheme` y por `data-theme`).
  - [ ] `tailwind.css` con `@theme inline` (§14.3 de la guía).
  - [ ] `fuentes.ts`: Archivo (400–800) y Roboto Mono (400, 500), latin y latin-ext.
  - [ ] Iconos: `lucide-react` con `strokeWidth={1.8}`; componente `IconoTipo` con el mapa tipo → icono (§6.1 de la guía). El símbolo y el logotipo los aporta IN-089.
  - [ ] Componentes:
    - `Boton` con variantes primario, secundario, fantasma, señal e icono;
    - `Segmentado`, `Filtro` (píldora), `ChipTipo`, `Estado`, `Ref`, `Piloto`;
    - `Tarjeta`, `Detalles` (plegable con recuento), `Banner`, `Hueco`;
    - `Tabla`, `BarraH` (barra horizontal con valor), `Medidor`;
    - `Vacio`, `Cargando`, `ErrorTarjeta`, `Aviso` (efímero);
    - `Rejilla` (altavoz) y `Veredicto` (cifra y frase).
  - [ ] Selector de tema: sistema, claro u oscuro, guardado en ajustes locales.
  - [ ] Página `/muestras` con cada componente en los dos temas lado a lado (IN-089 e IN-090 añaden ahí el símbolo y las animaciones).
- **Pruebas:** captura visual de `/muestras` en claro y oscuro con Playwright (comparación de imagen con tolerancia); axe sin violaciones.
- **Aceptación:** `/muestras` coincide con la pantalla «Sistema de diseño» del artefacto; el contraste de cada par de §13.1 de la guía se comprueba en una prueba automática.

---

### IN-003 · Textos, idiomas y formatos

- **Objetivo:** español primero e inglés preparado, y números y fechas siempre bien formateados.
- **Catálogo:** APP-07. · **Depende de:** IN-001. · **Ola:** 0 · **Tamaño:** S
- **Dónde vive:** `i18n/`.
- **Tareas:**
  - [ ] Librería mínima propia o `@lingui/core` (decidir en el diseño de la IN), con claves tipadas.
  - [ ] `formatos.ts`:
    - números con `Intl.NumberFormat`;
    - signo menos U+2212 y espacio de no separación antes de `%` y de las unidades;
    - p-valores (`p < 0,001`, tres decimales);
    - duraciones (`ms`, `s`, «1,6 días»);
    - fechas relativas («hoy, 17:49», «ayer», «2 oct»).
  - [ ] Pluralización y ordinales («3.ª vez»).
  - [ ] Cambio de idioma en caliente.
- **Pruebas:** unidades de cada formateador en `es` y `en`, con casos límite (0, negativos, NaN, fechas en otra zona horaria).
- **Aceptación:** ningún literal visible en componentes (regla de lint); `fmtCifra(-4.515, 1, '%')` da `−4,5 %` con espacio de no separación.

---

### IN-004 · Formato de archivos (`paquetes/formato`)

- **Objetivo:** que todo lo que se guarda tenga un esquema, se lea y se escriba sin perder nada, y se pueda migrar.
- **Catálogo:** DAT-01 (formato), §13.3, §13.4, §13.8 y Anexos A y B del plan. · **Depende de:** IN-001. · **Ola:** 0 · **Tamaño:** M
- **Dónde vive:** `paquetes/formato/` (sin dependencias de navegador; lo reutilizará la CLI).
- **Modelo a implementar** (esquemas Valibot y tipos derivados):

```ts
type Ref = `${Prefijo}-${string}`;                      // LOG-0042, DOC-MD-0004, HIL-0007
interface FrontmatterComun {
  id: Ulid; ref: Ref; tipo: TipoElemento; titulo: string;
  creado: IsoFecha; modificado: IsoFecha;
  origen: 'pegado' | 'soltado' | 'compartido' | 'terminal' | 'importado';
  estado?: string; colecciones?: string[]; investigaciones?: Ref[]; etiquetas?: string[];
  sesion?: string; hilo?: Ref; hash: `sha256:${string}`; ocultados: number;
  lector: { nombre: string; version: number; resumen: Record<string, unknown> };
  fijado?: boolean; alias?: Ref[];
}
// Más: Elemento (frontmatter + cuerpo + original), Comparacion, Investigacion, Documento,
// Hilo, Manifest, Colecciones, Vistas, Ajustes.
```

- **Tareas:**
  - [ ] Esquemas Valibot de todo lo anterior, con versión de esquema 1.
  - [ ] Lectura y escritura de frontmatter con `yaml` conservando el orden de claves y los comentarios; el cuerpo, intacto.
  - [ ] `ulid()` monotónico; `asignarRef(tipo, existentes)`; tabla de prefijos (incluye `HIL`).
  - [ ] Nombre de archivo `REF--titulo-en-minusculas.md` (normaliza tildes, corta a 60 caracteres) y ruta por fecha `elementos/AAAA/MM/`.
  - [ ] Original dentro del `.md` en un bloque de código con el lenguaje del tipo; si pasa de 2 MB (D8), adjunto por hash en `adjuntos/xx/hash.ext`.
  - [ ] Hash SHA-256 del original normalizado (fin de línea `\n`, sin espacios finales) para duplicados.
  - [ ] Marco de migraciones: `migrar(espacio, desde, hasta)` con funciones puras `N → N+1` (la primera es la identidad).
- **Pruebas:**
  - propiedades: `leer(escribir(x)) ≡ x` para elementos generados con fast-check;
  - los ejemplos del Anexo B del plan validan;
  - frontmatter con claves desconocidas se conserva (compatibilidad hacia delante);
  - nombres de archivo con tildes, emojis y títulos vacíos.
- **Aceptación:** el paquete se usa desde Node (pruebas) y desde el navegador sin cambios; cero dependencias de DOM.

---

### IN-089 · Símbolo «Señal», iconos de app y favicon

- **Objetivo:** que la marca entre en la app una sola vez, limpia, en los dos temas y en todos los tamaños.
- **Catálogo:** marca (`rimor-diseno.md` §6.2). · **Depende de:** IN-001. · **Ola:** 0 · **Tamaño:** S
- **Dónde vive:** `ui/marca/`, `app/public/marca/`, `docs/marca/`.
- **El símbolo** (del LEEME de `rimor-icono`):
  - retícula de 48 × 48 con trazo de 3 (3,6 en el favicon), extremos y uniones redondeados;
  - onda `M7 24 C10.5 12.5 13.5 12.5 17 24 S23.5 35.5 27 24` en tinta;
  - punto en (33; 15,5), de radio 3,1, en naranja: el siguiente máximo de la onda, el resultado que se adelanta;
  - guion `M40 24 H41` en tinta;
  - icono de app: cuadrado redondeado con radio del 22,5 % del lado;
  - sobre naranja, siempre tinta oscura; margen libre de al menos el diámetro del punto.
- **Tareas:**
  - [ ] Copiar los paquetes a `docs/marca/originales/` tal cual, con sus LEEME.
  - [ ] Script `pnpm marca` con SVGO para los iconos: quita metadatos, conserva `viewBox`, `<title>` y `<style>`, y deja cada SVG por debajo de 1 KB (hallazgo M3).
  - [ ] Publicar en `app/public/marca/` solo lo que se usa:
    - `favicon.svg`;
    - PNG de app claro de 32 y 180;
    - de app claro 192 y 512, y maskable claro 192 y 512 (los del `manifest-iconos.json`).
  - [ ] Usar el `favicon.svg` del paquete corregido, que ya trae su `<style>` con `prefers-color-scheme` y trazo de 3,6, y comprobar que sigue así tras SVGO (que no elimine el `<style>` ni las clases).
  - [ ] En `index.html`:
    - `<link rel="icon">` con el SVG y el PNG de 32;
    - `apple-touch-icon` de 180;
    - `<meta name="theme-color">` con `media` para claro (`#E8E6E1`) y oscuro (`#1A1A19`).
  - [ ] `ui/marca/geometria.ts`: las tres primitivas (onda, punto y guion) como constantes, única fuente para los componentes y para las animaciones (IN-090).
  - [ ] Componente `SimboloRimor`:
    - SVG en línea con `stroke: var(--ink)` y `fill: var(--key)`, así que sigue al tema solo;
    - propiedades `variante` (`color` o `mono`), `tamano` y `titulo` (si no hay título, `aria-hidden`);
    - por debajo de 20 px, trazo de 3,6, como el favicon.
  - [ ] Componente `Logotipo`: símbolo más «Rimor» en Archivo 700, con texto vivo dentro de la app (hallazgo M4).
  - [ ] Script que genera `rimor-logotipo-contornos-{claro,oscuro}.svg` con el texto en contornos (opentype.js y la fuente empaquetada), para usos fuera de la app.
  - [ ] Sustituir en la carcasa y en la guía el símbolo antiguo:
    - en el raíl, `Logotipo` de 18 px;
    - en el avatar de Rimor (`RespuestaRimor`), `SimboloRimor` **mono** de 13 px. El naranja solo se enciende mientras contesta (IN-090), para no gastar el color en cada mensaje.
  - [ ] `/muestras`: símbolo a 16, 20, 24, 48 y 96 px, logotipo e iconos de app, en claro y oscuro.
- **Pruebas:**
  - captura visual de `/muestras` (marca) en los dos temas;
  - el favicon cambia de colores con `emulateMedia({ colorScheme })`;
  - ningún SVG publicado lleva `<metadata>` ni pasa de 1 KB;
  - el contraste del punto naranja sobre `--panel` y del símbolo sobre el icono de señal (`#191919` sobre `#EE4F1F`, 4,8:1) se comprueba en la prueba de contraste de IN-002.
- **Aceptación:**
  - la pestaña muestra el favicon correcto en claro y en oscuro;
  - la PWA (cuando exista, IN-050) usa los iconos del manifest;
  - no queda ningún rastro del símbolo antiguo.

---

### IN-090 · Animaciones del símbolo (núcleo)

- **Objetivo:** que las esperas y los momentos clave hablen con el símbolo, con pocas animaciones, tranquilas y siempre con texto al lado.
- **Catálogo:** movimiento (`rimor-diseno.md` §11). · **Depende de:** IN-002, IN-089, D18. · **Ola:** 1 · **Tamaño:** M
- **Dónde vive:** `ui/marca/Senal.tsx`, `ui/marca/senal.css`.
- **Componente:**

```tsx
type EstadoSenal =
  | 'arranque' | 'primer-uso' | 'cargando' | 'analizando' | 'indexando' | 'contestando'
  | 'exportando' | 'copia-al-dia' | 'guardado' | 'error'                  // v0.1
  | 'comparando' | 'leyendo-datos' | 'sin-conexion'                        // v0.1 (opcional) y v0.2
  | 'evidencia' | 'procesando';                                           // v0.3 y v0.4

<Senal estado="indexando" tamano={24} veces="bucle" etiqueta="Indexando" />
// veces: 'bucle' | 1. Con 1, se detiene en el «fotograma de reposo» de su estado (columna de la tabla),
// que es también lo que se ve con movimiento reducido.
```

- **Reglas** (del LEEME de `rimor-animaciones` y de la guía §11):
  - tiempos, valores y curvas, los del SVG de cada animación: `cubic-bezier(.4, 0, .2, 1)` en todos los tramos con `keySplines`, y lineal en los recorridos continuos (04, 06, 07 y 13); duraciones del LEEME; sin rebotes;
  - solo se animan `stroke-dashoffset`, `opacity`, `transform`, `r`, `fill` y `offset-distance`: nada que recalcule el diseño;
  - colores por token: onda `--ink`, punto `--key`, error `--bad`, gris apagado `--apagado` (M5), texto secundario `--muted`, onda de fondo con `opacity` (0,18–0,22);
  - **umbral de 400 ms:** una espera no muestra animación hasta pasar 400 ms, y una vez visible dura al menos 600 ms, para que no parpadee;
  - **nunca sola:** siempre con texto al lado («Indexando 4.210 de 10.000») y `role="status"` con `aria-live="polite"`;
  - **una por zona:** nunca dos animaciones en bucle a la vez en la misma pantalla;
  - **bucles con límite:** tras 20 s en bucle se detiene en el fotograma final y queda el texto con el progreso;
  - **`prefers-reduced-motion: reduce`:** ninguna animación; se muestra el fotograma de reposo de cada estado.

#### Animaciones que entran

Se implementan 15 de las 20; las otras 5 no aportan nada (ver la tabla siguiente). El movimiento es el de los SVG del paquete corregido; los porcentajes son sus `keyTimes`.

| # | Estado | Dónde se usa | Movimiento (del SVG) | Duración | Veces | Fotograma de reposo | IN que la usa |
|---|---|---|---|---|---|---|---|
| 01 | `arranque` | Pantalla de arranque mientras se abre el espacio (OPFS y caché), solo si tarda más de 400 ms | La onda se dibuja (0–40 %); el punto crece de radio 1 a 3,1 y aparece (38–50 %); sale el guion (50–58 %) y el nombre entra desde 4 px a la izquierda (50–65 %) | 3,6 s | 1, y pasa a `cargando` si sigue abriendo | Logotipo completo (88 %) | 007 |
| 04 | `cargando` | Indicador indeterminado de `Cargando`: vistas diferidas, módulos WASM | Un segmento del 26 % recorre la onda tenue, lineal | 1,4 s | Bucle | Símbolo con la onda tenue | 090 (en `Cargando`), 044, 074, 084 |
| 20 | `contestando` | Avatar de la respuesta de Rimor mientras el Worker deriva y compone | El punto parpadea tres veces (opacidad de 1 a 0,3, 0–60 %) y se queda encendido, como quien va a hablar. Al llegar la respuesta, el avatar vuelve a mono | 2,4 s | Bucle hasta que llega la respuesta | Símbolo mono | 016, 026 |
| 11 | `analizando` | Vista de elemento mientras `derivar` tarda (logs grandes, datos) | La onda cambia de amplitud sobre su eje: escala vertical de 1 a 0,4 y vuelta | 1,6 s | Bucle | Símbolo | 012, 020 |
| 06 | `indexando` | Reconstrucción de la caché y del índice, con el progreso al lado | La onda se rellena sobre la tenue (0–68 %) mientras el punto la recorre y sube a su sitio (`offset-path`, 0–75 %), lineal | 2,4 s | Bucle | Símbolo | 006, 032 |
| 19 | `exportando` | Generación del ZIP y del JSON | El punto viaja 9 px a la derecha, hasta el guion, y se desvanece (15–45 %), como un archivo que sale; reaparece en su sitio (60–80 %) | 2,4 s | Bucle | Símbolo | 035 |
| 14 | `copia-al-dia` | Al terminar una exportación completa; enlaza con el piloto verde del raíl | El punto pasa de gris apagado a naranja: se enciende (30–42 %) y se mantiene | 3 s | 1 | Símbolo con el punto encendido (88 %) | 035, 037 |
| 09 | `guardado` | Confirmación de importación, restauración de versión o documento exportado | Un anillo sale del punto, crece de radio 3,1 a 10 y se desvanece (0–70 %) | 1,8 s | 1 | Símbolo | 036, 029, 076 |
| 15 | `error` | `ErrorTarjeta`: importación rechazada, lector que falla | La onda se aplana como una señal perdida (escala vertical hasta 0,06, 20–40 %) y el punto pasa a `--bad`; se recupera al final del ciclo | 3,2 s | 1 | Onda normal y punto en `--bad` (no la línea plana, que se confundiría con «vacío») | 090 (en `ErrorTarjeta`), 036 |
| 02 | `primer-uso` | Bienvenida del primer uso, con la frase guía | Como `arranque`, en 5,5 s, y después «del rumor a la conclusión» en Roboto Mono `--muted` (55–68 %) | 5,5 s | 1 | Logotipo con la frase (90 %) | 039 |
| 17 | `comparando` | Al crear una comparación, solo si el cálculo pasa de 400 ms | La onda de referencia (`--apagado`) llega desde 6 px a la derecha y se alinea con la medida (0–40 %); aparece el punto, el veredicto (38–48 %) | 3 s | 1 | Ondas alineadas y punto (75 %) | 028 (opcional), 067 |
| 13 | `leyendo-datos` | Carga y consulta de CSV, JSON o DuckDB | Onda punteada que avanza, lineal | 0,8 s | Bucle | Onda punteada | 044, 045 |
| 16 | `sin-conexion` | Pie del raíl en modo sin red o sin conexión; fichas de enlace sin enriquecer | Onda discontinua al 55 %, punto hueco que respira (opacidad de 1 a 0,35) | 2,4 s | Bucle lento | Onda discontinua y punto hueco | 050, 061, 041 |
| 10 | `evidencia` | Al vincular un elemento a una investigación | Una línea naranja se dibuja desde el final de la onda hasta el punto (10–40 %) y el punto crece y aparece (38–50 %) | 2,6 s | 1 | Onda, línea y punto (85 %) | 070 |
| 18 | `procesando` | OCR, Pandoc, Typst y tareas largas | La onda se dibuja y se borra hacia delante (desplazamiento del trazo de 100 a −100) mientras el punto late (0,3 ↔ 1) | 2,2 s | Bucle | Símbolo | 064, 084, 085 |

#### Animaciones que no entran

| # | Animación | Por qué no |
|---|---|---|
| 03 | Icono de arranque | Los navegadores no animan de forma fiable un favicon SVG, y la pantalla de arranque ya cubre ese momento. |
| 05 | Esperando (el punto respira) | La cubre `cargando`; dos animaciones para lo mismo confunden. |
| 07 | Buscando (la onda se desplaza) | La búsqueda tarda menos de 50 ms: con el umbral de 400 ms, nunca se vería. |
| 08 | Guardando dato (el punto cae a su sitio) | Guardar tarda menos de 300 ms; sería un parpadeo. El borde naranja de la captura fresca ya lo señala. |
| 12 | Detectando (una línea barre hasta el punto) | La huella y el veredicto son instantáneos; el resultado ya es la señal. |

- **Tareas:**
  - [ ] `Senal.tsx`: SVG en línea a partir de `geometria.ts`, una clase por estado y las propiedades de arriba.
  - [ ] `senal.css`: los `@keyframes` de los 10 estados de v0.1 (01, 02, 04, 06, 09, 11, 14, 15, 19, 20) y del 17, portados de los SVG: cada `keyTimes` es un porcentaje del `@keyframes`, cada `keySplines` su `animation-timing-function` por tramo y cada color, su token. Los estados de v0.2 a v0.4 (13, 16, 10, 18) se añaden en las IN que los usan, con la misma técnica.
  - [ ] Copiar los SVG originales a `ui/marca/referencia/` (solo para las pruebas; no se publican).
  - [ ] Hook `useEsperaVisible(activo)`: aplica el umbral de 400 ms y el mínimo de 600 ms.
  - [ ] Sustituir el indicador indeterminado de `Cargando` (IN-002) por `<Senal estado="cargando">`; la barra se queda para el progreso determinado.
  - [ ] Añadir `<Senal estado="error" veces={1}>` a `ErrorTarjeta`.
  - [ ] `/muestras`: cada estado en claro y oscuro, con botón para repetir y un interruptor de movimiento reducido.
  - [ ] Actualizar `rimor-diseno.md` §11 con la tabla de estados si algo cambia al implementar.
- **Pruebas:**
  - **fidelidad con el original:** para cada estado y cada tema, captura del componente y del SVG original en los mismos cinco instantes (fijando el tiempo con `document.getAnimations()` y `currentTime` en el componente, y con `pauseAnimations()` y `setCurrentTime()` en el SVG); diferencia de píxeles por debajo del 1 %;
  - con `emulateMedia({ reducedMotion: 'reduce' })`, `document.getAnimations()` está vacío y se ve el fotograma final;
  - `useEsperaVisible`: una espera de 300 ms no muestra nada; una de 450 ms se ve al menos 600 ms;
  - ningún estado provoca recálculos de diseño (traza de rendimiento sin *layout* durante la animación);
  - peso de `Senal.tsx` y `senal.css` < 4 KB comprimidos.
- **Aceptación:**
  - los 10 estados de v0.1 pasan la prueba de fidelidad con sus SVG originales;
  - ninguna pantalla muestra dos bucles a la vez;
  - con movimiento reducido no se mueve nada.

---

### IN-005 · Almacén OPFS y en memoria

- **Objetivo:** guardar y leer archivos del espacio de forma fiable y rápida, sin bloquear la interfaz.
- **Catálogo:** DAT-01. · **Depende de:** IN-004, F0-1. · **Ola:** 1 · **Tamaño:** L
- **Dónde vive:** `almacen/opfs/`, `almacen/memoria.ts`, `workers/almacen.worker.ts`.
- **Interfaz:**

```ts
interface Almacen {
  leer(ruta: string): Promise<Uint8Array | null>;
  escribir(ruta: string, datos: Uint8Array): Promise<void>;   // atómica
  mover(de: string, a: string): Promise<void>;
  borrar(ruta: string): Promise<void>;
  listar(prefijo: string): AsyncIterable<{ ruta: string; tam: number; modificado: number }>;
  existe(ruta: string): Promise<boolean>;
}
```

- **Tareas:**
  - [ ] Adaptador en memoria (para pruebas y para el modo de ejemplo).
  - [ ] Adaptador OPFS dentro de un Worker con `createSyncAccessHandle` y Comlink.
  - [ ] **Escritura atómica:** escribir en `ruta.tmp` y renombrar; al arrancar, limpiar `.tmp` huérfanos.
  - [ ] Cola de escrituras serializada por ruta, con agrupado de escrituras seguidas del mismo archivo.
  - [ ] Capa de repositorio sobre el almacén: `guardarElemento`, `leerElemento(ref|id)`, `moverAPapelera`, `restaurar`, `guardarAdjunto(bytes) → hash` (sin duplicados).
  - [ ] Renombrado de archivo cuando cambia el título (el `id` no cambia).
  - [ ] Detección de otra pestaña abierta con el mismo espacio (`BroadcastChannel` y Web Locks): solo una escribe; las demás pasan a solo lectura con un aviso.
- **Pruebas:**
  - el mismo conjunto de pruebas contra los dos adaptadores;
  - interrupción simulada a mitad de escritura: el archivo queda en su versión anterior o en la nueva, nunca a medias;
  - 5.000 elementos: listado y lectura completa dentro de lo medido en F0-1.
- **Aceptación:** cerrar la pestaña durante una escritura no corrompe nada; dos pestañas no escriben a la vez.

---

### IN-006 · Caché de derivados e índice

- **Objetivo:** abrir un espacio grande al instante sin releer ni recalcular todo.
- **Catálogo:** DAT-02. · **Depende de:** IN-004. · **Ola:** 1 · **Tamaño:** M
- **Dónde vive:** `almacen/cache/` (IndexedDB con `idb`).
- **Tareas:**
  - [ ] Almacenes: `frontmatter` (por id), `derivados` (clave: id + versión del lector + hash del original), `indice` (serialización de MiniSearch), `meta` (versión de la caché).
  - [ ] Reconstrucción completa desde los archivos, en segundo plano y con progreso, mostrada con `<Senal estado="indexando">` y el recuento («Indexando 4.210 de 10.000»).
  - [ ] Invalidación: cambio de hash, cambio de versión del lector o versión de caché distinta.
  - [ ] Comprobación al arrancar: si faltan entradas o sobran, se reconcilian.
- **Pruebas:** borrar IndexedDB y reabrir da el mismo estado; subir la versión de un lector recalcula solo sus derivados.
- **Aceptación:** apertura de 10.000 elementos con caché caliente < 2 s.

---

### IN-007 · Espacio de trabajo y persistencia

- **Objetivo:** crear y abrir espacios, y hacer todo lo posible para que el navegador no borre los datos.
- **Catálogo:** DAT-06. · **Depende de:** IN-005, IN-090, F0-1. · **Ola:** 2 · **Tamaño:** S
- **Tareas:**
  - [ ] Crear espacio: raíz, `manifest.json` (Anexo A del plan) y carpetas.
  - [ ] `navigator.storage.persist()` al crear el primer espacio, con explicación previa; guardar el resultado.
  - [ ] `navigator.storage.estimate()` para el espacio usado.
  - [ ] Detección de ventana privada y aviso persistente.
  - [ ] Registro de la fecha de la última copia y de los cambios desde entonces (alimenta IN-037).
  - [ ] Pantalla de arranque con `<Senal estado="arranque">` si abrir el espacio tarda más de 400 ms; si sigue abriendo al acabar, pasa a `cargando` con el texto de lo que se está abriendo.
- **Aceptación:** en Chrome con la PWA instalada, la persistencia queda concedida y se muestra; en una ventana privada, el aviso aparece.

---

### IN-008 · Carcasa, navegación, atajos y diseño adaptable

- **Objetivo:** la estructura de la app tal como la fija `rimor-diseno.md` §8.
- **Catálogo:** APP-01, APP-05. · **Depende de:** IN-002, IN-003, D6. · **Ola:** 1 · **Tamaño:** M
- **Tareas:**
  - [ ] Rutas: `/` (Inicio), `/e/:ref` (elemento), `/hilo/:ref`, `/buscar`, `/c/:coleccion`, `/datos`, `/ajustes`, `/muestras` (solo en desarrollo).
  - [ ] Raíl de 212 px: Inicio con recuento de «Sin clasificar», Buscar, colecciones, pie con el espacio, rejilla y piloto de copia.
  - [ ] Columna de lectura de hasta 780 px y modo ancho para pantallas que lo pidan.
  - [ ] Consulta de contenedor a 720 px: el raíl pasa a barra inferior.
  - [ ] Gestor de atajos: registro por pantalla y global, sin conflictos con campos de texto, y ayuda con `?`.
  - [ ] Atajos globales del Anexo H del plan: `/`, `g` + letra, `Ctrl+E` (lo conecta IN-035).
  - [ ] Aviso efímero global y cola de avisos.
  - [ ] Límite de errores por pantalla con `ErrorTarjeta`.
- **Pruebas:** navegación completa con teclado en Playwright; capturas a 1440 y 400 px.
- **Aceptación:** la carcasa coincide con «Pantallas de Rimor» en los dos temas y anchos.

---

### IN-009 · Saneado y política de seguridad de contenido

- **Objetivo:** que nada pegado se ejecute nunca.
- **Catálogo:** SEG-01, SEG-02. · **Depende de:** IN-001. · **Ola:** 1 · **Tamaño:** S
- **Tareas:**
  - [ ] `sanear.ts` con `rehype-sanitize` y un esquema propio: sin `script`, `iframe`, `on*`, `style` en línea ni `javascript:`; los SVG van por la misma vía.
  - [ ] Componente `MarkdownSeguro` (unified → rehype → React) como única forma de pintar Markdown pegado.
  - [ ] CSP en las cabeceras del hosting y en un `<meta>`: `default-src 'self'`, `connect-src` vacío salvo las APIs activadas, sin `unsafe-eval` (salvo la excepción que pidan los WASM, documentada en un ADR).
- **Pruebas:** corpus de cargas XSS (OWASP) renderizadas sin ejecutar nada; prueba de extremo a extremo que pega un `<img onerror>`.
- **Aceptación:** ninguna carga del corpus ejecuta código ni hace peticiones.

---

### IN-010 · Ocultación de secretos

- **Objetivo:** que ninguna clave llegue nunca al disco.
- **Catálogo:** CAP-05. · **Depende de:** IN-001. · **Ola:** 1 · **Tamaño:** M
- **Dónde vive:** `seguridad/secretos/`.
- **Tareas:**
  - [ ] Reglas adaptadas de gitleaks:
    - AWS, GCP y Azure;
    - GitHub, GitLab y Slack;
    - OpenAI, Anthropic y OpenRouter;
    - JWT y claves privadas PEM;
    - cadenas de conexión con contraseña, cabeceras `Authorization` y contraseñas en URL.
  - [ ] `ocultar(texto) → { texto, hallados: { regla, posicion }[] }` puro, con sustitución `‹oculto:tipo›`.
  - [ ] Idempotencia: ocultar dos veces da lo mismo (lookahead que no vuelve a casar con `‹`).
  - [ ] Desactivar una regla solo para un pegado concreto (lo usa el compositor).
- **Pruebas:**
  - corpus de secretos falsos que deben ocultarse;
  - corpus de falsos positivos que **no** deben ocultarse (hashes de commits, UUID, sumas SHA en logs);
  - propiedad: ocultar es idempotente.
- **Aceptación:** el 100 % del corpus de secretos se oculta y menos del 2 % de falsos positivos en el corpus de logs reales.

---

### IN-011 · Paquete de estadística

- **Objetivo:** cálculos de mediciones correctos y verificados.
- **Catálogo:** soporte de LEC-06 y CMP-01. · **Depende de:** IN-001. · **Ola:** 1 · **Tamaño:** M
- **Dónde vive:** `paquetes/estadistica/`.
- **Tareas:**
  - [ ] Mediana, media, desviación típica, coeficiente de variación, mínimo, máximo, percentiles 5 y 95 (método de interpolación documentado).
  - [ ] Intervalo de confianza del 95 % de la mediana por estadísticos de orden.
  - [ ] Mann-Whitney U con corrección por empates y de continuidad; p bilateral.
  - [ ] Detección de atípicos (IQR × 1,5) y avisos de método: n < 10, CV > 5 %, atípicos.
  - [ ] Veredicto: cambio porcentual de medianas y significación (umbral 0,05).
  - [ ] Hodges-Lehmann se deja preparado como firma, sin implementar (IN-047).
- **Pruebas:** valores de referencia generados con SciPy y benchstat en `paquetes/estadistica/referencias/*.json` (al menos 30 casos, con empates y tamaños distintos); tolerancia 1e-9 en estadísticos y 1e-6 en p.
- **Aceptación:** el ejemplo del plan da mediana 38,535 y 36,795, cambio −4,5 % y p < 0,001.

---

### IN-012 · Contrato y registro de lectores

- **Objetivo:** que añadir un lector sea rellenar una interfaz, sin tocar el resto de la app.
- **Catálogo:** VIS-01 (la vista de cada lector). · **Depende de:** IN-004, IN-006. · **Ola:** 2 · **Tamaño:** M
- **Dónde vive:** `lectores/contrato.ts`, `lectores/registro.ts`, `workers/derivados.worker.ts`.
- **Tareas:**
  - [ ] Interfaz `Lector<D>` del plan (§14.4), con `respuesta` (CAP-14), `cifras`, `incrustaciones` (preparadas para v0.3) y `textoIndexable`.
  - [ ] Registro ordenado según el Anexo D del plan.
  - [ ] Worker de derivados: cola con prioridad (lo visible primero), cancelación y caché (IN-006).
  - [ ] Componentes contenedor `VistaElemento` y `TarjetaElemento` que cargan la vista del lector de forma diferida (`React.lazy`). Mientras `derivar` no termina, `VistaElemento` muestra el resumen del frontmatter y `<Senal estado="analizando">` con lo que se está calculando.
  - [ ] Plantilla de lector (`lectores/_plantilla/`) con todos los archivos y un README.
- **Pruebas:** un lector falso registrado de punta a punta; cambio de versión de un lector que provoca recálculo.
- **Aceptación:** la plantilla se copia, se rellena y aparece en la app sin tocar código fuera de su carpeta y de `registro.ts`.

---

### IN-013 · Detector de tipo y corpus

- **Objetivo:** acertar el tipo sin preguntar, y dudar bien cuando no se sabe.
- **Catálogo:** CAP-04. · **Depende de:** IN-012. · **Ola:** 2 · **Tamaño:** M
- **Dónde vive:** `captura/detector.ts`, `fixtures/`.
- **Tareas:**
  - [ ] Arbitraje: cada lector puntúa entre 0 y 1; gana el mayor por encima de 0,6; si el segundo queda a menos de 0,15, se ofrecen los dos; si nadie pasa de 0,6, va a Texto.
  - [ ] Atajos previos (Anexo D): binarios por tipo MIME o firma; URL o DOI completos.
  - [ ] Corpus `fixtures/deteccion/<tipo>/*.txt` con al menos 25 ejemplos reales por tipo de v0.1. Cada lector añade los suyos en su IN.
  - [ ] Script `pnpm deteccion` que imprime la matriz de confusión y el acierto por tipo; corre en la integración continua.
- **Pruebas:** la matriz como prueba, con un umbral que sube según entran lectores (objetivo final del 90 % en IN-040).
- **Aceptación:** el arnés funciona con el lector de Texto solo y no hay que cambiarlo al añadir lectores.

---

### IN-014 · Flujo de captura

- **Objetivo:** de pegar a ver el elemento en menos de 300 ms, siempre igual.
- **Catálogo:** CAP-01, CAP-02, ORG-05. · **Depende de:** IN-005, IN-010, IN-012. · **Ola:** 3 · **Tamaño:** M
- **Dónde vive:** `captura/flujo.ts`.
- **Pasos, en este orden** (§14.5 del plan):
  1. Normalizar la entrada: texto, archivos soltados (uno o varios) o imagen del portapapeles.
  2. Ocultar secretos (IN-010), antes de nada.
  3. Detectar el tipo (IN-013), salvo que venga forzado con `/tipo`.
  4. Comprobar duplicado exacto por hash: si existe, no se crea; se avisa y se lleva al existente (ORG-05).
  5. Aplicar indicaciones (`@colección`, `#etiqueta`, hilo de respuesta).
  6. `leer` del lector → escribir `.md` y adjunto.
  7. Publicar el elemento en el estado: se ve en el feed al instante con el resumen.
  8. `derivar` en el Worker → `respuesta` (IN-016) → actualizar feed, caché e índice.
- **Tareas:**
  - [ ] Implementar el flujo como función pura más efectos inyectados (almacén, caché, índice, reloj) para probarlo sin navegador.
  - [ ] Pegar fuera de un campo de texto, en cualquier pantalla, lleva el contenido al compositor (no guarda directamente).
  - [ ] Soltar archivos sobre cualquier pantalla: los guarda uno a uno con su lector (o el genérico).
  - [ ] Límites: más de 50 MB por archivo se rechaza con un aviso que lo explica.
  - [ ] Deshacer la última captura durante 10 s («Guardado. Deshacer»).
- **Pruebas:** de extremo a extremo con los corpus de cada tipo; duplicado; secreto; archivo grande; 20 pegados seguidos sin perder ninguno.
- **Aceptación:** pegar 100 KB → visible en < 300 ms (p95) en el portátil de referencia.

---

### IN-015 · Compositor

- **Objetivo:** capturar como en un chat, configurando lo mínimo.
- **Catálogo:** CAP-03, CAP-13. · **Depende de:** IN-008, IN-014. · **Ola:** 3 · **Tamaño:** M
- **Dónde vive:** `captura/indicaciones.ts` (puro), `ui/componentes/Compositor.tsx`.
- **Tareas:**
  - [ ] Área de texto que crece hasta 220 px; Enter guarda, Mayús+Enter salta de línea; respeta la composición de texto (IME).
  - [ ] `analizarIndicaciones(texto)`:
    - `/tipo` al principio;
    - `@colección` y `#etiqueta` en la última línea (o al final de una sola línea);
    - `?texto` para buscar.
    - Devuelve `{ cuerpo, tipo?, colecciones, etiquetas, busqueda? }`.
  - [ ] Vista previa en vivo bajo la caja, sin bloquear al teclear (detector con *debounce* de 120 ms y en el Worker si el texto pasa de 20 KB): tipo y confianza, alternativa si hay duda, colecciones, etiquetas y secretos que se ocultarán.
  - [ ] Autocompletar `@` con colecciones existentes y `#` con etiquetas usadas; `/` con tipos.
  - [ ] Botón de adjuntar (selector de archivos) y zona de soltar.
  - [ ] Modo respuesta: «Respondiendo a REF» con botón para cancelar (lo usa IN-030).
  - [ ] `?texto` + Enter muestra los resultados en el feed como un mensaje de búsqueda (lo conecta IN-032).
  - [ ] `Ctrl+Shift+Espacio` enfoca el compositor desde cualquier pantalla (lleva a Inicio si hace falta).
  - [ ] Borrador guardado en `sessionStorage` por si se recarga.
- **Pruebas:** `analizarIndicaciones` con 40 casos (incluidos `#` dentro de código, `@` en correos y `/` en rutas, que **no** son indicaciones); de extremo a extremo de cada indicación.
- **Aceptación:** un correo `ana@empresa.com` en mitad del texto no se toma como colección; un log que empieza por `/var/log` no se toma como `/tipo`.

---

### IN-016 · Respuestas de Rimor y contadores locales

- **Objetivo:** que cada captura reciba una frase útil, siempre calculada, nunca inventada.
- **Catálogo:** CAP-14. · **Depende de:** IN-012, IN-003, IN-090, D14. · **Ola:** 3 · **Tamaño:** M
- **Dónde vive:** `respuestas/`.
- **Modelo:**

```ts
type Fragmento =
  | { t: 'texto'; v: string } | { t: 'fuerte'; v: string } | { t: 'cifra'; v: string }
  | { t: 'ref'; ref: Ref } | { t: 'cita'; v: string; fecha: IsoFecha } | { t: 'mono'; v: string };
type Accion = { id: string; etiqueta: ClaveI18n; principal?: boolean };
type Respuesta = { texto: Fragmento[]; acciones?: [Accion, Accion?] };
```

- **Tareas:**
  - [ ] `construirContexto(elemento)`: misma huella, versiones previas, notas de solución, colecciones candidatas (por etiquetas y palabras), elemento al que se responde.
  - [ ] Componente `RespuestaRimor` que pinta los fragmentos según la guía (§7.6). Su avatar es el `SimboloRimor` mono (IN-089); mientras la respuesta se compone, pasa a `<Senal estado="contestando">` y la línea de texto muestra «Leyendo…».
  - [ ] Reglas de estilo comprobadas por prueba: como mucho 2 frases, sin `!`, sin emojis y como mucho 2 acciones.
  - [ ] Frase añadida común: secretos ocultados.
  - [ ] Desactivar respuestas por tipo (D14), leído de ajustes.
  - [ ] **Contadores locales** (`.rimor/contadores.json`, por día): errores reconocidos, duplicados evitados, copias con valores, búsquedas con resultado, correcciones de tipo y respuestas descartadas («No» o archivar sin actuar).
- **Pruebas:** instantáneas (*snapshots*) de la respuesta de cada lector con sus fixtures, en `es` y `en`; las reglas de estilo, como prueba de propiedades sobre todas las respuestas generadas.
- **Aceptación:** ninguna respuesta del corpus incumple las reglas; los contadores sobreviven a exportar e importar.

---

### IN-017 · Lector Texto y lector genérico de archivo

- **Objetivo:** la red de seguridad, y el primer lector que valida el contrato.
- **Catálogo:** LEC-01. · **Depende de:** IN-012, IN-016. · **Ola:** 3 · **Tamaño:** S
- **Tareas:**
  - [ ] Texto: renderiza Markdown saneado; extrae enlaces y menciones de refs; título de la primera línea.
  - [ ] Archivo genérico: adjunto por hash; muestra nombre, tamaño y tipo MIME; descarga del original; marca «pendiente de lector» para reprocesar cuando llegue el suyo.
  - [ ] Respuestas: «Texto guardado.» · «Archivo de 2,4 MB guardado. Rimor aún no sabe leer este tipo.»
- **Aceptación:** cualquier cosa que no reconozca otro lector se guarda y se encuentra.

---

### IN-018 · Lector Idea y resurgimiento mínimo

- **Catálogo:** LEC-02, ORG-13 (parcial; incoherencia 1). · **Depende de:** IN-017. · **Ola:** 4 · **Tamaño:** S
- **Tareas:**
  - [ ] Detecta texto corto (< 280 caracteres) sin otras señales, o `/idea`.
  - [ ] Estados: semilla, explorando, aparcada, descartada y convertida (esta última, activa desde IN-070).
  - [ ] **Resurgimiento mínimo:** una idea en semilla sin tocar vuelve al feed a los 7 días y, si se pospone, a los 30. Mensaje con «Más adelante» y «Descartar».
  - [ ] Respuesta: «Idea guardada. Volverá dentro de 7 días si no haces nada con ella.»
- **Aceptación:** con el reloj simulado, la idea aparece en el feed el día 7 y el 37 si se pospone.

---

### IN-019 · Lector Enlace básico

- **Catálogo:** LEC-03. · **Depende de:** IN-017. · **Ola:** 4 · **Tamaño:** S
- **Tareas:**
  - [ ] Normaliza: quita `utm_*`, `fbclid`, `gclid` y `ref` de seguimiento, y ordena los parámetros.
  - [ ] Clasifica por destino: repositorio, paquete, paper (arXiv, DOI), documentación, issue o PR, Stack Overflow, vídeo u otro.
  - [ ] Título provisional desde la URL (dominio y ruta legibles).
  - [ ] Sin red en v0.1 (D7).
  - [ ] Respuesta: «Documentación de ureq en docs.rs.» y, si ya existía, «Ya lo guardaste el 2 oct.»
- **Aceptación:** 60 URL reales del corpus se clasifican bien.

---

### IN-020 · Lector Log

- **Catálogo:** LEC-04 (§8.1 del plan). · **Depende de:** IN-017, F0-6. · **Ola:** 4 · **Tamaño:** M
- **Tareas:**
  - [ ] Detecta marcas de tiempo, niveles, JSON por línea, syslog y logfmt.
  - [ ] Deriva:
    - líneas, rango temporal y recuento por nivel;
    - plantillas por normalización (fechas, UUID, IP, hexadecimales, números);
    - pares `clave=valor`;
    - primer y último error;
    - histograma por minuto y nivel (o por hora si el rango pasa de 6 h).
  - [ ] Más de 50.000 líneas: análisis por bloques con progreso.
  - [ ] Vista: resumen y histograma; tabla de las 5 plantillas principales («ver todas»); pulsar una plantilla filtra las líneas; líneas originales y detalles, plegados.
  - [ ] Cifras citables: `lineas`, `errores`, `avisos`, `duracion`, `plantillas`.
  - [ ] Respuesta: «Log de 1042 líneas. 16 errores entre 17:40 y 17:43, a la vez que ERR-0015. ¿Lo añado a su hilo?»
- **Pruebas:** fixtures de 8 formatos; normalización estable (propiedad: normalizar dos veces da lo mismo); 50.000 líneas < 2 s.

---

### IN-021 · Lector Error y huella

- **Catálogo:** LEC-05, ORG-06 (§8.2 del plan). · **Depende de:** IN-017. · **Ola:** 4 · **Tamaño:** M
- **Tareas:**
  - [ ] Analizadores de trazas: Rust, Python, JavaScript y Node, Java y Kotlin, Go y .NET.
  - [ ] Marcos de tu código frente a librerías y sistema (heurísticas de ruta del plan).
  - [ ] **Huella:** hash del lenguaje, tipo, mensaje normalizado y los dos primeros marcos propios. Versionada: si cambia el algoritmo, se recalculan todas y se conservan los hilos.
  - [ ] Ocurrencias anteriores con la misma huella y su nota «así lo resolví».
  - [ ] Vista: mensaje; «3.ª vez» con la nota; tus marcos; librerías y traza original, plegadas.
  - [ ] Cifras: `ocurrencias`, `primera_vez`, `ultima_vez`.
  - [ ] Respuesta: «Es la tercera vez. El 15 oct escribiste: “…”.» o «Error de Rust nuevo. 2 marcos de tu código.»
- **Pruebas:** 6 lenguajes × 5 trazas reales; la misma traza con rutas y números distintos da la misma huella; dos errores distintos con el mismo mensaje no la comparten si cambian los marcos propios.

---

### IN-022 · Lector Mediciones

- **Catálogo:** LEC-06 (§8.3 del plan). · **Depende de:** IN-011, IN-017. · **Ola:** 4 · **Tamaño:** M
- **Tareas:**
  - [ ] Formatos v0.1: una medida por línea con o sin unidad, `go test -bench` y JSON de hyperfine. Etiqueta de la serie desde un comentario `#`.
  - [ ] Normaliza unidades a ms (o a s si todo pasa de 10 s).
  - [ ] Deriva todas las estadísticas de IN-011 y los avisos de método.
  - [ ] Vista: gráfico de puntos con mediana e intervalo, tabla de estadísticos y avisos plegados con recuento.
  - [ ] Cifras: `mediana`, `ic_bajo`, `ic_alto`, `n`, `cv`.
  - [ ] Respuesta: «20 mediciones · mediana 38,54 ms (IC 95 %: 38,11 – 39,02).» y, si n < 10, «Son pocas: lo recomendable son al menos 10.»

---

### IN-023 · Lector Prompt

- **Catálogo:** LEC-07 (§8.4 del plan). · **Depende de:** IN-017. · **Ola:** 4 · **Tamaño:** M
- **Tareas:**
  - [ ] Detecta imperativo dirigido a un modelo, variables `{{x}}`, `{x}` y `<x>`, bloques de rol, `CLAUDE.md`, skills (frontmatter con `name` y `description`) y definiciones de agentes.
  - [ ] Deriva variables, tokens aproximados (4 caracteres por token, documentado), secciones y destino si se menciona.
  - [ ] **Copiar con valores:** formulario mínimo con una caja por variable, valores recordados por prompt y copia al portapapeles (con alternativa de seleccionar texto si el navegador lo impide). Suma un contador (IN-016).
  - [ ] Resultados: pegar una respuesta al lado, con valoración de 1 a 5 y nota; se guarda en `historial/REF/resultado-fecha.md`.
  - [ ] Respuesta: «Prompt con 3 variables. Lo puedes copiar con valores.»
- **Pruebas:** sustitución de variables con valores que contienen llaves; skill y `CLAUDE.md` del corpus detectados.

---

### IN-024 · Lector Documento Markdown

- **Catálogo:** LEC-08 (§8.5 del plan). · **Depende de:** IN-017. · **Ola:** 4 · **Tamaño:** M
- **Tareas:**
  - [ ] Deriva índice de secciones (con ancla estable por título normalizado), palabras, tareas por sección y en total, enlaces y bloques de código.
  - [ ] Vista: progreso de tareas, índice con marcas de cambio (las aporta IN-029), documento renderizado y saneado.
  - [ ] Cifras: `tareas_hechas`, `tareas_total`, `palabras`.
  - [ ] Respuesta: «Documento con 6 secciones y 18 tareas (7 hechas).»

---

### IN-025 · Lector Código

- **Catálogo:** LEC-09. · **Depende de:** IN-017, D16. · **Ola:** 4 · **Tamaño:** S
- **Tareas:**
  - [ ] Detección del lenguaje por densidad de sintaxis (los 12 más comunes) y por extensión si viene de archivo.
  - [ ] Resaltado de solo lectura con los analizadores Lezer de CodeMirror.
  - [ ] Respuesta: «Código TypeScript, 48 líneas.»

---

### IN-026 · Inicio: feed y triaje

- **Objetivo:** la pantalla principal tal como está en «Pantallas de Rimor».
- **Catálogo:** ORG-01. · **Depende de:** IN-015, IN-016, IN-017, D17. · **Ola:** 5 · **Tamaño:** M
- **Tareas:**
  - [ ] Feed por días («Hoy», «Ayer», fecha), lista virtual, carga incremental hacia atrás.
  - [ ] `Mensaje`: icono, título, hora, vista previa de una línea, respuesta, acciones del lector y «Responder» y «Archivar». Borde naranja mientras está fresco.
  - [ ] Segmentado «Todo / Sin clasificar · N» (sin clasificar: sin colección, hilo ni investigación, y no archivado).
  - [ ] Mensajes de búsqueda (`?texto`) con hasta 5 resultados y «Abrir en Buscar».
  - [ ] Mensajes de resurgimiento de ideas (IN-018).
  - [ ] Triaje con teclado: `j`, `k`, `Enter`, `r`, `c`, `i` (oculto hasta v0.3), `e`, `f`, `t` y `x`.
  - [ ] Estado vacío de primer uso con ejemplos de qué pegar.
  - [ ] Compositor fijo abajo (IN-015) y encima de la barra inferior en el móvil.
- **Pruebas:** de extremo a extremo del triaje completo con teclado; 5.000 elementos con desplazamiento fluido (sin tareas > 50 ms).
- **Aceptación:** coincide con la pantalla Inicio del artefacto, salvo lo que la §3 aplaza (sesiones, «convertir en investigación», Métricas en el raíl).

---

### IN-027 · Vista de elemento, estados, fijar y papelera

- **Catálogo:** VIS-01, ORG-04, ORG-07. · **Depende de:** IN-012, IN-008. · **Ola:** 5 · **Tamaño:** M
- **Tareas:**
  - [ ] Cabecera común: chip de tipo, estado, título editable en el sitio y línea de meta.
  - [ ] Cuerpo: la `Vista` del lector.
  - [ ] Detalles comunes plegados: colecciones, etiquetas, origen, secretos ocultados, ref, cifras citables y «Ver original».
  - [ ] Corregir el tipo en un clic (reprocesa con el otro lector y suma una corrección al contador).
  - [ ] Notas del usuario (cuerpo del `.md`) con editor simple.
  - [ ] Estados ligeros (nuevo, en uso, resuelto, archivado) y los propios de cada tipo.
  - [ ] Fijar, mover a la papelera, restaurar y vaciar la papelera (con ZIP previo, IN-035).
- **Aceptación:** todo se edita sin formularios: en el sitio, con un clic o con teclado.

---

### IN-028 · Comparaciones de logs y mediciones

- **Catálogo:** CMP-01. · **Depende de:** IN-020, IN-022. · **Ola:** 5 · **Tamaño:** M
- **Tareas:**
  - [ ] Elemento `Comparacion` (`comparaciones/CMP-NNNN--….md`) con las refs de las fuentes y el resultado en el resumen.
  - [ ] Logs: primera divergencia (por plantilla), mensajes solo en una, ausentes y con frecuencia distinta (×2 o ÷2).
  - [ ] Mediciones: veredicto, gráfico de las dos series, tabla de dos filas y avisos plegados.
  - [ ] Cómo se crea:
    - seleccionar dos (`x`) y `Ctrl+Shift+C`;
    - desde un elemento, «Comparar con…» y elegir;
    - si los tipos no coinciden, se explica por qué no se puede.
  - [ ] Recalcular si cambia una fuente, con aviso «la comparación ha cambiado».
  - [ ] Si el cálculo pasa de 400 ms, `<Senal estado="comparando" veces={1}>` mientras se calcula (opcional).
  - [ ] Cifras: `cambio`, `p`, `divergencia`, `nuevos`, `ausentes`.
- **Aceptación:** los ejemplos del plan (CMP-0004 y CMP-0005) dan los resultados de «Pantallas de Rimor».

---

### IN-029 · Versiones e historial

- **Catálogo:** CMP-02, DAT-08. · **Depende de:** IN-005, IN-023, IN-024. · **Ola:** 5 · **Tamaño:** M
- **Tareas:**
  - [ ] Al capturar un prompt, Markdown o código muy parecido a uno existente (mismo título o similitud > 0,6 por *shingles*), se propone «guardar como versión nueva» (la respuesta lo dice: «Lo he guardado como su versión 2») con deshacer.
  - [ ] La versión anterior va a `historial/REF/fecha.md`; el elemento sube `version`.
  - [ ] Diff por líneas (LCS o Myers) y, en Markdown, diff por secciones: añadidas, quitadas, modificadas y tareas marcadas.
  - [ ] Lista de versiones y «Restaurar esta versión», con `<Senal estado="guardado" veces={1}>` al confirmar.
  - [ ] Cualquier edición del usuario sobre un elemento también deja versión (lo usa la importación al fusionar).
- **Pruebas:** propiedad: aplicar el diff a la versión antigua da la nueva.

---

### IN-030 · Hilos

- **Catálogo:** ORG-15, ORG-06. · **Depende de:** IN-021, IN-026, D13. · **Ola:** 5 · **Tamaño:** M
- **Tareas:**
  - [ ] Entidad `Hilo` (`hilos/HIL-NNNN--….md`): título, estado (abierto o resuelto), nota de solución, creado y resuelto.
  - [ ] Formación automática: el segundo error con la misma huella crea el hilo con los dos; los siguientes se añaden.
  - [ ] «Responder» en un mensaje: la nueva captura entra en el hilo de ese elemento (o crea uno).
  - [ ] Pantalla Hilo: cabecera, mensajes en orden con su respuesta, la nota «así lo resolviste» destacada y compositor «Responder en este hilo…».
  - [ ] «Marcar resuelto» con una línea de nota; reabrir.
  - [ ] «Convertir en investigación» oculto hasta IN-070.
  - [ ] Un elemento, un solo hilo (D13); moverlo de hilo con confirmación.
- **Aceptación:** pegar tres veces la misma traza con números distintos deja un hilo con tres elementos, y la tercera respuesta cita la nota del segundo.

---

### IN-031 · Colecciones y etiquetas

- **Catálogo:** ORG-02, ORG-03. · **Depende de:** IN-014, IN-008. · **Ola:** 5 · **Tamaño:** S
- **Tareas:**
  - [ ] `colecciones.json`: crear, renombrar (reescribe el frontmatter de sus elementos en segundo plano), borrar (los elementos quedan) y ordenar.
  - [ ] Crear al vuelo con `@nueva` desde el compositor.
  - [ ] Etiquetas inferidas: hashtags, paquetes, dominios, lenguajes y niveles de log; manuales con `#`.
  - [ ] Raíl con las colecciones y su recuento; lista simple de cada colección (el panel visual llega en IN-052).
  - [ ] Sugerencia de colección en la respuesta («¿Lo añado a la colección gateway?»), por coincidencia de etiquetas y palabras.

---

### IN-032 · Búsqueda

- **Catálogo:** BUS-01, BUS-02. · **Depende de:** IN-006, IN-012, F0-8. · **Ola:** 5 · **Tamaño:** M
- **Tareas:**
  - [ ] MiniSearch en un Worker: título, cuerpo, notas, etiquetas, ref y `textoIndexable` de cada lector; tolerancia a erratas y prefijos.
  - [ ] Analizador de la sintaxis del Anexo G del plan: texto, frase exacta, `tipo:`, `en:`, `#`, `desde:` y `hasta:` (con `hoy` y `semana`), `estado:`, `nivel:`, `huella:`, `dominio:` y `-excluir`. Sin acentos ni mayúsculas en la comparación.
  - [ ] Pantalla Buscar: caja, sugerencias de filtros, resultados agrupados por tipo con resaltado y «coincide dentro del contenido».
  - [ ] Ranking: relevancia, más un empujón a lo fijado y a lo reciente.
  - [ ] Búsqueda desde el compositor con `?` (IN-015).
  - [ ] Contador de búsquedas con resultado abierto (IN-016).
- **Pruebas:** el analizador con 50 consultas; búsqueda < 50 ms en 10.000 elementos.

---

### IN-033 · Paleta de comandos

- **Catálogo:** BUS-03. · **Depende de:** IN-032. · **Ola:** 6 · **Tamaño:** S
- **Tareas:** `Ctrl+K` con acciones registradas por pantalla, elementos (vía búsqueda) y colecciones; navegación con teclado; últimas acciones primero.

---

### IN-034 · Mosaico y lista densa

- **Catálogo:** VIS-02, VIS-03. · **Depende de:** IN-027. · **Ola:** 6 · **Tamaño:** S
- **Tareas:** la `Tarjeta` de cada lector en mosaico, agrupada con cabeceras y recuentos; lista densa ordenable (tipo, título, fecha, colecciones, estado) con lista virtual; las dos disponibles en colecciones y resultados de búsqueda.

---

### IN-035 · Exportar ZIP y JSON

- **Catálogo:** DAT-03, DAT-05. · **Depende de:** IN-005, F0-2. · **Ola:** 6 · **Tamaño:** M
- **Tareas:**
  - [ ] ZIP completo en streaming con fflate en un Worker, con progreso (`<Senal estado="exportando">` y el porcentaje); sin `.rimor/cache/`; nombre `rimor-<espacio>-<fecha>.zip`.
  - [ ] Al terminar una exportación completa, `<Senal estado="copia-al-dia" veces={1}>` en el aviso y el piloto del raíl pasa a verde.
  - [ ] `manifest.json` con recuentos y hashes SHA-256 de cada archivo.
  - [ ] JSON único `{manifest, elementos, adjuntos}`: adjuntos ≤ 1 MB en base64; los demás, excluidos y listados en `manifest.adjuntos_excluidos`.
  - [ ] `Ctrl+E` y botón en Datos y copias; actualiza «última copia».
  - [ ] ZIP automático antes de operaciones destructivas (lo llaman IN-027, IN-036 e IN-060).
- **Pruebas:** propiedad: exportar → importar en un espacio vacío → exportar da archivos idénticos byte a byte.

---

### IN-036 · Importar ZIP y JSON

- **Catálogo:** DAT-04, SEG-04. · **Depende de:** IN-035, IN-029. · **Ola:** 6 · **Tamaño:** M
- **Tareas:**
  - [ ] Validación antes de escribir nada:
    - rutas sin `..` ni absolutas;
    - límites de tamaño descomprimido (por defecto 2 GB) y de número de archivos (50.000);
    - `manifest` y esquemas;
    - hashes.
  - [ ] Migración si el esquema es antiguo.
  - [ ] Vista previa: nuevos, idénticos, actualizados y en conflicto, con el detalle de cada conflicto.
  - [ ] Modos:
    - **fusionar:** por `id`; gana el más reciente y el otro va a `historial/`;
    - **reemplazar:** con ZIP previo automático;
    - **espacio nuevo.**
  - [ ] Choque de refs: reasignar la del importado, reescribir sus menciones y guardar `alias`.
  - [ ] Reindexado en segundo plano.
  - [ ] Final de la importación con `<Senal estado="guardado" veces={1}>`. Un rechazo usa `ErrorTarjeta` (con su animación `error`) y dice qué archivo y qué regla lo han provocado.
- **Pruebas:** corpus de ZIP maliciosos (zip slip, bomba, rutas absolutas, enlaces simbólicos) rechazados sin escribir nada; los tres modos con espacios de ejemplo.

---

### IN-037 · Datos y copias

- **Catálogo:** DAT-06 (interfaz), DAT-07. · **Depende de:** IN-007, IN-035. · **Ola:** 6 · **Tamaño:** S
- **Tareas:**
  - [ ] Pantalla con tres respuestas (cuánto ocupa, si está protegido y cuándo se copió) y «Exportar ZIP» (el único botón naranja de la app).
  - [ ] Piloto del raíl: verde con copia al día y ámbar al pasar el umbral. La animación `copia-al-dia` (IN-035) acompaña el cambio a verde.
  - [ ] Recordatorio tras 50 cambios o 7 días (configurable), como mensaje en Inicio, sin bloquear.
  - [ ] Plegados: otras exportaciones, recordatorio, espacios y papelera, y qué contiene el ZIP.

---

### IN-038 · Ajustes

- **Catálogo:** APP-04. · **Depende de:** IN-010, IN-016. · **Ola:** 6 · **Tamaño:** S
- **Tareas:** tema; idioma; detección (umbral de duda); secretos (reglas activas); respuestas por tipo (D14); copias (umbrales); red (vacío en v0.1, lo llena IN-041). Se guarda en `.rimor/ajustes.json`.

---

### IN-039 · Primer uso y espacio de ejemplo

- **Catálogo:** APP-03. · **Depende de:** IN-026, IN-036, IN-090. · **Ola:** 6 · **Tamaño:** S
- **Tareas:**
  - [ ] Bienvenida en el feed con `<Senal estado="primer-uso" veces={1}>` (logotipo y «del rumor a la conclusión»), qué es Rimor en dos frases y tres botones de ejemplo («Pega este log», «esta traza», «estas mediciones») que rellenan el compositor.
  - [ ] Espacio de ejemplo (la colección `gateway` del plan) como ZIP empaquetado, importable en modo «espacio nuevo» y que se puede borrar.
  - [ ] Petición de persistencia y sugerencia de instalar la PWA (cuando exista).

---

### IN-040 · Cierre de v0.1

- **Objetivo:** comprobar que la versión cumple lo prometido antes de usarla 4 semanas.
- **Depende de:** todas las anteriores. · **Ola:** 7 · **Tamaño:** M
- **Tareas:**
  - [ ] Presupuestos del plan (§14.7) medidos en la integración continua con archivos grandes generados.
  - [ ] Matriz de detección ≥ 90 % de acierto en los tipos de v0.1.
  - [ ] Recorrido de extremo a extremo completo en los tres motores: pegar → elemento → comparar → hilo → buscar → exportar → importar.
  - [ ] Auditoría de accesibilidad (axe y pasada manual con teclado y lector de pantalla).
  - [ ] Revisión de diseño de todas las pantallas contra el artefacto.
  - [ ] Revisión del movimiento: umbral de 400 ms, una animación por zona, movimiento reducido y símbolo «Señal» en todas partes.
  - [ ] Despliegue de la versión y registro de cambios.
- **Puerta de validación (4 semanas de uso real, plan §19):**
  - ≥ 5 capturas por día laborable;
  - ≥ 1 «esto ya te pasó» útil por semana;
  - lo buscado se encuentra en < 10 s;
  - menos de 1 de cada 10 respuestas se corrige o se descarta.

  Se mide con los contadores locales (IN-016).

---

## 9. v0.2 «Ver y agrupar»: fichas

**Objetivo de la versión:** que el caos se vea ordenado y se puedan explorar grupos y datos.

### IN-041 · Enlace enriquecido

- **Catálogo:** LEC-03b. · **Depende de:** IN-019, F0-7. · **Tamaño:** M
- **Tareas:**
  - [ ] Proveedores con interfaz común `Enriquecedor` (`acepta(url)`, `consultar(url) → Ficha`), solo los que F0-7 haya validado:
    - repositorio: GitHub, con token opcional;
    - paquetes: deps.dev, OSV, npm, crates.io y PyPI;
    - papers: Crossref y arXiv.
  - [ ] Ficha con fecha de consulta; «Volver a consultar» con diff de la ficha anterior.
  - [ ] Dominios visibles antes de la primera consulta y lista de dominios activados en Ajustes.
  - [ ] Sin red o con el dominio bloqueado, la ficha muestra `<Senal estado="sin-conexion">` con «Sin red: guardado sin enriquecer».
  - [ ] Respuestas enriquecidas: «Repositorio activo: último lanzamiento hace 12 días, licencia MIT.»
- **Aceptación:** sin red, el lector sigue funcionando como en v0.1; con red, solo consulta dominios activados.

### IN-042 · Diff y parche

- **Catálogo:** LEC-09b. · **Depende de:** IN-025. · **Tamaño:** S
- **Tareas:** detecta `diff --git` y `@@`; deriva archivos afectados y líneas añadidas y quitadas por archivo; vista lado a lado con resaltado; respuesta «Parche de 4 archivos: +120 −37.»

### IN-043 · Comando con huecos

- **Catálogo:** LEC-10. · **Depende de:** IN-023 (reutiliza «copiar con valores»). · **Tamaño:** S
- **Tareas:** detecta una línea con `$` o programa conocido; huecos `{{x}}`; tarjeta de chuleta; copiar con valores; respuesta «Comando con un hueco: {{baseline}}.»

### IN-044 · Datos tabulares con DuckDB

- **Catálogo:** LEC-11. · **Depende de:** IN-012, F0-5. · **Tamaño:** L
- **Tareas:**
  - [ ] Carga diferida de DuckDB-WASM en un Worker, con `<Senal estado="cargando">` y «DuckDB, solo la primera vez».
  - [ ] Añadir el estado `leyendo-datos` a `senal.css` (onda punteada que avanza, 0,8 s) y usarlo al perfilar o consultar.
  - [ ] CSV, TSV y Parquet como adjuntos.
  - [ ] Perfil por columna: tipo, nulos, únicos, mínimo, máximo, media, histograma y atípicos.
  - [ ] Vista previa de 5 filas; consulta SQL plegada con un editor CodeMirror y el modo SQL.
  - [ ] Gráfico rápido (con IN-058).
  - [ ] Comparación antes y después de dos conjuntos: filas, columnas y cambios de distribución.
  - [ ] Límite: por encima de lo medido en F0-5, se avisa y se trabaja con muestra.
  - [ ] Respuesta: «2400 filas y 6 columnas. Hay 17 latencias de 30 s y 20 nulos en bytes.»

### IN-045 · JSON, YAML y TOML con comparación estructural

- **Catálogo:** LEC-12, CMP-03. · **Depende de:** IN-028. · **Tamaño:** M
- **Tareas:** analizadores de los tres formatos (con `leyendo-datos` si tarda más de 400 ms); árbol plegable; esquema inferido; ruta al valor; comparación estructural (claves añadidas, quitadas y cambiadas) como elemento Comparación; versión anterior detectada al pegar («Frente a la versión del 9 oct cambian 2 claves»).

### IN-046 · Petición HTTP

- **Catálogo:** LEC-13. · **Depende de:** IN-010. · **Tamaño:** S
- **Tareas:** analiza cURL: método, URL, cabeceras y cuerpo, con secretos ocultos; vista en tabla; copiar como cURL o como `fetch`.

### IN-047 · Mediciones: más formatos y Hodges-Lehmann

- **Catálogo:** LEC-06 (v0.2). · **Depende de:** IN-022. · **Tamaño:** S
- **Tareas:** JSON de pytest-benchmark, JSON de JMH, `estimates.json` de criterion y columnas CSV; estimador de Hodges-Lehmann con intervalo, verificado contra referencias.

### IN-048 · Logs: plantillas con Drain

- **Catálogo:** LEC-04 (v0.2). · **Depende de:** IN-020. · **Tamaño:** M
- **Tareas:** algoritmo tipo Drain (árbol de prefijos con umbral de similitud) en el Worker para campos variables desconocidos; versión del lector sube y recalcula; comparación de logs con las nuevas plantillas.

### IN-049 · Reglas aprendidas y captura múltiple

- **Catálogo:** CAP-06, CAP-07. · **Depende de:** IN-013, IN-014. · **Tamaño:** M
- **Tareas:**
  - [ ] Si se corrige el tipo de contenidos parecidos tres veces, Rimor propone una regla («Los textos que empiezan por `[app]` son logs»). Las reglas se guardan en `.rimor/reglas-deteccion.json` y se pueden editar o borrar en Ajustes.
  - [ ] Un pegado con varias URL o varios bloques separados por líneas en blanco ofrece «Dividir en N elementos».

### IN-050 · PWA, sin conexión y compartir

- **Catálogo:** CAP-08, APP-06. · **Depende de:** IN-014. · **Tamaño:** M
- **Tareas:**
  - [ ] vite-plugin-pwa con precarga del núcleo y caché bajo demanda de los WASM.
  - [ ] Manifest con los iconos de IN-089 (`manifest-iconos.json`: app claro 192 y 512, maskable claro 192 y 512, y el SVG), `theme_color` `#E8E6E1` y `background_color` `#F6F5F1`.
  - [ ] Actualización con aviso «Hay una versión nueva».
  - [ ] Web Share Target (texto, URL y archivos) que abre el compositor relleno.
  - [ ] Instalación sugerida en el primer uso.
  - [ ] Añadir el estado `sin-conexion` a `senal.css` (onda discontinua, punto hueco, respiración lenta) y mostrarlo en el pie del raíl cuando no hay red.
- **Aceptación:** instalada en Android, el icono maskable no se recorta (zona segura del 80 %); en iOS, el `apple-touch-icon` de 180.

### IN-051 · Sesiones automáticas

- **Catálogo:** ORG-08. · **Depende de:** IN-026. · **Tamaño:** S
- **Tareas:** capturas separadas por menos de 45 minutos forman una sesión (`sesion` en el frontmatter); nombre propuesto desde la colección o las etiquetas dominantes, editable; tarjeta de sesión en el feed.

### IN-052 · Grupos automáticos y pantalla de colección

- **Catálogo:** ORG-09, VIS-04. · **Depende de:** IN-031, IN-051. · **Tamaño:** M
- **Tareas:** grupos por huella, dominio, repositorio, paquete, etiqueta, tipo y mes; panel común de grupo (qué hay, cuándo, qué se repite y elementos) como en la pantalla «Colección» del artefacto; acciones de grupo: crear investigación (desde v0.3), exportar ZIP y comparar seleccionados.

### IN-053 · Enlaces automáticos

- **Catálogo:** ORG-10. · **Depende de:** IN-012. · **Tamaño:** M
- **Tareas:** índice inverso de menciones (refs, paquetes y huellas) actualizado al guardar; «mencionado por» en los detalles del elemento; renombrar una ref actualiza sus menciones.

### IN-054 · Vistas guardadas

- **Catálogo:** ORG-11. · **Depende de:** IN-032. · **Tamaño:** S
- **Tareas:** guardar una búsqueda con nombre en `vistas.json`; aparece en el raíl bajo Colecciones con su recuento vivo.

### IN-055 · Inicio con memoria

- **Catálogo:** ORG-12. · **Depende de:** IN-051, IN-018. · **Tamaño:** S
- **Tareas:** tarjeta de la sesión del día anterior; lo que vuelve (ideas en v0.2; investigaciones con IN-068); recordatorio de copia como mensaje.

### IN-056 · Búsqueda: facetas, contenido derivado y parecidos

- **Catálogo:** BUS-04, BUS-05, BUS-06 (huella y etiquetas). · **Depende de:** IN-032. · **Tamaño:** M
- **Tareas:** facetas con recuento (tipo, colección, etiquetas y fechas), plegadas en «Afinar»; indexar el contenido derivado (líneas de logs, celdas, mensajes de error); «Buscar parecidos» desde un elemento por huella y etiquetas compartidas.

### IN-057 · Línea de tiempo y calendario

- **Catálogo:** VIS-05, VIS-06. · **Depende de:** IN-051. · **Tamaño:** M
- **Tareas:** carriles por tipo con sesiones sombreadas y zoom de horas a meses (pantalla «Línea de tiempo»); calendario de actividad con la escala `--heat-1` a `--heat-4`, filtrable por grupo.

### IN-058 · Gráficos de datos

- **Catálogo:** VIS-07. · **Depende de:** IN-044. · **Tamaño:** M
- **Tareas:** tema de Observable Plot (`rimor-diseno.md` §10); líneas, barras, dispersión e histograma desde datos y mediciones; descripción textual automática para `aria-label`.

### IN-059 · Métricas I

- **Catálogo:** MET-01, MET-02, MET-04, MET-06. · **Depende de:** IN-016, IN-030, IN-058. · **Tamaño:** M
- **Tareas:**
  - [ ] Pantalla Métricas y entrada en el raíl.
  - [ ] **Cifras que sigues:** el usuario fija una cifra citable y se dibuja con 3 mediciones o más; con menos, se dice cuántas faltan.
  - [ ] **Lo que más se repite:** errores por huella, con «con nota» o «sin nota».
  - [ ] **Qué capturas:** 8 semanas, barras apiladas.
  - [ ] **Lo que te ha ahorrado Rimor:** desde los contadores.
- **Aceptación:** ninguna tarjeta sin datos suficientes muestra una gráfica; cada tarjeta lleva a sus elementos.

### IN-060 · Varios espacios y exportación parcial

- **Catálogo:** DAT-09, DAT-10. · **Depende de:** IN-035, IN-036. · **Tamaño:** S
- **Tareas:** crear, cambiar, renombrar y borrar espacios (con ZIP previo); exportar una selección, colección o investigación con sus adjuntos y lo que referencian.

### IN-061 · Modo sin red

- **Catálogo:** SEG-03. · **Depende de:** IN-041. · **Tamaño:** S
- **Tareas:** interruptor en Ajustes que corta toda petición (incluido el enriquecimiento) y lo indica en el pie del raíl con `<Senal estado="sin-conexion">` y «Sin red».

### IN-062 · Cierre de v0.2

- **Tareas:** presupuestos, detección con los nuevos tipos, PWA instalada y sin conexión en los tres motores, revisión de diseño.
- **Puerta:** el autor resuelve al menos dos preguntas reales solo con las vistas («¿cuántas veces y cuándo falló X?», «¿qué cambió en esta configuración?»).

---

## 10. v0.3 «Investigar y escribir»: fichas

**Objetivo de la versión:** pasar de los elementos a una conclusión documentada.

### IN-063 · Sobre de terminal (CLI)

- **Catálogo:** CAP-09. · **Depende de:** IN-004, IN-014. · **Tamaño:** M
- **Tareas:** paquete `cli/` (Node, publicable en npm) con `rimor <comando>` que ejecuta, captura salida, código, directorio, commit y duración, y copia al portapapeles un sobre con cabecera propia; el detector lo reconoce primero (Anexo D) y el elemento guarda esos metadatos.

### IN-064 · Imagen y OCR

- **Catálogo:** CAP-10, LEC-14. · **Depende de:** IN-017. · **Tamaño:** M
- **Tareas:** miniatura; Tesseract.js en carga diferida (español e inglés), con el estado `procesando` (que esta IN añade a `senal.css`: la onda se dibuja y se borra, 2,2 s) y el progreso por página; texto extraído al índice; respuesta con el número de palabras reconocidas y una advertencia si la confianza es baja.

### IN-065 · PDF

- **Catálogo:** LEC-15. · **Depende de:** IN-017. · **Tamaño:** M
- **Tareas:** pdf.js: texto, metadatos y DOI detectado; visor con selección de fragmentos que se guardan como evidencia con número de página.

### IN-066 · Fórmula y diagrama

- **Catálogo:** LEC-16, LEC-17. · **Depende de:** IN-009. · **Tamaño:** S
- **Tareas:** KaTeX para `$$…$$` y `\begin{…}`; Mermaid y D2 (WASM) en carga diferida, con el SVG saneado; incrustables en documentos.

### IN-067 · Comparar varias series

- **Catálogo:** CMP-04. · **Depende de:** IN-028, IN-047. · **Tamaño:** S
- **Tareas:** de 3 a 8 series; comparación de cada una contra una de referencia elegida, con corrección por comparaciones múltiples (Holm), documentada.

### IN-068 · Resurgimiento completo

- **Catálogo:** ORG-13. · **Depende de:** IN-018, IN-070. · **Tamaño:** S
- **Tareas:** espaciado configurable (7, 30 y 90 días) para ideas e investigaciones abiertas; QF-09 como mensaje sin culpa («¿Aparcar?»).

### IN-069 · Tablero por estado y vecinos

- **Catálogo:** VIS-08, VIS-09. · **Depende de:** IN-053. · **Tamaño:** S
- **Tareas:** tablero por columnas de estado para ideas e investigaciones, con arrastre; vecinos directos de un elemento (misma huella, mencionado por, misma sesión y versiones), sin grafo global.

### IN-070 · Investigación

- **Catálogo:** INV-01 a INV-05, INV-08. · **Depende de:** IN-027, IN-031. · **Tamaño:** L
- **Tareas:**
  - [ ] Entidad `Investigacion` (Anexo B del plan): pregunta, estado, elementos con papel e interpretación, hipótesis y conclusión.
  - [ ] Crear desde una selección, una colección, una búsqueda, un hilo o una idea (activa los botones ocultos por la incoherencia 2).
  - [ ] Pantalla en una columna:
    - banner de «Qué falta» (IN-072);
    - evidencias con papel y una línea de interpretación;
    - decisión provisional;
    - plegados: qué falta, hipótesis y cronología automática.
  - [ ] Cierre: concluida, cancelada o aparcada, con una conclusión breve.
  - [ ] Papel de cada evidencia editable en un clic.
  - [ ] Añadir el estado `evidencia` a `senal.css` (línea naranja que une la onda con el punto, 2,6 s, una vez) y mostrarlo al vincular un elemento.

### IN-071 · Decisión y sensibilidad

- **Catálogo:** INV-06, VIS-11. · **Depende de:** IN-070. · **Tamaño:** M
- **Tareas:**
  - [ ] Matriz prellenada con criterios sugeridos por los tipos de evidencia (rendimiento si hay mediciones, fiabilidad si hay errores…).
  - [ ] Totales y sensibilidad exacta `wᵢ − D/dᵢ` (§11.2 del plan) en `dominio/sensibilidad.ts`.
  - [ ] Más de dos opciones contra la segunda; aviso de empates cercanos; criterio sin evidencia marcado.
- **Pruebas:** propiedad: poner el peso calculado produce empate exacto.

### IN-072 · Qué falta

- **Catálogo:** INV-07 (QF-01 a QF-10). · **Depende de:** IN-070, IN-071. · **Tamaño:** M
- **Tareas:** motor de reglas puro en `dominio/que-falta/`, una regla por archivo con su prueba; cada aviso con su acción; la frase fija «Que no falte nada… no garantiza que la investigación sea buena».

### IN-073 · Lienzo

- **Catálogo:** VIS-10. · **Depende de:** IN-070. · **Tamaño:** L
- **Tareas:** React Flow; tarjetas de elementos, notas y pregunta; flechas con papel (apoya, contradice, contexto); posiciones guardadas en la investigación; disposición inicial en círculo; accesible con teclado (mover con flechas).

### IN-074 · Editor y resolvedor de documentos

- **Catálogo:** DOC-01, DOC-02, DOC-03. · **Depende de:** IN-012, IN-066. · **Tamaño:** L
- **Tareas:**
  - [ ] CodeMirror 6 con Markdown, vista previa al lado y menú `/`.
  - [ ] Resolvedor (unified) de la sintaxis propia (§12.2 del plan): `[[REF]]`, `![[REF|vista]]{#fig:x}`, `{{REF.cifra}}` y `@fig:x`, usando las `incrustaciones` y `cifras` de cada lector.
  - [ ] Cifras vivas con valor fijado y aviso de desfase («antes −4,6 %, ahora −4,5 %») con aceptar o mantener.
  - [ ] Referencias rotas marcadas.
- **Pruebas:** el documento DOC-0002 del plan resuelve igual que en «Pantallas de Rimor».

### IN-075 · Plantillas y documento desde investigación

- **Catálogo:** DOC-04, DOC-05. · **Depende de:** IN-074, IN-070. · **Tamaño:** S
- **Tareas:** seis plantillas del Anexo F (informe, ADR MADR 4.0, postmortem, comparativa, cancelación y nota) en español e inglés (D10); generación desde investigación que rellena datos y deja huecos marcados, sin inventar texto.

### IN-076 · Exportación Markdown, HTML y PDF por impresión

- **Catálogo:** DOC-06, DOC-07. · **Depende de:** IN-074. · **Tamaño:** M
- **Tareas:** Markdown estándar más figuras (ZIP); HTML autocontenido con SVG en línea; hoja de estilos de impresión cuidada (márgenes, saltos, numeración y fuentes) para PDF desde el navegador; confirmación con `<Senal estado="guardado" veces={1}>`.

### IN-077 · Métricas II

- **Catálogo:** MET-03, MET-05, MET-07. · **Depende de:** IN-059, IN-074. · **Tamaño:** S
- **Tareas:** tiempo hasta resolver (desde los hilos resueltos), «Pendiente, sin prisa» con sus acciones y «Resumen de la semana» como documento.

### IN-078 · Importar Obsidian y Markdown suelto

- **Catálogo:** DAT-11. · **Depende de:** IN-036. · **Tamaño:** M
- **Tareas:** carpeta (selector de directorio o ZIP) de Markdown; cada archivo pasa por el detector; wikilinks conservados; frontmatter ajeno preservado en un campo `importado`.

### IN-079 · Cierre de v0.3

- **Puerta:** un informe real cuesta claramente menos que con el flujo actual: menos de 30 minutos desde la investigación hasta el documento exportado.

---

## 11. v0.4 «Publicar»: fichas

**Objetivo de la versión:** minipapers y documentos con calidad de publicación.

| IN | Tareas principales | Aceptación |
|---|---|---|
| **080** Cálculo con unidades (LEC-18) | Verificar el empaquetado web de Numbat (o alternativa en TS); expresiones con unidades y comprobación de dimensiones; cifras citables. | `3 MB / 120 ms` da `25 MB/s`; error claro al sumar metros y segundos. |
| **081** Búsqueda por significado (ORG-14, BUS-06) | transformers.js en un Worker con WebGPU o WASM y un modelo pequeño multilingüe empaquetado; embeddings en la caché; «parecidos a esto» e ideas parecidas. | Nada sale del navegador; indexar 10.000 elementos en segundo plano sin bloquear. |
| **082** Mapa afirmación × evidencia (VIS-12) | Afirmaciones del documento o de la investigación en filas y evidencias en columnas, con su papel. | Las afirmaciones sin evidencia saltan a la vista. |
| **083** Minipaper y numeración (DOC-08, DOC-13) | Plantilla de minipaper; numeración propia de ecuaciones, figuras y tablas antes de convertir (pandoc-wasm no admite pandoc-crossref). | Las referencias cruzadas salen bien numeradas en todas las salidas. |
| **084** Word y LaTeX (DOC-09) | pandoc-wasm en carga diferida y caché (`cargando` la primera vez y `procesando` al convertir); Markdown resuelto → `.docx` y `.tex` + `.bib`. | Salidas que abren sin errores en Word y compilan en Overleaf. |
| **085** PDF con Typst (DOC-10) | Solo si F0-4 fue positiva: pandoc → Typst → typst.ts con fuentes empaquetadas, con el estado `procesando`. | PDF correcto sin conexión. |
| **086** Bibliografía y verificador (DOC-11, DOC-12) | BibTeX desde enlaces a papers y DOI; estilos CSL (IEEE, APA, ACM); verificación de DOI en Crossref antes de exportar. | Las referencias que no se pueden comprobar quedan marcadas. |
| **087** Qué falta del documento y anexo reproducible (DOC-14, DOC-15) | QF-11 y QF-12; secciones vacías; ZIP con el documento, sus datos y sus comandos. | El anexo reproduce las cifras del documento. |
| **088** Cierre de v0.4 | Puerta de la versión. | Un minipaper con ecuaciones, figuras numeradas, bibliografía verificada y anexo reproducible se exporta a PDF y LaTeX. |

---

## 12. Después

Sin ficha hasta que se decida abordarlos:

| Bloque | Catálogo |
|---|---|
| IA opcional | IA-01 a IA-07 |
| Abrir archivos con Rimor | CAP-11 |
| Extensión de navegador | CAP-12 |
| Copia automática y espejo en carpeta del disco (Chromium) | DAT-12, DAT-13 |
| Integridad tipo cuaderno de laboratorio | Historial de solo añadir y sellos de tiempo RFC 3161 |
| Empaquetado de escritorio | Tauri, si hace falta |

---

## 13. Cobertura del catálogo

Cada ID del catálogo de `rimor-plan.md` (§7) y dónde se implementa.

| Catálogo | IN |
|---|---|
| CAP-01, CAP-02 | 014 |
| CAP-03 | 015 |
| CAP-04 | 013 |
| CAP-05 | 010 |
| CAP-06, CAP-07 | 049 |
| CAP-08 | 050 |
| CAP-09 | 063 |
| CAP-10 | 064 |
| CAP-11, CAP-12 | Después |
| CAP-13 | 015 |
| CAP-14 | 016 |
| LEC-01 | 017 |
| LEC-02 | 018 |
| LEC-03 | 019 |
| LEC-03b | 041 |
| LEC-04 | 020 (v0.1), 048 (v0.2) |
| LEC-05 | 021 |
| LEC-06 | 022 (v0.1), 047 (v0.2) |
| LEC-07 | 023 |
| LEC-08 | 024 |
| LEC-09 | 025 |
| LEC-09b | 042 |
| LEC-10 | 043 |
| LEC-11 | 044 |
| LEC-12 | 045 |
| LEC-13 | 046 |
| LEC-14 | 064 |
| LEC-15 | 065 |
| LEC-16, LEC-17 | 066 |
| LEC-18 | 080 |
| CMP-01 | 028 |
| CMP-02 | 029 |
| CMP-03 | 045 |
| CMP-04 | 067 |
| ORG-01 | 026 |
| ORG-02, ORG-03 | 031 |
| ORG-04 | 027 |
| ORG-05 | 014 |
| ORG-06 | 021, 030 |
| ORG-07 | 027 |
| ORG-08 | 051 |
| ORG-09 | 052 |
| ORG-10 | 053 |
| ORG-11 | 054 |
| ORG-12 | 055 |
| ORG-13 | 018 (mínimo), 068 (completo) |
| ORG-14 | 081 |
| ORG-15 | 030 |
| BUS-01, BUS-02 | 032 |
| BUS-03 | 033 |
| BUS-04, BUS-05 | 056 |
| BUS-06 | 056 (huella y etiquetas), 081 (significado) |
| VIS-01 | 012, 027 y cada lector |
| VIS-02, VIS-03 | 034 |
| VIS-04 | 052 |
| VIS-05, VIS-06 | 057 |
| VIS-07 | 058 |
| VIS-08, VIS-09 | 069 |
| VIS-10 | 073 |
| VIS-11 | 071 |
| VIS-12 | 082 |
| INV-01 a INV-05, INV-08 | 070 |
| INV-06 | 071 |
| INV-07 | 072 |
| DOC-01, DOC-02, DOC-03 | 074 |
| DOC-04, DOC-05 | 075 |
| DOC-06, DOC-07 | 076 |
| DOC-08, DOC-13 | 083 |
| DOC-09 | 084 |
| DOC-10 | 085 |
| DOC-11, DOC-12 | 086 |
| DOC-14, DOC-15 | 087 |
| DAT-01 | 004, 005 |
| DAT-02 | 006 |
| DAT-03, DAT-05 | 035 |
| DAT-04 | 036 |
| DAT-06 | 007, 037 |
| DAT-07 | 037 |
| DAT-08 | 029 |
| DAT-09, DAT-10 | 060 |
| DAT-11 | 078 |
| DAT-12, DAT-13 | Después |
| SEG-01, SEG-02 | 009 |
| SEG-03 | 061 |
| SEG-04 | 036 |
| APP-01 | 008 |
| APP-02 | 002 |
| APP-03 | 039 |
| APP-04 | 038 |
| APP-05 | 008 |
| APP-06 | 050 |
| APP-07 | 003 |
| MET-01, MET-02, MET-04, MET-06 | 059 |
| MET-03, MET-05, MET-07 | 077 |
| IA-01 a IA-07 | Después |
| Marca: símbolo «Señal», logotipo, favicon e iconos de app | 089 (y 050 para el manifest de la PWA) |
| Animaciones del símbolo | 090 (núcleo y estados de v0.1); 044, 050, 064 y 070 añaden los de v0.2 a v0.4 |

---

## 14. Estrategia de pruebas

| Nivel | Qué | Dónde | Cuándo corre |
|---|---|---|---|
| Unidades | Dominio, `paquetes/` y las funciones puras de cada lector | `*.test.ts` junto al código | Cada PR |
| Propiedades | Ida y vuelta de formato, ZIP, diff, ocultación idempotente, sensibilidad | fast-check | Cada PR |
| Referencias | Estadística contra SciPy y benchstat | `paquetes/estadistica/referencias/` | Cada PR |
| Corpus | Detección (matriz de confusión), secretos, XSS y ZIP maliciosos | `fixtures/` | Cada PR |
| Respuestas | Instantáneas por lector en `es` y `en`, más las reglas de estilo | `lectores/*/respuesta.test.ts` | Cada PR |
| Visual | `/muestras` y pantallas clave en claro, oscuro y a 400 px | Playwright, con tolerancia | Cada PR que toque `ui/` |
| Extremo a extremo | Recorridos completos en Chromium, Firefox y WebKit | Playwright | Cada PR (rápido) y cada noche (completo) |
| Rendimiento | Presupuestos del plan (§14.7) con archivos grandes generados | Playwright y scripts | Cada noche y en cada cierre |
| Accesibilidad | axe en cada pantalla, más una pasada manual en cada cierre | Playwright + axe | Cada PR |
| Movimiento | Cada estado de `Senal` contra su SVG original en cinco instantes y en los dos temas; sin animaciones con movimiento reducido; umbral de 400 ms | Playwright con `document.getAnimations()` y `setCurrentTime()` | Cada PR que toque `ui/marca/` |

**Corpus mínimo al cerrar v0.1:** 25 ejemplos reales por tipo de v0.1; 30 casos de referencia estadística; 40 secretos falsos y 100 líneas de log sin secretos; 20 cargas XSS; 10 ZIP maliciosos.

---

## 15. Riesgos de ejecución

| Riesgo | Señal temprana | Respuesta |
|---|---|---|
| OPFS lento o inestable en Safari | F0-1 por encima del objetivo | Adaptador con lotes y caché en memoria; limitar el número de archivos por carpeta |
| El detector no llega al 90 % | La matriz de IN-013 se estanca por debajo del 80 % al acabar la ola 4 | Ampliar el corpus con pegados reales del autor; ajustar pesos; más casos de «dos candidatos» antes que errores |
| Las respuestas de Rimor aburren o estorban | Más de 1 de cada 10 se descarta en la puerta | Recortar plantillas a lo que tenga dato nuevo; silenciar por tipo |
| La carga inicial pasa de 300 KB | Aviso de la integración continua | Más carga diferida (vistas de lectores, CodeMirror y Plot) |
| Olas en paralelo que chocan en `registro.ts` o en los estilos | Conflictos repetidos al fusionar | Registro por descubrimiento de carpetas (`import.meta.glob`) y componentes cerrados en IN-002 |
| Lectores de v0.2 a v0.4 subestimados | Ficha que no cabe en un ciclo L | Partir la IN antes del GATE#1, nunca durante la implementación |
| Las animaciones distraen o se multiplican | Dos bucles a la vez en una pantalla, o esperas que parpadean | Reglas de IN-090 comprobadas en la revisión de diseño; ante la duda, texto con progreso y sin animación |
| El paso de SMIL a CSS se desvía del original | La prueba de fidelidad de IN-090 supera el 1 % de diferencia | Ajustar el `@keyframes` contra el SVG de `ui/marca/referencia/`; el original manda |
