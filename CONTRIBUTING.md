# Cómo contribuir

Rimor se desarrolla con el método SDD de Struo, funcionalidad a funcionalidad.

## Unidades de trabajo

Cada funcionalidad es una **IN-NNN** de `docs/referencias/rimor-implementacion.md` y pasa por tres fases, cada una con su commit:

1. **Analizar y diseñar:** ficha en `docs/features/IN-NNN-nombre.md` (objetivo, estado de partida, diseño, tareas, pruebas, aceptación, riesgos) y autorrevisión. Commit `docs(IN-NNN): …`.
2. **Implementar:** dominio puro primero, con sus pruebas; después la interfaz. Commit `feat(IN-NNN): …`.
3. **Verificar:** `pnpm verificar`, criterios de aceptación uno a uno con su evidencia y revisión independiente. Commit `test(IN-NNN): …`.

Las decisiones de arquitectura van en `docs/adr/` (MADR) y el estado de todo en `docs/seguimiento.md`.

## Reglas

- **pnpm siempre** (nunca npm, npx ni yarn).
- TypeScript estricto. `dominio/`, `paquetes/` y las funciones `detectar`, `leer`, `derivar` y `respuesta` de cada lector son TS puro: sin React, sin DOM y sin almacenamiento.
- Textos de interfaz solo por clave de i18n (`es` y `en`).
- Colores, radios y sombras solo por token (`src/ui/tema/tokens.css`); `pnpm lint` rechaza los literales.
- Los casos esperados devuelven `Resultado<T, ErrorRimor>`; no se lanza.
- Mensajes de commit en Conventional Commits, en español, con el ID como ámbito.
