# ADR-0003 · Decisiones abiertas adoptadas

- **Estado:** adoptada, revisable por el autor
- **Fecha:** 2026-10-18

## Contexto

`rimor-implementacion.md` §2.1 lista decisiones abiertas que bloquean funcionalidades. El autor no está disponible, así que se adoptan con la propuesta del plan (prompt maestro §11).

## Decisiones

| # | Decisión | Adoptado |
|---|---|---|
| D5 | Licencia | **Sin decidir.** No se añade archivo de licencia; queda en «Pendientes de validación humana». |
| D6 | Router | TanStack Router con historial por hash (ADR-0002). |
| D13 | ¿Un elemento en varios hilos? | No: un elemento, un solo hilo. Moverlo pide confirmación. |
| D14 | ¿Desactivar respuestas por tipo? | Sí, desde Ajustes. |
| D15 | Gestor de paquetes | pnpm con workspaces (ADR-0001). |
| D16 | Resaltado de sintaxis | Analizadores Lezer de CodeMirror, sin Shiki. |
| D17 | Lista virtual | `@tanstack/react-virtual`. |
| D18 | Animaciones del símbolo | Los SVG SMIL son la especificación; se portan a `@keyframes` CSS en un SVG en línea. |

## Consecuencias

Cada decisión puede revisarla el autor; las fichas que dependen de ellas citan este ADR.
