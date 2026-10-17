import { getViteConfig } from 'astro/config';

// Proyectos: la app hereda la configuración de Vite de Astro; sus `.test.ts` corren en Node (dominio puro)
// y sus `.test.tsx`, en happy-dom (componentes). Cada paquete trae su propia configuración.
export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'app', environment: 'node', include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'] },
      },
      {
        extends: true,
        test: {
          name: 'app-dom',
          environment: 'happy-dom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/pruebas/preparar-dom.ts'],
        },
      },
      './paquetes/*/vitest.config.ts',
    ],
  },
});
