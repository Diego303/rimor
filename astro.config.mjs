// @ts-check
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// GitHub Pages publica bajo /<repositorio>/: el flujo de despliegue fija SITIO y BASE (ADR-0002).
export default defineConfig({
  ...(process.env.SITIO ? { site: process.env.SITIO } : {}),
  base: process.env.BASE ?? '/',
  output: 'static',
  integrations: [react()],
  devToolbar: { enabled: false },
  vite: {
    plugins: [tailwindcss()],
    worker: { format: 'es' },
  },
});
