import { describe, expect, it } from 'vitest';
import { analizarIndicaciones as a } from './indicaciones';

type Caso = [texto: string, esperado: Partial<ReturnType<typeof a>>];

const SON: Caso[] = [
  ['nota rápida @gateway', { cuerpo: 'nota rápida', colecciones: ['gateway'], etiquetas: [] }],
  ['nota #rust', { cuerpo: 'nota', etiquetas: ['rust'] }],
  ['nota @gateway #rust #http', { cuerpo: 'nota', colecciones: ['gateway'], etiquetas: ['rust', 'http'] }],
  ['línea 1\nlínea 2\n@gateway #rust', { cuerpo: 'línea 1\nlínea 2', colecciones: ['gateway'], etiquetas: ['rust'] }],
  ['texto\n\n@a @b', { cuerpo: 'texto', colecciones: ['a', 'b'] }],
  ['texto\n  #uno   #dos  ', { cuerpo: 'texto', etiquetas: ['uno', 'dos'] }],
  ['/log 17:40 ERROR algo', { tipo: 'log', cuerpo: '17:40 ERROR algo' }],
  ['/error\nthread main panicked', { tipo: 'error', cuerpo: 'thread main panicked' }],
  ['/med 38.4 ms\n39.0 ms', { tipo: 'mediciones', cuerpo: '38.4 ms\n39.0 ms' }],
  ['/MD # Título', { tipo: 'markdown', cuerpo: '# Título' }],
  ['/url https://ejemplo.org @lecturas', { tipo: 'enlace', cuerpo: 'https://ejemplo.org', colecciones: ['lecturas'] }],
  ['/idea', { tipo: 'idea', cuerpo: '' }],
  ['/texto hola #saludo', { tipo: 'texto', cuerpo: 'hola', etiquetas: ['saludo'] }],
  ['?timeout gateway', { busqueda: 'timeout gateway', cuerpo: '' }],
  ['  ?  latencia  ', { busqueda: 'latencia' }],
  ['idea @gateway/http', { colecciones: ['gateway/http'], cuerpo: 'idea' }],
  ['idea #v0.2', { etiquetas: ['v0.2'] }],
  ['idea @métricas-rápidas', { colecciones: ['métricas-rápidas'] }],
  ['repetida @a @a #b #b', { colecciones: ['a'], etiquetas: ['b'] }],
  ['/codigo\nfn main() {}\n#rust', { tipo: 'codigo', cuerpo: 'fn main() {}', etiquetas: ['rust'] }],
  ['nota @gateway #2024', { cuerpo: 'nota', colecciones: ['gateway'], etiquetas: ['2024'] }],
  [
    'fallo login @gateway #error #cafe',
    { cuerpo: 'fallo login', colecciones: ['gateway'], etiquetas: ['error', 'cafe'] },
  ],
  ['@gateway #rust', { cuerpo: '', colecciones: ['gateway'], etiquetas: ['rust'] }],
  ['/idea @gateway', { tipo: 'idea', cuerpo: '', colecciones: ['gateway'] }],
  ['/texto\n@a', { tipo: 'texto', cuerpo: '', colecciones: ['a'] }],
];

const NO_SON: Caso[] = [
  ['escríbeme a ana@empresa.com mañana', { cuerpo: 'escríbeme a ana@empresa.com mañana', colecciones: [] }],
  ['escríbeme a ana@empresa.com', { colecciones: [] }],
  ['/var/log/syslog: error al arrancar', { cuerpo: '/var/log/syslog: error al arrancar' }],
  ['/usr/bin/env python3', { cuerpo: '/usr/bin/env python3' }],
  ['/desconocido algo', { cuerpo: '/desconocido algo' }],
  ['/log/x algo', { cuerpo: '/log/x algo' }],
  ['#include <stdio.h>\nint main() {}\n#endif', { etiquetas: [] }],
  ['int x;\n#pragma once', { etiquetas: [] }],
  ['```rust\nfn main() {}\n#tag', { etiquetas: [] }],
  ['color: #fff', { etiquetas: [], cuerpo: 'color: #fff' }],
  ['background:\n#1e90ff', { etiquetas: [] }],
  ['# Título de un documento', { etiquetas: [], cuerpo: '# Título de un documento' }],
  ['## Sección\ntexto', { etiquetas: [] }],
  ['menciono @pepe en mitad del texto', { colecciones: [] }],
  ['la issue #123 está abierta', { etiquetas: [] }],
  ['línea\n@gateway y algo más', { colecciones: [] }],
  ['línea\nemail@dominio.com', { colecciones: [] }],
  ['?', { cuerpo: '?' }],
  ['¿qué tal? #', { etiquetas: [] }],
  ['C# es un lenguaje', { etiquetas: [] }],
];

describe('analizarIndicaciones', () => {
  it.each(SON)('son indicaciones: %j', (texto, esperado) => {
    expect(a(texto)).toMatchObject(esperado);
  });

  it.each(NO_SON)('no son indicaciones: %j', (texto, esperado) => {
    const r = a(texto);
    expect(r).toMatchObject(esperado);
    expect(r.tipo).toBeUndefined();
    expect(r.busqueda).toBeUndefined();
  });

  it('es lineal con muchas indicaciones en mitad de un texto enorme', () => {
    const texto = `${'@a #b '.repeat(40_000)}fin`;
    const t0 = performance.now();
    expect(a(texto).colecciones).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('hay al menos 40 casos', () => {
    expect(SON.length + NO_SON.length).toBeGreaterThanOrEqual(40);
  });
});
