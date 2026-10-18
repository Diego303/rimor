import type { TipoElemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import type { Entrada } from '../lectores/contrato';
import { lectorFalso } from '../lectores/pruebas/falsos';
import { crearRegistro } from '../lectores/registro';
import { type Ejemplo, evaluar, formatear } from './deteccion';
import { detectar, entradaDeArchivo, esEnlaceCompleto, MARGEN_DUDA, UMBRAL_DETECCION } from './detector';
import { decodificarTexto, firmaDe, pareceTexto } from './firmas';

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

  it('sin lector de enlaces, una URL la decide el arbitraje', () => {
    const soloLog = crearRegistro([puntua('log', 'log', 0.2)]);
    expect(detectar({ texto: 'https://ejemplo.org' }, soloLog)).toMatchObject({ tipo: 'texto', via: 'por-defecto' });
  });

  it('un binario sin su lector va al genérico de archivo y, sin él, a ninguno (nunca a Texto)', () => {
    const v01 = crearRegistro([puntua('archivo', 'archivo', 0), puntua('texto', 'texto', 0)]);
    const png = bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a);
    expect(detectar({ mime: 'image/png' }, v01, { cabecera: png })).toMatchObject({
      tipo: 'archivo',
      lector: 'archivo',
      via: 'atajo',
    });
    expect(detectar({}, v01, { cabecera: bytes('%PDF-1.4') })).toMatchObject({ tipo: 'archivo', lector: 'archivo' });
    const nada = crearRegistro([puntua('texto', 'texto', 0)]);
    expect(detectar({ mime: 'image/png' }, nada)).toMatchObject({ tipo: 'imagen', lector: null, via: 'atajo' });
  });

  it('un archivo es texto o binario por su contenido, no por un MIME raro', () => {
    const codigo = crearRegistro([puntua('archivo', 'archivo', 0), puntua('codigo', 'codigo', 0.9)]);
    for (const [nombre, mime] of [
      ['a.ts', 'video/mp2t'],
      ['a.sh', 'application/x-sh'],
      ['a.toml', 'application/toml'],
      ['a.sql', ''],
    ] as const) {
      const { entrada, cabecera } = entradaDeArchivo(nombre, mime, new TextEncoder().encode('const x = 1;\n'));
      expect(detectar(entrada, codigo, { cabecera }).tipo, nombre).toBe('codigo');
      expect(entrada.texto).toBe('const x = 1;\n');
    }
    // Un binario sin firma conocida ni MIME (SQLite, Parquet sin cabecera leída) va al genérico.
    const sqlite = entradaDeArchivo('a.sqlite', '', bytes('SQLite format 3', 0, 0x10, 0));
    expect(detectar(sqlite.entrada, codigo, { cabecera: sqlite.cabecera }).tipo).toBe('archivo');
    expect(sqlite.entrada.texto).toBeUndefined();
    const parquet = new File([bytes(1, 2)], 'a.parquet');
    expect(detectar({ archivos: [parquet] }, codigo).tipo).toBe('archivo');
    // Un PNG con MIME vacío se reconoce por su firma.
    expect(detectar({ mime: '' }, codigo, { cabecera: bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a) }).tipo).toBe(
      'archivo',
    );
    // Sin cabecera, un archivo de texto por su extensión.
    expect(detectar({ archivos: [new File(['x'], 'notas.md')] }, codigo).tipo).toBe('codigo');
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

  it('distingue texto (UTF-8 sin nulos, aunque la muestra corte un carácter) de binario', () => {
    const ene = new TextEncoder().encode('año');
    expect(pareceTexto(ene)).toBe(true);
    expect(pareceTexto(ene.subarray(0, 2))).toBe(true);
    expect(pareceTexto(bytes('ab', 0, 'c'))).toBe(false);
    expect(pareceTexto(bytes(0x81, 0x02, 0x41))).toBe(false);
  });

  it('decodifica UTF-16 (con BOM o sin él) y Latin-1 con todo el archivo; un binario con texto delante no', () => {
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...'clave=x'].flatMap((c) => [c.charCodeAt(0), 0])]);
    expect(decodificarTexto(utf16)).toEqual({ texto: 'clave=x', codificacion: 'utf-16le' });
    const sinBom = new Uint8Array([...'hola mundo'].flatMap((c) => [c.charCodeAt(0), 0]));
    expect(decodificarTexto(sinBom)?.texto).toBe('hola mundo');
    // Una «ñ» en Latin-1 pasado el primer KB: el archivo entero es Latin-1, no un UTF-8 con «�».
    const latin1 = new Uint8Array([...new TextEncoder().encode('a'.repeat(2000)), 0x63, 0x61, 0xf1, 0x61]);
    expect(decodificarTexto(latin1)).toEqual({ texto: `${'a'.repeat(2000)}caña`, codificacion: 'windows-1252' });
    const mixto = new Uint8Array([...new TextEncoder().encode('x'.repeat(2000)), 0, 1, 2, 3, 0xff, 0x10]);
    expect(decodificarTexto(mixto)).toBeNull();
    const archivo = entradaDeArchivo('a.bin', '', mixto);
    expect(archivo.entrada.texto).toBeUndefined();
    expect(pareceTexto(archivo.cabecera)).toBe(false);
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

  it('un ejemplo con bytes pasa por el detector como archivo soltado', () => {
    const r = crearRegistro([puntua('archivo', 'archivo', 0), puntua('texto', 'texto', 0)]);
    const ev = evaluar([{ esperado: 'archivo', archivo: 'archivo/a.bin', bytes: bytes(0, 1, 2, 3) }], r);
    expect(ev.acierto).toBe(1);
  });
});
