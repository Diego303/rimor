/**
 * Toda clase que pinta el JSX tiene su regla en algún `.css` de `src/` (IN-040): una clase de la referencia que se
 * usa sin portar su CSS (pasó con `.day` y `.dp`) se ve con los estilos del navegador sin que nada falle.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = join(process.cwd(), 'src');

/** Clases sin estilo propio a propósito: ganchos de pruebas o de estructura. */
const SIN_ESTILO = new Set([
  'ajustes', // la tarjeta de Ajustes: el estilo es el de `.card`
  'ajustes-copia', // el plegado de copias dentro de Ajustes: el de `.list`
  'linea', // cada línea del código (la cuentan las pruebas)
  'lista-versiones', // la lista de versiones: la de `.kv`
]);

function archivos(dir: string, ext: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta, ext);
    return e.name.endsWith(ext) ? [ruta] : [];
  });
}

/** El texto de una plantilla con cada `${…}` (con sus llaves anidadas) cambiado por `#`. */
function sinInterpolaciones(plantilla: string): string {
  let fuera = '';
  let nivel = 0;
  for (let i = 0; i < plantilla.length; i++) {
    const c = plantilla[i];
    if (nivel === 0 && c === '$' && plantilla[i + 1] === '{') {
      fuera += '#';
      nivel = 1;
      i++;
    } else if (nivel > 0) {
      if (c === '{') nivel++;
      else if (c === '}') nivel--;
    } else fuera += c;
  }
  return fuera;
}

/** Las clases literales de `className="…"`, de `className={`…`}` y de los argumentos de `clases(…)`. */
function clasesUsadas(tsx: string): string[] {
  const usadas: string[] = [];
  for (const m of tsx.matchAll(/className="([^"]+)"/g)) usadas.push(...(m[1] ?? '').split(/\s+/));
  // De una plantilla, sin lo que va dentro de `${…}` y solo las palabras enteras (no `senal-${estado}`).
  for (const m of tsx.matchAll(/className=\{`([^`]+)`\}/g))
    usadas.push(
      ...sinInterpolaciones(m[1] ?? '')
        .split(/\s+/)
        .filter((c) => /^[a-zA-Z][\w-]*[a-zA-Z0-9]$/.test(c)),
    );
  // Solo los argumentos (`'x'`, `c && 'x'`), no los lados de una comparación (`tono !== 'neutro'`).
  for (const m of tsx.matchAll(/clases\(([^)]*)\)/g))
    for (const a of (m[1] ?? '').matchAll(/(?:^|[(,]|&&)\s*'([^']+)'/g)) usadas.push(...(a[1] ?? '').split(/\s+/));
  return usadas.filter(Boolean);
}

describe('clases con CSS', () => {
  it('cada clase del JSX tiene su regla', () => {
    const css = archivos(RAIZ, '.css')
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    const definidas = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    const sinRegla = new Map<string, string>();
    for (const f of archivos(RAIZ, '.tsx')) {
      if (f.includes('.test.') || f.includes(`${join('ui', 'muestras')}`)) continue;
      for (const c of clasesUsadas(readFileSync(f, 'utf8')))
        if (!definidas.has(c) && !SIN_ESTILO.has(c)) sinRegla.set(c, f.slice(RAIZ.length + 1));
    }
    expect(Object.fromEntries(sinRegla)).toEqual({});
  }, 30_000);
});
