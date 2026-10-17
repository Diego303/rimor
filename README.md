# Rimor

Rimor es una app web, local y privada, para técnicos e investigadores: pegas cualquier cosa (un log, un error, unas mediciones, un enlace, un prompt, un plan en Markdown, una idea) y Rimor entiende qué es, lo analiza, lo ordena con lo demás y te ayuda a convertirlo en conclusiones, decisiones, informes y minipapers.

*Del rumor a la conclusión.*

- **Local y privada:** todo vive en el almacenamiento privado del navegador (OPFS). Sin cuenta, sin servidor y sin telemetría.
- **Tus datos son archivos tuyos:** Markdown con metadatos, exportable en ZIP.
- **Se publica como web estática** en GitHub Pages.

## Requisitos

- Node 22 o superior (se desarrolla con Node 24).
- pnpm 12 (`corepack enable` o `npm i -g pnpm` una sola vez). En este proyecto se usa **solo pnpm**.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm install` | Instala las dependencias del workspace |
| `pnpm dev` | Servidor de desarrollo en `http://localhost:4321` |
| `pnpm build` | Construcción estática en `dist/` |
| `pnpm preview` | Sirve `dist/` para probar la construcción |
| `pnpm typecheck` | Tipos (`astro check` y cada paquete) |
| `pnpm lint` | Biome y la comprobación de colores fuera de los tokens |
| `pnpm test` | Pruebas de Vitest de la app y los paquetes |
| `pnpm verificar` | Todo lo anterior más el tamaño de la carga inicial |

## Estructura

```
src/            la app: una isla React dentro de Astro (ver docs/arquitectura.md)
paquetes/       @rimor/formato y @rimor/estadistica (TS puro, sin navegador)
scripts/        herramientas del repositorio (comprobaciones, seguimiento)
docs/           referencias, ADR, fichas de funcionalidades, Fase 0 y seguimiento
```

## Documentación

- [Seguimiento del proyecto](docs/seguimiento.md)
- [Arquitectura](docs/arquitectura.md)
- [Decisiones de arquitectura (ADR)](docs/adr/)
- [Fichas de funcionalidades](docs/features/) y [Fase 0](docs/f0/)
- Especificación: [plan](docs/referencias/rimor-plan.md), [diseño](docs/referencias/rimor-diseno.md) e [implementación](docs/referencias/rimor-implementacion.md)
- [Cómo contribuir](CONTRIBUTING.md) · [Registro de cambios](CHANGELOG.md)

## Licencia

Pendiente de decidir por el autor.
