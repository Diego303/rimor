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
| `paquetes/formato` | Esquemas y formato de archivos (esqueleto) | 001 |
| `paquetes/estadistica` | Estadística de mediciones (esqueleto) | 001 |
| `scripts/` | Comprobación de colores, tamaño de la carga inicial y seguimiento | 001 |

## Flujos

Se describen a medida que llegan: captura (IN-014), derivados (IN-012), búsqueda (IN-032) y exportación (IN-035).

## Despliegue

GitHub Pages bajo `/<repositorio>/`: `.github/workflows/pages.yml` construye con `SITIO` y `BASE` y publica `dist/`. La app enruta por hash (ADR-0002), así que no necesita reescrituras.
