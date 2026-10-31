// @ts-check

import { readFileSync } from 'node:fs';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';
import { defineConfig } from 'astro/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const { icons } = JSON.parse(readFileSync(new URL('./public/marca/manifest-iconos.json', import.meta.url), 'utf8'));

/**
 * PWA (IN-050): service worker propio (`src/pwa/sw.ts`) con la precarga del núcleo, sin DuckDB (79 MB, que se guarda
 * la primera vez que se usa), y el manifest con los iconos de IN-089 y el destino de «Compartir».
 */
const pwa = AstroPWA({
  strategies: 'injectManifest',
  srcDir: 'src/pwa',
  filename: 'sw.ts',
  registerType: 'prompt',
  // El registro y el aviso de versión nueva son propios (`src/pwa/registrar.ts`).
  injectRegister: false,
  includeManifestIcons: false,
  manifest: {
    name: 'Rimor',
    short_name: 'Rimor',
    description: 'Rimor: del rumor a la conclusión.',
    lang: 'es',
    display: 'standalone',
    start_url: './',
    scope: './',
    // El manifest no admite variables CSS: son --app y --bg en claro (tokens.css).
    theme_color: '#E8E6E1', // rimor-permitir-color
    background_color: '#F6F5F1', // rimor-permitir-color
    icons: icons.map((/** @type {{ src: string }} */ i) => ({ ...i, src: `marca/${i.src}` })),
    share_target: {
      action: 'compartir',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { title: 'titulo', text: 'texto', url: 'url', files: [{ name: 'archivos', accept: ['*/*'] }] },
    },
  },
  injectManifest: {
    globPatterns: ['**/*.{html,js,css,woff2,svg,png,json,webmanifest}'],
    globIgnores: ['**/*.wasm', '**/duckdb/**', '**/duckdb-browser-*.worker*.js'],
    // El chunk principal pasa de los 2 MB por defecto de Workbox.
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
  },
  devOptions: { enabled: false },
});

// GitHub Pages publica bajo /<repositorio>/: el flujo de despliegue fija SITIO y BASE (ADR-0002).
export default defineConfig({
  ...(process.env.SITIO ? { site: process.env.SITIO } : {}),
  base: process.env.BASE ?? '/',
  output: 'static',
  integrations: [react(), pwa],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Versión de la app para el manifest de cada espacio (plan Anexo A).
    define: { __VERSION_APP__: JSON.stringify(version) },
    worker: {
      format: 'es',
      // Los recursos de los Workers con el mismo nombre que los del hilo principal: el `.wasm` de DuckDB (34 MB) que
      // usan los dos es un solo archivo y se descarga una vez (IN-044).
      rollupOptions: { output: { assetFileNames: '_astro/[name].[hash][extname]' } },
    },
  },
});
