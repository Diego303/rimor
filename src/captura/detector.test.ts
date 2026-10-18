import type { TipoElemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import type { Entrada } from '../lectores/contrato';
import { lectorFalso } from '../lectores/pruebas/falsos';
import { crearRegistro } from '../lectores/registro';
import { type Ejemplo, evaluar, formatear } from './deteccion';
import { detectar, esEnlaceCompleto, MARGEN_DUDA, UMBRAL_DETECCION } from './detector';
import { firmaDe } from './firmas';

/** Lector falso de `tipo` que puntúa siempre `confianza` (o lo que diga la función). */
function puntua(nombre: string, tipo: TipoElemento, confianza: number | ((e: Entrada) => number)) {
  return lectorFalso({ nombre, tipo, detectar: typeof confianza === 'number' ? () => confianza : confianza });
}

const bytes = (...xs: (number | string)[]) =>
  new Uint8Array(xs.flatMap((x) => (typeof x === 'string' ? [...x].map((c) => c.charCodeAt(0)) : [x])));

describe('arbitraje', () => {
  it('gana el mayor por encima del umbral', () => {
    const r = crearRegistro([puntua('log', 'log', 0.9), puntua('error', 'error', 0.5)]);
    expect(detectar({ texto: 'x' }, r)).toMatchObject({ tipo: 'log', lector: 'log', confianza: 0.9, via: 'arbitraje' });
    expect(detectar({ texto: 'x' }, r).alternativa).toBeUndefined();
  });

  it('si el segundo queda a menos de 0,15, se ofrecen los dos (aunque no pase el umbral)', () => {
    const r = crearRegistro([puntua('log', 'log', 0.7), puntua('error', 'error', 0.6)]);
    expect(detectar({ texto: 'x' }, r)).toMatchObject({ tipo: 'log', alternativa: { tipo: 'error', confianza: 0.6 } });
    // Justo 0,15 de distancia ya no es duda (0,70 − 0,55 en coma flotante es 0,1499…).
    const justo = crearRegistro([puntua('log', 'log', 0.7), puntua('error', 'error', 0.55)]);
    expect(detectar({ texto: 'x' }, justo).alternativa).toBeUndefined();
  });

  it('si nadie pasa de 0,6, va a Texto (0,6 justo no pasa)', () => {
    const sinTexto = crearRegistro([puntua('log', 'log', UMBRAL_DETECCION)]);
    expect(detectar({ texto: 'x' }, sinTexto)).toMatchObject({ tipo: 'texto', lector: null, via: 'por-defecto' });
    const conTexto = crearRegistro([puntua('log', 'log', 0.3), puntua('texto', 'texto', 0.1)]);
    expect(detectar({ texto: 'x' }, conTexto)).toMatchObject({ tipo: 'texto', lector: 'texto' });
    expect(detectar({ texto: 'x' }, crearRegistro([]))).toMatchObject({ tipo: 'texto', lector: null });
  });

  it('a igual confianza gana el que va antes en el Anexo D', () => {
    const r = crearRegistro([puntua('error', 'error', 0.8), puntua('log', 'log', 0.8)]);
    expect(detectar({ texto: 'x' }, r)).toMatchObject({ tipo: 'error', alternativa: { tipo: 'log' } });
  });

  it('un lector que lanza, devuelve NaN o se sale de 0..1 no rompe nada', () => {
    const r = crearRegistro([
      puntua('error', 'error', () => {
        throw new Error('roto');
      }),
      puntua('log', 'log', Number.NaN),
      puntua('mediciones', 'mediciones', 7),
      puntua('json', 'json', -3),
    ]);
    const d = detectar({ texto: 'x' }, r);
    expect(d).toMatchObject({ tipo: 'mediciones', confianza: 1 });
    expect(d.puntuaciones.map((p) => p.confianza)).toEqual([1, 0, 0, 0]);
  });

  it('umbral y margen se pueden cambiar', () => {
    const r = crearRegistro([puntua('log', 'log', 0.55), puntua('error', 'error', 0.3)]);
    expect(detectar({ texto: 'x' }, r, { umbral: 0.5 }).tipo).toBe('log');
    expect(detectar({ texto: 'x' }, r, { umbral: 0.5, margen: 0.3 }).alternativa?.tipo).toBe('error');
    expect(MARGEN_DUDA).toBe(0.15);
  });
});

describe('atajos', () => {
  const r = crearRegistro([
    puntua('imagen', 'imagen', 0),
    puntua('pdf', 'pdf', 0),
    puntua('archivo', 'archivo', 0),
    puntua('enlace', 'enlace', 0),
    puntua('log', 'log', 0.99),
  ]);

  it('binarios por MIME o por firma (que manda sobre el MIME)', () => {
    expect(detectar({ mime: 'image/png' }, r)).toMatchObject({ tipo: 'imagen', via: 'atajo', confianza: 1 });
    expect(detectar({ mime: 'image/png' }, r, { cabecera: bytes('%PDF-1.7') }).tipo).toBe('pdf');
    expect(detectar({}, r, { cabecera: bytes('PAR1', 0, 0) }).tipo).toBe('archivo');
    const zip = new File([bytes(0x50, 0x4b, 3, 4)], 'datos.zip', { type: 'application/zip' });
    expect(detectar({ archivos: [zip] }, r).tipo).toBe('archivo');
    // Un archivo de texto no es un binario: decide el arbitraje.
    const txt = new File(['17:40 ERROR'], 'a.log', { type: 'text/plain' });
    expect(detectar({ archivos: [txt], texto: '17:40 ERROR' }, r).tipo).toBe('log');
  });

  it('URL o DOI completos, pero no un texto que solo contiene una URL', () => {
    expect(detectar({ texto: '  https://ejemplo.org/a?b=1  ' }, r)).toMatchObject({ tipo: 'enlace', via: 'atajo' });
    expect(detectar({ texto: '10.1145/3368089.3409741' }, r).tipo).toBe('enlace');
    expect(detectar({ texto: 'doi:10.48550/arXiv.2310.06825' }, r).tipo).toBe('enlace');
    expect(detectar({ texto: 'https://doi.org/10.1000/182' }, r).tipo).toBe('enlace');
    expect(detectar({ texto: 'mira https://ejemplo.org' }, r).tipo).toBe('log');
    expect(esEnlaceCompleto('https://a.org\nhttps://b.org')).toBe(false);
    expect(esEnlaceCompleto('ftp://a.org')).toBe(false);
  });

  it('sin el lector de destino no hay atajo', () => {
    const soloLog = crearRegistro([puntua('log', 'log', 0.2)]);
    expect(detectar({ texto: 'https://ejemplo.org' }, soloLog)).toMatchObject({ tipo: 'texto', via: 'por-defecto' });
    expect(detectar({ mime: 'image/png' }, soloLog).via).toBe('por-defecto');
  });
});

describe('firmas', () => {
  it('reconoce cada formato y no se equivoca con bytes cortos', () => {
    expect(firmaDe(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('png');
    expect(firmaDe(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('jpeg');
    expect(firmaDe(bytes('GIF89a'))).toBe('gif');
    expect(firmaDe(bytes('RIFF', 0, 0, 0, 0, 'WEBP'))).toBe('webp');
    expect(firmaDe(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
    expect(firmaDe(bytes('%PDF-'))).toBe('pdf');
    expect(firmaDe(bytes('PAR1'))).toBe('parquet');
    expect(firmaDe(bytes(0x50, 0x4b, 3, 4))).toBe('zip');
    expect(firmaDe(bytes(0x89, 'PN'))).toBeNull();
    expect(firmaDe(new Uint8Array())).toBeNull();
  });
});

describe('arnés', () => {
  it('calcula la matriz, el acierto por tipo y el total, y los fallos', () => {
    const r = crearRegistro([puntua('log', 'log', (e) => (e.texto?.includes('ERROR') ? 0.9 : 0))]);
    const corpus: Ejemplo[] = [
      { esperado: 'log', archivo: 'log/1.txt', texto: '17:40 ERROR' },
      { esperado: 'log', archivo: 'log/2.txt', texto: 'nada' },
      { esperado: 'texto', archivo: 'texto/1.txt', texto: 'prosa' },
    ];
    const ev = evaluar(corpus, r);
    expect(ev.matriz).toEqual({ log: { log: 1, texto: 1 }, texto: { texto: 1 } });
    expect(ev.aciertoPorTipo).toEqual({ log: 0.5, texto: 1 });
    expect(ev.acierto).toBeCloseTo(2 / 3);
    expect(ev.fallos).toEqual([{ archivo: 'log/2.txt', esperado: 'log', detectado: 'texto' }]);
    const tabla = formatear(ev);
    expect(tabla).toContain('Acierto total: 66,7 % de 3 ejemplos');
    expect(tabla).toContain('log/2.txt: log → texto');
  });
});
