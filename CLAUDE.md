# Rimor
- Antes de nada, lee docs/seguimiento.md (sección «Cómo retomar») y el prompt maestro (docs/prompt-maestro.md).
- Especificación de solo lectura en docs/referencias/. Nunca la modifiques.
- pnpm siempre (nunca npm, npx ni yarn). Comprobación completa: pnpm verificar.
- Rama develop. Commit al final de cada fase (análisis y diseño, implementación, verificación). Nunca push, amend, rebase, reset --hard ni cambio de rama.
- Cada fase actualiza docs/seguimiento.md y, si hay cambios visibles, CHANGELOG.md.
- No preguntes: decide con el plan y regístralo.
- Instrucción del autor (2026-10-18): la web se publica en GitHub Pages; por ahora sin Playwright (ni e2e ni capturas); revisa y verifica el código varias veces tras cada funcionalidad. Lo visual debe igualar `docs/referencias/Pantallas de Rimor.html` (su CSS es la referencia de medidas).
- Al compactar, conserva: IN y fase actuales, archivos tocados en la fase, último resultado de pnpm verificar y decisiones pendientes de registrar.
