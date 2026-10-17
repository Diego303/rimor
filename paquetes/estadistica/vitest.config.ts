import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { name: 'estadistica', environment: 'node', include: ['src/**/*.test.ts'] } });
