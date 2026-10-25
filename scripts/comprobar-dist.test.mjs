import { describe, expect, it } from 'vitest';
import { validarCsp } from './comprobar-dist.mjs';

const base = (scriptSrc) =>
  `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'none'`;

describe('validarCsp', () => {
  it('acepta la política de Rimor', () => {
    expect(validarCsp(base("'self' 'sha256-abc='"))).toEqual([]);
  });

  it('rechaza comodines, esquemas y unsafe-* en script-src y directivas débiles', () => {
    expect(validarCsp(base("'self' *")).length).toBeGreaterThan(0);
    expect(validarCsp(base("'self' https: data:")).length).toBeGreaterThan(0);
    expect(validarCsp(base("'self' 'unsafe-hashes' 'sha256-a='")).length).toBeGreaterThan(0);
    expect(validarCsp(base("'self' 'unsafe-eval'")).length).toBeGreaterThan(0);
    expect(validarCsp(base("'self' 'unsafe-inline'")).length).toBeGreaterThan(0);
    // Compilar WebAssembly (DuckDB, IN-044) sí.
    expect(validarCsp(base("'self' 'wasm-unsafe-eval' 'sha256-abc='"))).toEqual([]);
    expect(validarCsp(base("'self'").replace("default-src 'self'", "default-src 'self' *")).length).toBeGreaterThan(0);
  });
});
