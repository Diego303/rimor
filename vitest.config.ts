import { getViteConfig } from 'astro/config';
import { configDefaults } from 'vitest/config';

// Proyectos: la app hereda la configuración de Vite de Astro; sus `.test.ts` corren en Node (dominio puro)
// y sus `.test.tsx`, en happy-dom (componentes). Cada paquete trae su propia configuración.
export default getViteConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'node',
          include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
          exclude: [...configDefaults.exclude, 'src/**/*.rendimiento.test.ts'],
          setupFiles: ['./src/pruebas/preparar-motor.ts'],
        },
      },
      // Los presupuestos de tiempo de reloj: `pnpm test` los corre después del resto, solos (si no, con todos los
      // workers ocupados, medirían la máquina).
      {
        extends: true,
        test: {
          name: 'rendimiento',
          environment: 'node',
          include: ['src/**/*.rendimiento.test.ts'],
          setupFiles: ['./src/pruebas/preparar-motor.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'app-dom',
          environment: 'happy-dom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/pruebas/preparar-dom.ts', './src/pruebas/preparar-motor.ts'],
        },
      },
      './paquetes/*/vitest.config.ts',
    ],
  },
});
