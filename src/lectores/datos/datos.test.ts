import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectar, entradaDeArchivo } from '../../captura/detector';
import { comprobarEstilo } from '../../respuestas/reglas';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { formaCsv, puntuarCsv } from './csv';
import { lectorDatos } from './lector';
import { obtenerMotor } from './motor';
import { LIMITE_PERFIL, perfilar, principio } from './perfil';

const ctx = (idioma: 'es' | 'en') => ({ idioma, mismaHuella: [], versiones: [], notas: [], colecciones: [] });
const bytes = (s: string) => new TextEncoder().encode(s);
const leer = (r: { texto: { t: string; v?: string }[] }) => r.texto.map((f) => f.v ?? '').join('');

/** Un CSV como el de la referencia: latencias con timeouts de 30 s y bytes con nulos. */
function gateway(): string {
  const lineas = ['ts,cliente,status,latencia_ms,bytes'];
  for (let i = 0; i < 100; i++) {
    const timeout = i % 25 === 0;
    lineas.push(
      [
        `2026-10-17T17:${String(i % 60).padStart(2, '0')}:00Z`,
        i % 2 ? 'ureq' : 'reqwest',
        timeout ? 504 : 200,
        timeout ? 30000 : 30 + (i % 10),
        i % 20 === 7 ? '' : 1000 + i,
      ].join(','),
    );
  }
  return `${lineas.join('\n')}\n`;
}

describe('reconocer un CSV', () => {
  it('forma: separador, columnas y filas; comillas con separadores dentro; TSV y punto y coma', () => {
    expect(formaCsv('a,b,c\n1,2,3\n4,5,6\n')).toEqual({ separador: ',', columnas: 3, filas: 2 });
    expect(formaCsv('nombre,desc\n"x","a, b"\n"y","c, d"\n')?.columnas).toBe(2);
    expect(formaCsv('a\tb\n1\t2\n3\t4\n')?.separador).toBe('\t');
    expect(formaCsv('fecha;importe\n01/10;3,50\n02/10;7,25\n')).toEqual({ separador: ';', columnas: 2, filas: 2 });
    expect(puntuarCsv('a,b\n1,2\n3,4\n')).toBeCloseTo(0.9);
  });

  it('no son datos: una tabla de Markdown, prosa con comas, código, una lista o dos líneas', () => {
    expect(formaCsv('| a | b |\n|---|---|\n| 1 | 2 |\n')).toBeNull();
    expect(formaCsv('Hola, qué tal.\nBien, gracias, ¿y tú?\nTodo bien.\n')).toBeNull();
    expect(
      formaCsv('const suma = (a, b) => a + b;\nconst resta = (a, b) => a - b;\nmodule.exports = { suma, resta };\n'),
    ).toBeNull();
    expect(formaCsv('- uno\n- dos\n- tres\n')).toBeNull();
    expect(formaCsv('a,b\n1,2\n')).toBeNull();
  });

  it('un CSV va al lector datos; un Parquet soltado también (por su firma)', () => {
    expect(detectar({ texto: gateway() }, REGISTRO).lector).toBe('datos');
    const parquet = new Uint8Array(readFileSync(join(process.cwd(), 'fixtures/deteccion/datos/tabla.parquet')));
    const { entrada, cabecera } = entradaDeArchivo('tabla.parquet', '', parquet);
    expect(detectar(entrada, REGISTRO, { cabecera })).toMatchObject({ tipo: 'datos', lector: 'datos' });
  });
});

describe('perfil con DuckDB', () => {
  it('tipos, nulos, únicos, mínimo, máximo, media, histograma, atípicos, filas en el máximo y los más repetidos', async () => {
    const d = await perfilar(await obtenerMotor(), bytes(gateway()), 'csv');
    expect([d.filas, d.columnas.length]).toEqual([100, 5]);
    const porNombre = Object.fromEntries(d.columnas.map((c) => [c.nombre, c]));
    expect(porNombre.ts?.clase).toBe('fecha');
    expect(porNombre.cliente).toMatchObject({ clase: 'texto', nulos: 0, unicos: 2 });
    expect(porNombre.cliente?.frecuentes).toEqual([
      ['reqwest', 50],
      ['ureq', 50],
    ]);
    const latencia = porNombre.latencia_ms;
    expect(latencia).toMatchObject({
      clase: 'numero',
      min: 30,
      max: 30000,
      enMaximo: 4,
      atipicos: 4,
      maximoAtipico: true,
    });
    expect(latencia?.histograma).toHaveLength(20);
    expect(latencia?.histograma?.reduce((s, n) => s + n, 0)).toBe(100);
    expect(porNombre.bytes?.nulos).toBe(5);
    expect(d.vistaPrevia.columnas).toEqual(['ts', 'cliente', 'status', 'latencia_ms', 'bytes']);
    expect(d.vistaPrevia.filas).toHaveLength(5);
    expect(d.muestra).toBeUndefined();
  }, 60_000);

  it('un Parquet', async () => {
    const parquet = new Uint8Array(readFileSync(join(process.cwd(), 'fixtures/deteccion/datos/tabla.parquet')));
    const d = await perfilar(await obtenerMotor(), parquet, 'parquet');
    expect([d.formato, d.filas, d.columnas.map((c) => [c.nombre, c.clase])]).toEqual([
      'parquet',
      200,
      [
        ['id', 'numero'],
        ['cliente', 'texto'],
        ['latencia_ms', 'numero'],
      ],
    ]);
    expect(d.columnas[2]).toMatchObject({ max: 30000, enMaximo: 8, maximoAtipico: true });
  }, 60_000);

  it('por encima del límite, la muestra de sus primeros bytes cortada en un fin de línea', () => {
    const b = bytes('a,b\n1,2\n3,4\n5,6\n');
    expect(new TextDecoder().decode(principio(b, 10))).toBe('a,b\n1,2\n');
    expect(principio(b, 1000)).toBe(b);
    expect(LIMITE_PERFIL).toBe(50 * 1024 * 1024);
  });
});

describe('respuesta', () => {
  it('«100 filas y 5 columnas. Hay 4 latencias de 30 s y 5 nulos en bytes.»', async () => {
    const texto = gateway();
    const d = await lectorDatos.derivar(elementoFalso(1, texto, 'datos'));
    const es = lectorDatos.respuesta(elementoFalso(1, texto, 'datos'), d, ctx('es'));
    expect(leer(es)).toBe('100 filas y 5 columnas. Hay 4 latencias de 30 s y 5 nulos en bytes.');
    // Los nombres de las columnas, en mono (son del usuario).
    expect(es.texto.filter((f) => f.t === 'mono').map((f) => ('v' in f ? f.v : ''))).toEqual(['latencias', 'bytes']);
    const en = lectorDatos.respuesta(elementoFalso(1, texto, 'datos'), d, ctx('en'));
    expect(leer(en)).toBe('100 rows and 5 columns. There are 4 latencias of 30 s and 5 nulls in bytes.');
    for (const r of [es, en]) expect(comprobarEstilo(r)).toEqual([]);
    expect(lectorDatos.resumenLegible?.(lectorDatos.resumen(d), 'es')).toBe('100 filas · 5 columnas');
  }, 60_000);

  it('sin nada raro, solo la forma', async () => {
    const d = await lectorDatos.derivar(elementoFalso(2, 'a,b\n1,2\n3,4\n5,6\n', 'datos'));
    expect(lectorDatos.respuesta(elementoFalso(2, '', 'datos'), d, ctx('es')).texto[0]).toEqual({
      t: 'texto',
      v: '3 filas y 2 columnas.',
    });
  }, 60_000);

  it('leer: título del archivo o «Datos de N columnas», formato y filas sin DuckDB', async () => {
    expect(await lectorDatos.leer({ texto: 'a\tb\n1\t2\n3\t4\n' })).toMatchObject({
      titulo: 'Datos de 2 columnas',
      resumen: { formato: 'tsv', filas: 2, columnas: 2 },
    });
    expect((await lectorDatos.leer({ texto: gateway(), nombre: 'latencias.csv' })).titulo).toBe('latencias.csv');
  });
});
