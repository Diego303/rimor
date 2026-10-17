# ADR-0001 · Estructura del repositorio

- **Estado:** aceptada
- **Fecha:** 2026-10-18

## Contexto y problema

El plan (`rimor-implementacion.md` §6.1) supone un monorepo nuevo con `app/` hecho con Vite + React. El repositorio ya tenía una web base de Astro 5 en la raíz: la plantilla «basics» sin contenido propio (una página de bienvenida, un layout y dos SVG). Hay que decidir dónde vive la app y cómo se traducen las rutas del plan.

## Factores de decisión

- No empezar de cero y no romper la base de Astro.
- `paquetes/formato` y `paquetes/estadistica` deben poder usarse desde Node (pruebas y, en v0.3, la CLI) sin depender del navegador.
- Comandos únicos en la raíz (`pnpm verificar`).

## Opciones consideradas

1. Mover Astro a `app/` y dejar la raíz como orquestador.
2. Astro en la raíz como paquete de la app y paquetes del workspace al lado.

## Decisión

**Opción 2.** Monorepo pnpm (`pnpm-workspace.yaml`): la raíz es la app (Astro); `paquetes/estadistica`, `paquetes/formato` y, desde v0.3, `cli/` son paquetes del workspace que la app consume como `@rimor/estadistica`, `@rimor/formato` y `@rimor/cli`. Mover Astro a `app/` no aporta nada a un repositorio con una sola app y obligaría a duplicar configuración.

### Equivalencias de rutas

| Plan | Repositorio |
|---|---|
| `app/src/rutas/` | `src/rutas/` |
| `app/src/ui/` (tema, componentes, gráficas, marca, muestras) | `src/ui/` |
| `app/src/estado/`, `dominio/`, `captura/`, `respuestas/` | `src/estado/`, `src/dominio/`, `src/captura/`, `src/respuestas/` |
| `app/src/lectores/<tipo>/` | `src/lectores/<tipo>/` |
| `app/src/almacen/`, `busqueda/`, `documentos/`, `seguridad/`, `i18n/`, `workers/` | `src/almacen/`, `src/busqueda/`, `src/documentos/`, `src/seguridad/`, `src/i18n/`, `src/workers/` |
| `app/public/marca/` | `public/marca/` |
| `app/index.html` | `src/pages/index.astro` (+ `src/layouts/`) |
| `paquetes/estadistica/`, `paquetes/formato/` | igual |
| `cli/` | igual (v0.3) |
| `fixtures/` | igual |

`src/pages/` y `src/layouts/` son de Astro; el resto de `src/` es la app React.

## Consecuencias

- Positivas: una sola configuración de Vite (la de Astro), un solo `tsconfig` base y los scripts de comprobación en la raíz.
- Negativas: la raíz mezcla la app y la orquestación del workspace; se acepta porque solo hay una app.
