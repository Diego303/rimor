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
| `src/ui/marca/` | Geometría del símbolo, `SimboloRimor` y `Logotipo` | 089 |
| `public/marca/` | Favicon, PNG de app y `manifest-iconos.json` (salida de `pnpm marca`) | 089 |
| `src/ui/muestras/` | Página `#/muestras`, solo en desarrollo | 002 |
| `src/i18n/` | Catálogos `es` y `en`, `traducir` y `t` con claves tipadas, `useT`, idioma inicial y formateadores | 003 |
| `src/almacen/` | Contrato `Almacen`, adaptadores en memoria y OPFS, cola de escrituras, `Repositorio` y coordinación de pestañas | 005 |
| `src/almacen/cache/` | `CacheEspacio` (IndexedDB), `reconciliar` y compresión gzip | 006 |
| `src/workers/almacen.worker.ts` | OPFS con accesos síncronos, expuesto con Comlink | 005 |
| `paquetes/formato` | Esquemas Valibot, `.md` de elementos (frontmatter fiel, notas y original), ULID, refs, rutas, SHA-256 y migraciones | 004 |
| `paquetes/estadistica` | Descriptiva, IC de la mediana, Mann-Whitney, comparación, avisos de método; referencias de SciPy | 011 |
| `scripts/` | Comprobación de colores y de textos sin traducir, tamaño de la carga inicial y seguimiento | 001, 003 |

## Flujos

### Apertura de un espacio (IN-005, IN-006)

```
almacén (OPFS en Worker) ──listar──▶ reconciliar ◀──frontmatters── CacheEspacio (IndexedDB)
                                        │ lee solo lo nuevo o cambiado (ruta, tamaño, fecha)
                                        ▼
                         Repositorio.cargarDesde(entradas)  (índice id/ref → ruta)
```

Se describen a medida que llegan: captura (IN-014), derivados (IN-012), búsqueda (IN-032) y exportación (IN-035).

## Despliegue

GitHub Pages bajo `/<repositorio>/`: `.github/workflows/pages.yml` construye con `SITIO` y `BASE` y publica `dist/`. La app enruta por hash (ADR-0002), así que no necesita reescrituras.
