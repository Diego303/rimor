#!/usr/bin/env node
// `pnpm deteccion` (IN-013): pasa el detector por el corpus de fixtures/deteccion/ e imprime la matriz de
// confusión y el acierto por tipo. Es la misma prueba que corre en `pnpm test`, con el informe activado.
import { spawnSync } from 'node:child_process';

const r = spawnSync('pnpm', ['exec', 'vitest', 'run', '--project', 'app', 'src/captura/deteccion.test.ts'], {
  stdio: 'inherit',
  env: { ...process.env, DETECCION_INFORME: '1' },
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
