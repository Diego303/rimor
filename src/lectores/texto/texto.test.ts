import { describe, expect, it } from 'vitest';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { enlacesDe, lectorTexto, mencionesDe, tituloDe } from './lector';

const ctx = (cambios: Partial<Contexto> = {}): Contexto => ({
  idioma: 'es',
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
  ...cambios,
});

describe('lector Texto', () => {
  it('título de la primera línea con contenido, sin marcas de Markdown', () => {
    expect(tituloDe('\n\n# Reunión con Ana\nresto')).toBe('Reunión con Ana');
    expect(tituloDe('- [x] tarea hecha')).toBe('tarea hecha');
    expect(tituloDe('> cita importante')).toBe('cita importante');
    expect(tituloDe('1. primer paso')).toBe('primer paso');
    expect(tituloDe('x'.repeat(200))).toHaveLength(120);
  });

  it('enlaces sin repetir y sin la puntuación final; paréntesis equilibrados', () => {
    expect(
      enlacesDe(
        'Mira https://ejemplo.org/a, y https://ejemplo.org/a. También (https://es.wikipedia.org/wiki/Rust_(lenguaje)).',
      ),
    ).toEqual(['https://ejemplo.org/a', 'https://es.wikipedia.org/wiki/Rust_(lenguaje)']);
    expect(enlacesDe('sin enlaces ni ftp://x.org')).toEqual([]);
  });

  it('menciones solo de refs de Rimor válidas', () => {
    expect(mencionesDe('Como en ERR-0015 y LOG-0042, ver DOC-MD-0004; ABC-1 y XYZ-0001 no; ERR-0015 otra vez')).toEqual(
      ['ERR-0015', 'LOG-0042', 'DOC-MD-0004'],
    );
  });

  it('deriva, resume y responde según el contexto', async () => {
    const el = elementoFalso(1, 'Nota sobre ERR-0015\nhttps://docs.rs/ureq\nmás texto', 'texto');
    const d = await lectorTexto.derivar(el);
    expect(d).toEqual({ lineas: 3, palabras: 6, enlaces: ['https://docs.rs/ureq'], menciones: ['ERR-0015'] });
    expect(lectorTexto.resumenLegible?.(lectorTexto.resumen(d), 'es')).toBe('3 líneas · 1 enlace');
    expect(
      lectorTexto
        .respuesta(el, d, ctx())
        .texto.map((f) => ('v' in f ? f.v : f.ref))
        .join(''),
    ).toBe('Texto guardado. Menciona ERR-0015.');
    const conColeccion = lectorTexto.respuesta(el, d, ctx({ colecciones: ['gateway'], idioma: 'en' }));
    expect(conColeccion.texto.map((f) => ('v' in f ? f.v : '')).join('')).toBe(
      'Text saved. Shall I add it to the gateway collection?',
    );
    expect(conColeccion.acciones?.map((a) => a?.etiqueta)).toEqual(['Yes, to gateway', 'No']);
    const sinNada = await lectorTexto.derivar(elementoFalso(2, 'solo texto', 'texto'));
    expect(lectorTexto.respuesta(el, sinNada, ctx()).texto).toEqual([{ t: 'texto', v: 'Texto guardado.' }]);
  });

  it('lee con el título y el resumen provisional', async () => {
    expect(await lectorTexto.leer({ texto: '## Idea\nuna\n' })).toEqual({
      titulo: 'Idea',
      original: '## Idea\nuna\n',
      resumen: { lineas: 2 },
    });
    expect(lectorTexto.detectar({ texto: 'algo' })).toBe(0.1);
    expect(lectorTexto.detectar({ texto: '  ' })).toBe(0);
  });
});
