import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validarCsp, validarPwa } from './comprobar-dist.mjs';
import { conRevisionPortada } from './csp.mjs';

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

describe('validarPwa (IN-050)', () => {
  const iconos = [{ src: 'rimor-app-claro-192.png' }, { src: 'favicon.svg' }];
  const manifest = {
    theme_color: '#E8E6E1', // rimor-permitir-color
    background_color: '#F6F5F1', // rimor-permitir-color
    icons: [{ src: 'marca/rimor-app-claro-192.png' }, { src: 'marca/favicon.svg' }],
    share_target: {
      action: 'compartir',
      method: 'POST',
      enctype: 'multipart/form-data',
      params: { files: [{ name: 'archivos', accept: ['*/*'] }] },
    },
  };
  const sw = '[{"revision":"a1","url":"/"},{"revision":null,"url":"_astro/App.x.js"}]';

  it('acepta el manifest y la precarga de Rimor', () => {
    expect(validarPwa(manifest, iconos, sw)).toEqual([]);
    expect(validarPwa(manifest, iconos, sw, '/rimor/')).toEqual(['el service worker no precarga la portada (/rimor/)']);
    // La revisión de la portada tiene que ser la del archivo publicado (con su CSP).
    const portada = '<html>con CSP</html>';
    const md5 = createHash('md5').update(portada, 'utf8').digest('hex');
    expect(validarPwa(manifest, iconos, sw, '/', portada)).toEqual([
      'la revisión de la portada en la precarga no es la del index.html publicado (¿sin la CSP?)',
    ]);
    expect(validarPwa(manifest, iconos, conRevisionPortada(sw, '/', portada), '/', portada)).toEqual([]);
    expect(conRevisionPortada(sw, '/', portada)).toContain(`{"revision":"${md5}","url":"/"}`);
    // Una entrada dos veces impediría instalarlo.
    expect(validarPwa(manifest, iconos, `${sw},{"revision":null,"url":"_astro/App.x.js"}`)).toContain(
      'el service worker precarga una entrada dos veces',
    );
  });

  it('rechaza otros colores, iconos que faltan, otro destino de compartir y DuckDB en la precarga', () => {
    const fallos = validarPwa(
      { ...manifest, theme_color: '#FFFFFF', icons: [], share_target: { action: 'x', method: 'GET' } }, // rimor-permitir-color
      iconos,
      `${sw},{"revision":null,"url":"_astro/duckdb-eh.abc.wasm"}`,
    );
    expect(fallos).toEqual([
      'el manifest debe llevar theme_color #E8E6E1', // rimor-permitir-color
      'al manifest le falta el icono marca/rimor-app-claro-192.png',
      'al manifest le falta el icono marca/favicon.svg',
      'el manifest debe llevar share_target POST multipart a «compartir»',
      'el share_target debe aceptar archivos («archivos»)',
      'el service worker precarga _astro/duckdb-eh.abc.wasm (DuckDB va bajo demanda)',
    ]);
    expect(validarPwa(manifest, iconos, '')).toContain('el service worker no precarga nada');
  });
});
