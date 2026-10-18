import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { conCsp, hashesDeScripts, politica } from './csp.mjs';

const HTML =
  '<!doctype html><html><head><meta charset="utf-8"><title>R</title><script>var a=1;</script>' +
  '<script type="module" src="/_astro/x.js"></script></head><body><script type="module">import("/y.js")</script></body></html>';

const hash = (s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`;

describe('csp.mjs', () => {
  it('calcula los hashes de los scripts en línea, no de los externos', () => {
    expect(hashesDeScripts(HTML)).toEqual([hash('var a=1;'), hash('import("/y.js")')]);
  });

  it('inserta la meta tras <meta charset>, antes de cualquier script, y la sustituye si ya estaba', () => {
    const una = conCsp(HTML);
    expect(una.indexOf('Content-Security-Policy')).toBeLessThan(una.indexOf('<script'));
    expect(una.indexOf('<meta charset="utf-8">')).toBeLessThan(una.indexOf('Content-Security-Policy'));
    const dos = conCsp(una);
    expect(dos.match(/Content-Security-Policy/g)).toHaveLength(1);
    expect(dos).toBe(una);
  });

  it('la política es estricta para scripts y abre solo los dominios de enriquecimiento', () => {
    const p = politica(HTML);
    expect(p).toContain(`script-src 'self' ${hash('var a=1;')}`);
    expect(p).not.toMatch(/script-src[^;]*unsafe/);
    expect(p).toContain("object-src 'none'");
    expect(p).toContain("connect-src 'self' https://api.github.com");
  });
});
