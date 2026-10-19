import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { REGISTRO } from '../lectores/registro';
import { etiquetasInferidas, MAX_INFERIDAS } from './etiquetas';
import { crearCapturador } from './flujo';

describe('etiquetas inferidas', () => {
  it('hashtags, dominios, paquetes, lenguaje y niveles', () => {
    expect(
      etiquetasInferidas({ texto: 'Probar #ureq y #Streaming con https://www.github.com/x/y', tipo: 'texto' }),
    ).toEqual(['ureq', 'streaming', 'github.com']);
    expect(
      etiquetasInferidas({
        texto:
          'Ver https://www.npmjs.com/package/@tanstack/react-router y https://pypi.org/project/httpx/ y https://crates.io/crates/reqwest',
        tipo: 'texto',
      }),
    ).toEqual(['@tanstack/react-router', 'httpx', 'reqwest']);
    expect(etiquetasInferidas({ texto: 'fn main() {}', tipo: 'codigo', resumen: { lenguaje: 'Rust' } })).toEqual([
      'rust',
    ]);
    expect(etiquetasInferidas({ texto: '10:00 INFO ok\n10:01 WARN lento\n10:02 ERROR caído', tipo: 'log' })).toEqual([
      'error',
      'warn',
    ]);
    // Como los lee el lector Log: logfmt y JSON, y no la palabra ERROR dentro del mensaje de una INFO.
    expect(etiquetasInferidas({ texto: 'ts=1 level=error msg=x\n{"level":"warn","msg":"y"}', tipo: 'log' })).toEqual([
      'error',
      'warn',
    ]);
    expect(etiquetasInferidas({ texto: '2026-10-17T10:00:00Z INFO no hay ERROR aquí', tipo: 'log' })).toEqual([]);
    expect(etiquetasInferidas({ texto: '¿#pregunta? y #tag-', tipo: 'texto' })).toEqual(['pregunta', 'tag']);
    const enlaces =
      'http://localhost:8080/a http://192.168.1.10/b https://pkg.go.dev/github.com/foo/bar@v1.2.3 https://pkg.go.dev/search?q=x';
    expect(etiquetasInferidas({ texto: enlaces, tipo: 'texto' })).toEqual(['github.com/foo/bar']);
  });

  it('no cuentan los encabezados, los colores, los números ni lo que va en código', () => {
    const texto = '# Título\n## Otro\ncolor #fff y #a1b2c3, issue #123\n```\n#dentro\n```\nfuera #si';
    expect(etiquetasInferidas({ texto, tipo: 'markdown' })).toEqual(['si']);
    // Los niveles solo en un log.
    expect(etiquetasInferidas({ texto: 'ERROR en el texto', tipo: 'texto' })).toEqual([]);
    // En código, `#` es una directiva o un comentario; tampoco en código en línea ni en directivas.
    expect(etiquetasInferidas({ texto: '#include <stdio.h>\nx = 1  #todo', tipo: 'codigo' })).toEqual([]);
    expect(etiquetasInferidas({ texto: 'Usa `git log #rama`\n#define X 1\ny #bien', tipo: 'texto' })).toEqual(['bien']);
  });

  it('como mucho ocho, sin repetir', () => {
    const texto = Array.from({ length: 20 }, (_, i) => `#tema${i} #tema${i}`).join(' ');
    expect(etiquetasInferidas({ texto, tipo: 'texto' })).toHaveLength(MAX_INFERIDAS);
  });
});

describe('la captura las guarda', () => {
  it('con las manuales del compositor, sin repetir', async () => {
    const repositorio = new Repositorio(new AlmacenMemoria());
    const capturador = crearCapturador({ repositorio, registro: REGISTRO });
    const r = await capturador.capturar({
      texto: 'Mirar #ureq en https://crates.io/crates/ureq y https://GitHub.com/algo para el gateway, sin prisa.',
      origen: 'pegado',
      etiquetas: ['Ureq', 'pendiente', 'GitHub.com'],
    });
    if (!r.ok || r.valor.tipo !== 'creado') throw new Error('no creado');
    // Las manuales primero, con sus mayúsculas; de las inferidas, solo lo que no repiten.
    expect(r.valor.capturado.elemento.frontmatter.etiquetas).toEqual(['Ureq', 'pendiente', 'GitHub.com']);
    const otra = await capturador.capturar({ texto: 'Leer #pendiente en https://docs.rs/x', origen: 'pegado' });
    if (!otra.ok || otra.valor.tipo !== 'creado') throw new Error('no creado');
    expect(otra.valor.capturado.elemento.frontmatter.etiquetas).toEqual(['pendiente', 'docs.rs']);
  });
});
