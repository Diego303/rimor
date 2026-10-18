# Arquitectura de Rimor

Mapa vivo de módulos, capas y flujos. Se actualiza cada vez que una IN añade o cambia un módulo.

## Capas

```
Astro (salida estática)  src/pages/index.astro → <App client:only="react" />
└── Isla React (src/app/App.tsx): el único árbol React
    ├── Interfaz        src/rutas/, src/ui/
    ├── Estado          src/estado/ (Zustand)
    ├── Dominio         src/dominio/, src/captura/, src/respuestas/, src/lectores/  (TS puro)
    ├── Almacén y caché src/almacen/ (OPFS, memoria, IndexedDB)
    └── Workers         src/workers/ (Comlink)
Paquetes del workspace   paquetes/formato, paquetes/estadistica (TS puro, también en Node)
```

## Módulos

| Módulo | Qué hace | IN |
|---|---|---|
| `src/app/App.tsx` | Raíz de la isla | 001 |
| `src/layouts/Base.astro` | HTML base | 001 |
| `src/seguridad/sanear.ts` | Saneado de Markdown, HTML y SVG con `rehype-sanitize` (esquema propio) | 009 |
| `src/seguridad/secretos/` | Reglas de secretos y `ocultar` (puro, idempotente), con su corpus | 010 |
| `src/ui/componentes/MarkdownSeguro.tsx` | Única forma de pintar Markdown pegado (carga diferida) | 009 |
| `scripts/csp.mjs` | CSP en `<meta>` con hashes de los scripts en línea, tras construir | 009 |
| `src/rutas/` | Router por hash, `Carcasa`, `Rail`, `Pantalla`, `LimiteErrores` y una carpeta por pantalla | 008 |
| `src/estado/espacio.ts` | Store de lo que pinta la carcasa (espacio, recuentos, colecciones, copia) | 008 |
| `src/ui/atajos/` | Gestor de atajos (puro), hook y ayuda | 008 |
| `src/ui/tema/` | Tokens, Tailwind sin preflight, base, fuentes, preferencia de tema y contraste | 002 |
| `src/ui/componentes/` | Componentes base con las clases de las pantallas (ADR-0004) | 002 |
| `src/ui/iconos/` | Iconos de las pantallas y aspecto de cada tipo | 002 |
| `src/ui/marca/` | Geometría del símbolo, `SimboloRimor`, `Logotipo`, `Senal` (animaciones con `senal.css`) y `useEsperaVisible` | 089, 090 |
| `public/marca/` | Favicon, PNG de app y `manifest-iconos.json` (salida de `pnpm marca`) | 089 |
| `src/ui/muestras/` | Página `#/muestras`, solo en desarrollo | 002 |
| `src/i18n/` | Catálogos `es` y `en`, `traducir` y `t` con claves tipadas, `useT`, idioma inicial y formateadores | 003 |
| `src/almacen/` | Contrato `Almacen`, adaptadores en memoria y OPFS, cola de escrituras, `Repositorio` y coordinación de pestañas | 005 |
| `src/almacen/cache/` | `CacheEspacio` (IndexedDB), `reconciliar` y compresión gzip | 006 |
| `src/workers/almacen.worker.ts` | OPFS con accesos síncronos, expuesto con Comlink | 005 |
| `src/espacio/` | `abrirEspacio` (pestañas, huérfanos, manifest, caché y repositorio), `.rimor/estado.json`, persistencia, `ProveedorEspacio` con la pantalla de arranque y los avisos del almacenamiento | 007 |
| `src/lectores/` | Contrato `Lector<D>` (núcleo puro), textos por lector, registro en el orden del Anexo D, `ColaDerivados`, ejecutor en Worker, vistas por convención (`import.meta.glob` + `React.lazy`), `VistaElemento`, `TarjetaElemento` y `_plantilla/` | 012 |
| `src/lectores/texto/`, `src/lectores/archivo/` | Lectores Texto (Markdown saneado, enlaces, menciones) y genérico de archivo (adjunto, descarga, `pendiente_lector`) | 017 |
| `src/respuestas/` | Tipos de la respuesta (012); contexto, composición con la frase de secretos, reglas de estilo, `RespuestaRimor`, `useRespuesta` y contadores locales (`.rimor/contadores.json`) | 012, 016 |
| `src/espacio/ajustes.ts` | `.rimor/ajustes.json` (por ahora, respuestas desactivadas por tipo) | 016 |
| `src/workers/derivados.worker.ts` | `derivar` de cada lector fuera del hilo principal, con Comlink | 012 |
| `src/captura/` | Detector de tipo (atajos del Anexo D y arbitraje con duda), firmas de binarios y arnés de la matriz de detección; flujo de captura (`capturar`, `crearCapturador`, deshacer), borrador del compositor, indicaciones, vista previa y `ProveedorCaptura` (pegar y soltar) | 013, 014, 015 |
| `src/ui/componentes/Compositor.tsx` | Compositor de Inicio: área que crece, Enter guarda, vista previa, autocompletar, adjuntos, modo respuesta | 015 |
| `fixtures/deteccion/` | Corpus de detección: una carpeta por tipo con sus ejemplos | 013 |
| `src/i18n/motor.ts` | Motor de textos sin catálogos (plurales, `{x}`, números), común a la app y los lectores | 012 |
| `paquetes/formato` | Esquemas Valibot, `.md` de elementos (frontmatter fiel, notas y original), ULID, refs, rutas, SHA-256 y migraciones | 004 |
| `paquetes/estadistica` | Descriptiva, IC de la mediana, Mann-Whitney, comparación, avisos de método; referencias de SciPy | 011 |
| `scripts/` | Comprobación de colores y de textos sin traducir, tamaño de la carga inicial y seguimiento | 001, 003 |

## Flujos

### Apertura de un espacio (IN-005, IN-006, IN-007)

```
ProveedorEspacio ── dependencias: OPFS (Worker) + ColaEscrituras, o memoria si OPFS falla
   │
   ▼ abrirEspacio
coordinarPestanas (Web Locks) ─▶ escritor: limpiarHuerfanos · manifest.json (se crea si falta)
   │                                         · .rimor/estado.json (persistencia, copia, cambios)
   ▼
almacén ──listar──▶ reconciliar ◀──frontmatters── CacheEspacio (IndexedDB)
                        │ lee solo lo nuevo o cambiado (ruta, tamaño, fecha), con progreso
                        ▼
         Repositorio.cargarDesde(entradas) ──alCambiar──▶ cambios desde la copia + useEspacio (raíl)
```

Mientras abre, la pantalla de arranque (`Senal` «arranque» y después «cargando»); si el manifest no se entiende, un error y nada se escribe.

### Derivados de un elemento (IN-012)

```
VistaElemento ──pedir(visible)──▶ ColaDerivados ──¿en caché (id, lector, versión, hash)?──▶ sí: datos
                                      │ no: cola (visible primero, de uno en uno, cancelable)
                                      ▼
                         Worker de derivados: lector.derivar(el)
                                      │
                 guardarDerivado ◀────┴────▶ alDerivar: resumen nuevo → frontmatter (solo la pestaña que escribe)
                                      ▼
                     Vista.tsx del lector (diferida) con los datos
```

### Captura (IN-014)

```
pegar fuera de un campo ──▶ useCompositor (borrador) ──▶ compositor (IN-015) ──┐
soltar archivos ──────────────────────────────────────────────────────────────┴─▶ capturador (de una en una)
  1 normalizar (≤ 50 MB; texto o bytes + cabecera) → 2 ocultar secretos → 3 detectar (o /tipo)
  → 4 duplicado por hash (se avisa y no se crea) → 5 indicaciones → 6 leer, adjunto, ref, guardar
  → 7 el repositorio avisa (raíl, feed) → 8 derivados de fondo (respuesta de IN-016)
```

Se describen a medida que llegan: búsqueda (IN-032) y exportación (IN-035).

## Despliegue

GitHub Pages bajo `/<repositorio>/`: `.github/workflows/pages.yml` construye con `SITIO` y `BASE` y publica `dist/`. La app enruta por hash (ADR-0002), así que no necesita reescrituras.
