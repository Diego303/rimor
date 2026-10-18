# ADR-0005 · Política de seguridad de contenido

- **Estado:** aceptada
- **Fecha:** 2026-10-18

## Contexto y problema

SEG-02 pide una CSP estricta: `default-src 'self'`, sin `unsafe-eval` y red solo para las APIs de enriquecimiento activadas. La app se publica en GitHub Pages, que no permite cabeceras HTTP propias, y Astro añade scripts en línea para hidratar la isla.

## Decisión

1. **CSP en `<meta http-equiv>`**, insertada por `scripts/csp.mjs` al final de `pnpm build`, antes de cualquier script de cada HTML.
2. **`script-src 'self'` más el hash SHA-256 de cada script en línea**, calculado sobre el HTML final. Sin `unsafe-inline` ni `unsafe-eval` para scripts.
3. **Solo en la construcción:** en desarrollo, Vite necesita scripts en línea para la recarga en caliente.
4. **`style-src 'self' 'unsafe-inline'`:** CodeMirror, KaTeX y Mermaid crean `<style>` en tiempo de ejecución y una web estática no puede usar *nonces*. El contenido pegado nunca puede traer estilos (el saneado quita `style` y `<style>`).
5. **`connect-src` fijo con todos los dominios de enriquecimiento de F0-7:** una `<meta>` no cambia tras cargar la página. Qué dominios se consultan lo decide la capa de red de la app según Ajustes y el modo sin red (IN-041, IN-061).
6. **WebAssembly:** cuando llegue el primer módulo WASM (IN-044), se añadirá `'wasm-unsafe-eval'` a `script-src`, que solo permite compilar WebAssembly, no `eval` de JavaScript.
7. Directivas sin efecto en `<meta>` (`frame-ancestors`, `report-uri`) no se usan.

## Consecuencias

- La CSP protege aunque el hosting no ayude; si algún día hay cabeceras, el mismo texto puede ir en ellas.
- Cualquier script en línea nuevo (en `Base.astro` o de Astro) queda autorizado automáticamente por su hash; uno inyectado después de construir, no.
