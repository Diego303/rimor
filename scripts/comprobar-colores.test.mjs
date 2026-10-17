import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { buscarColores, comprobarCarpeta } from './comprobar-colores.mjs';

const SCRIPT = fileURLToPath(new URL('./comprobar-colores.mjs', import.meta.url));

describe('buscarColores', () => {
  it('rechaza un hexadecimal en un componente', () => {
    const r = buscarColores("export const Boton = () => <b style={{ color: '#EE4F1F' }} />;");
    expect(r).toEqual([{ linea: 1, regla: 'hexadecimal', valor: '#EE4F1F' }]);
  });

  it('rechaza funciones de color, colores con nombre y clases de paleta de Tailwind', () => {
    expect(buscarColores('a { color: rgba(0, 0, 0, .1) }')).toHaveLength(1);
    expect(buscarColores('b { color: hsl(10 20% 30%) }')).toHaveLength(1);
    expect(buscarColores('c { color: oklch(0.7 0.2 30) }')).toHaveLength(1);
    expect(buscarColores("const s = { color: 'red', backgroundColor: 'white' };")).toHaveLength(2);
    expect(buscarColores('d { background: black }')).toHaveLength(1);
    expect(
      buscarColores('<div className="bg-orange-500 text-red-600 divide-red-500 caret-blue-400 bg-white" />'),
    ).toHaveLength(5);
  });

  it('acepta tokens, anclas, entidades, rutas y la exención explícita', () => {
    expect(buscarColores('a { color: var(--key) }')).toEqual([]);
    expect(buscarColores('<a href="#add">x</a> <a href={"#cafe"}>y</a>')).toEqual([]);
    expect(buscarColores("navegar('#/e/LOG-0042'); const x = '&#123;'; const id = '#fig-1';")).toEqual([]);
    expect(buscarColores('<p>texto de color rojo, backgrounds y colorear</p>')).toEqual([]);
    expect(buscarColores('<meta name="theme-color" content="#E8E6E1" /> <!-- rimor-permitir-color -->')).toEqual([]);
  });
});

describe('comprobarCarpeta y la orden', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function espacio(archivos) {
    dir = mkdtempSync(join(tmpdir(), 'colores-'));
    for (const [ruta, contenido] of Object.entries(archivos)) {
      mkdirSync(join(dir, ruta, '..'), { recursive: true });
      writeFileSync(join(dir, ruta), contenido);
    }
  }

  it('exime tokens.css y las pruebas, y falla con un hexadecimal en un componente', () => {
    espacio({
      'ui/tema/tokens.css': ':root { --key: #EE4F1F; }',
      'ui/x.test.tsx': "expect('#EE4F1F')",
      'ui/componentes/Boton.tsx': "export const c = '#191919';",
    });
    expect(comprobarCarpeta(dir).map((h) => h.archivo)).toEqual([join('ui', 'componentes', 'Boton.tsx')]);
    const r = spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('Boton.tsx:1');
  });

  it('termina bien si solo hay tokens', () => {
    espacio({ 'ui/tema/tokens.css': ':root { --key: #EE4F1F; }', 'ui/a.css': '.a { color: var(--key) }' });
    expect(spawnSync(process.execPath, [SCRIPT, dir]).status).toBe(0);
  });
});
