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
  });

  it('no cuentan los encabezados, los colores, los números ni lo que va en código', () => {
    const texto = '# Título\n## Otro\ncolor #fff y #a1b2c3, issue #123\n```\n#dentro\n```\nfuera #si';
    expect(etiquetasInferidas({ texto, tipo: 'markdown' })).toEqual(['si']);
    // Los niveles solo en un log.
    expect(etiquetasInferidas({ texto: 'ERROR en el texto', tipo: 'texto' })).toEqual([]);
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
      texto: 'Mirar #ureq en https://crates.io/crates/ureq para el gateway, sin prisa.',
      origen: 'pegado',
      etiquetas: ['ureq', 'pendiente'],
    });
    if (!r.ok || r.valor.tipo !== 'creado') throw new Error('no creado');
    expect(r.valor.capturado.elemento.frontmatter.etiquetas).toEqual(['ureq', 'pendiente']);
  });
});
