# ADR-0002 · La app dentro de Astro

- **Estado:** aceptada
- **Fecha:** 2026-10-18

## Contexto y problema

Rimor es una aplicación de una sola página, local y sin servidor (P6), que se publicará en GitHub Pages (instrucción del autor del 2026-10-18). Astro está pensado para sitios de contenido con islas. Hay que decidir cómo encaja una SPA con estado, Workers y OPFS.

## Decisión

- **Salida estática** (`output: 'static'`) con la integración `@astrojs/react`.
- **Una sola isla React** con `client:only="react"`, montada a pantalla completa en `/`: la web base era una plantilla vacía, así que la app ocupa la portada. Un solo árbol React para toda la app.
- **Enrutado interno por hash** con TanStack Router (`createHashHistory`): funciona en cualquier hosting estático sin reescrituras, también en GitHub Pages bajo `/<repositorio>/`.
- **Ruta base configurable:** `astro.config.mjs` lee `SITIO` y `BASE` del entorno; el flujo de despliegue de GitHub Pages las fija. Todo recurso público se pide con `import.meta.env.BASE_URL`.
- **Estado** (Zustand), **Workers** y **OPFS** viven dentro de la isla. Los Workers se crean con `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })` y se llaman con Comlink.
- **Estilos:** Tailwind v4 con `@tailwindcss/vite` en `vite.plugins`, más las hojas propias de componentes. Tokens en `src/ui/tema/tokens.css`.
- **CSP** en un `<meta http-equiv="Content-Security-Policy">` del layout (GitHub Pages no permite cabeceras propias).
- **PWA** con `@vite-pwa/astro` (IN-050).
- **Pruebas:** Vitest con `getViteConfig` de `astro/config` para la app y configuración propia en cada paquete. Las de extremo a extremo con Playwright contra `pnpm preview` quedan aplazadas por instrucción del autor (ver seguimiento).
- `/muestras` es una ruta interna (`#/muestras`) registrada solo en desarrollo.

## Consecuencias

- Positivas: despliegue trivial en GitHub Pages; Astro aporta el HTML inicial, la CSP y los iconos, y la app se comporta como una SPA normal.
- Negativas: no se aprovecha el renderizado en servidor de Astro (no hace falta) y las URL internas llevan `#/`.
