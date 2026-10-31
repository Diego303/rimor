/**
 * Presupuestos de tiempo de la ocultación de secretos (IN-046): corre en el proyecto `rendimiento`, solo y después
 * del resto (`pnpm test`), porque mide tiempo de reloj.
 */
import { describe, expect, it } from 'vitest';
import { ocultar } from './ocultar';

describe('secretos de una petición: rendimiento', () => {
  it('curl -u en textos enormes es lineal (antes, cuadrático: segundos)', () => {
    for (const texto of [
      'curl '.repeat(20_000),
      'curl -b a '.repeat(20_000),
      'curl x \\\n'.repeat(20_000),
      `[${Array.from({ length: 2500 }, (_, i) => `{"ua":"curl/7.81.0","i":${i},"msg":"petición servida sin errores"}`).join(',')}]`,
    ]) {
      const inicio = performance.now();
      ocultar(texto);
      expect(performance.now() - inicio, texto.slice(0, 20)).toBeLessThan(500);
    }
  });
});
