// @ts-check

import { readFileSync } from 'node:fs';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// GitHub Pages publica bajo /<repositorio>/: el flujo de despliegue fija SITIO y BASE (ADR-0002).
export default defineConfig({
  ...(process.env.SITIO ? { site: process.env.SITIO } : {}),
  base: process.env.BASE ?? '/',
  output: 'static',
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    // Versión de la app para el manifest de cada espacio (plan Anexo A).
    define: { __VERSION_APP__: JSON.stringify(version) },
    worker: { format: 'es' },
  },
});
