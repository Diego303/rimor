import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectar, entradaDeArchivo } from '../../captura/detector';
import { comprobarEstilo } from '../../respuestas/reglas';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { filasCsv, formaCsv, puntuarCsv } from './csv';
import { conUnidad, lectorDatos } from './lector';
import { type MotorSql, obtenerMotor, VERSION_DUCKDB } from './motor';
import { type DatosTabla, LIMITE_PERFIL, muestraCsv, type PerfilColumna, perfilar, principio } from './perfil';

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
    // La fila de guiones corta de GFM (`|-|-|`) también es de una tabla de Markdown.
    expect(formaCsv('| a | b |\n|-|-|\n| 1 | 2 |\n| 3 | 4 |\n')).toBeNull();
    expect(formaCsv('a | b\n:-|-:\n1 | 2\n3 | 4\n')).toBeNull();
    // Un log de Python: la coma es la de los milisegundos.
    const log = [
      '2026-10-17 17:40:00,123 - app - INFO - Arranca',
      '2026-10-17 17:40:01,456 - app - INFO - Conecta',
      '2026-10-17 17:40:02,789 - app - ERROR - Se cae',
    ].join('\n');
    expect(formaCsv(log)).toBeNull();
    expect(detectar({ texto: log }, REGISTRO).lector).toBe('log');
  });

  it('un campo entre comillas con saltos de línea no parte la fila; una comilla suelta no abre nada', () => {
    const texto = 'id,nota,total\n1,"una nota\nen dos líneas",3\n2,"otra, con coma",4\n3,corta,5\n';
    expect(formaCsv(texto)).toEqual({ separador: ',', columnas: 3, filas: 3 });
    expect(filasCsv(texto, ',').filas[1]).toEqual(['1', 'una nota\nen dos líneas', '3']);
    expect(detectar({ texto }, REGISTRO).lector).toBe('datos');
    expect(formaCsv('modelo,pantalla,precio\ntv,55" 4K,499\nmonitor,27",199\nportátil,14",899\n')?.filas).toBe(3);
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

/** El motor de Node, con un `registrar` que se lleva el búfer como `registerFileBuffer` en el navegador. */
async function motorQueSeLlevaLosBytes(): Promise<MotorSql> {
  const base = await obtenerMotor();
  return {
    ...base,
    registrar: async (nombre, datos) => {
      const copia = datos.slice();
      structuredClone(datos.buffer, { transfer: [datos.buffer as ArrayBuffer] });
      await base.registrar(nombre, copia);
    },
  };
}

describe('revisión de IN-044', () => {
  it('la muestra se nota aunque el motor se lleve los bytes al registrarlos', async () => {
    const texto = gateway();
    const d = await perfilar(await motorQueSeLlevaLosBytes(), bytes(texto), 'csv', 1000);
    expect(d.muestra).toMatchObject({ exacto: false, filas: d.filas });
    expect(d.filas).toBeLessThan(100);
    expect(d.muestra?.total).toBeGreaterThan(80);
    expect(d.muestra?.total).toBeLessThan(120);
  }, 60_000);

  it('valores según su tipo: fechas, marcas de tiempo, decimales con su escala, horas, bytes y columnas repetidas', async () => {
    const r = await (await obtenerMotor()).consultar(
      "SELECT TIMESTAMP '2026-10-17 17:40:00' t, TIMESTAMPTZ '2026-10-17 17:40:00.5+00' tz, DATE '2026-10-17' d, -1.5::DECIMAL(10,2) x, 12345678901234.5678::DECIMAL(20,4) grande, TIME '10:00:00.25' h, 'xy'::BLOB b, 1 a, 2 a, 170141183460469231731687303715884105727::HUGEINT enorme, INTERVAL 3 HOUR i",
    );
    expect(r.columnas).toEqual(['t', 'tz', 'd', 'x', 'grande', 'h', 'b', 'a', 'a', 'enorme', 'i']);
    expect(r.filas[0]).toEqual([
      '2026-10-17 17:40:00',
      '2026-10-17T17:40:00.500Z',
      '2026-10-17',
      -1.5,
      '12345678901234.5678',
      '10:00:00.25',
      'xy',
      1,
      2,
      '170141183460469231731687303715884105727',
      null,
    ]);
  }, 60_000);

  it('con `maxFilas`, solo se convierten las primeras y se dice cuántas había', async () => {
    const r = await (await obtenerMotor()).consultar('SELECT * FROM range(1000)', { maxFilas: 200 });
    expect([r.filas.length, r.total]).toEqual([200, 1000]);
  }, 60_000);

  it('la vista previa, como la escribe DuckDB (una fecha no es un número de milisegundos)', async () => {
    const d = await perfilar(await obtenerMotor(), bytes(gateway()), 'csv');
    expect(String(d.vistaPrevia.filas[0]?.[0])).toMatch(/^2026-10-17 17:00:00/);
  }, 60_000);

  it('la extensión de Parquet va con el sitio, en la carpeta de la versión de DuckDB', async () => {
    const r = await (await obtenerMotor()).consultar('PRAGMA version');
    expect(r.filas[0]?.[0]).toBe(VERSION_DUCKDB);
    for (const variante of ['wasm_eh', 'wasm_mvp'])
      expect(
        existsSync(join(process.cwd(), 'public/duckdb', VERSION_DUCKDB, variante, 'parquet.duckdb_extension.wasm')),
      ).toBe(true);
    const ajuste = await (await obtenerMotor()).consultar("SELECT current_setting('custom_extension_repository')");
    expect(ajuste.filas[0]?.[0]).not.toMatch(/duckdb\.org/);
  }, 60_000);

  it('un Parquet grande se perfila por sus primeras filas, con el total exacto', async () => {
    const parquet = new Uint8Array(readFileSync(join(process.cwd(), 'fixtures/deteccion/datos/tabla.parquet')));
    const d = await perfilar(await obtenerMotor(), parquet, 'parquet', parquet.length / 2);
    expect(d.muestra).toEqual({ filas: 100, total: 200, exacto: true });
    expect(d.filas).toBe(100);
  }, 60_000);

  it('un CSV en Windows-1252 o en UTF-16 se lee (DuckDB solo lee UTF-8)', async () => {
    const latin1 = new Uint8Array(
      [...'nombre,n\ncaf']
        .map((c) => c.charCodeAt(0))
        .concat(
          [0xe9],
          [...',1\nte,2\nt\xe9,3\n'].map((c) => c.charCodeAt(0)),
        ),
    );
    const d = await perfilar(await obtenerMotor(), latin1, 'csv');
    expect(d.columnas[0]?.frecuentes?.map(([v]) => v)).toEqual(['café', 'te', 'té']);
    const texto = 'nombre,n\ncafé,1\nte,2\nté,3\n';
    const utf16 = new Uint8Array(2 + texto.length * 2);
    utf16.set([0xff, 0xfe]);
    for (let i = 0; i < texto.length; i++) utf16[2 + i * 2] = texto.charCodeAt(i);
    expect(new TextDecoder().decode(muestraCsv(utf16).datos)).toBe(texto);
    const d16 = await perfilar(await obtenerMotor(), utf16, 'csv');
    expect(d16.filas).toBe(3);
  }, 60_000);

  it('infinitos y rangos enormes no rompen el perfil (nada de `Infinity` dentro del SQL)', async () => {
    const d = await perfilar(await obtenerMotor(), bytes('x,y\n1,-1.7e308\n2,1.7e308\ninf,0\n3,1\n'), 'csv');
    const [x, y] = d.columnas;
    expect(x?.clase).toBe('numero');
    expect(x?.histograma).toBeUndefined();
    expect(y).toMatchObject({ clase: 'numero', min: -1.7e308, max: 1.7e308 });
    expect(y?.histograma?.reduce((s, n) => s + n, 0)).toBe(4);
  }, 60_000);

  it('la unidad de un nombre: `_s` por debajo de 1 se dice en ms; `_ms` de 1.000 o más, en s', () => {
    const col = (nombre: string, max: number) =>
      ({ nombre, max, tipo: 'DOUBLE', clase: 'numero', nulos: 0, unicos: 1 }) as PerfilColumna;
    expect(conUnidad(col('espera_s', 0.25), 'es')?.valor).toBe('250 ms');
    expect(conUnidad(col('espera_s', 2), 'es')?.valor).toBe('2 s');
    expect(conUnidad(col('latencia_ms', 30000), 'es')?.valor).toBe('30 s');
    expect(conUnidad(col('latencia_ms', 250), 'es')?.valor).toBe('250 ms');
  });

  it('de una muestra, la respuesta no mezcla escalas: filas del archivo, lo raro de la muestra (y lo dice)', async () => {
    const base = await lectorDatos.derivar(elementoFalso(9, gateway(), 'datos'));
    const aprox: DatosTabla = { ...base, muestra: { filas: 100, total: 1000, exacto: false } };
    const exacta: DatosTabla = { ...base, muestra: { filas: 100, total: 1000, exacto: true } };
    const el = elementoFalso(9, '', 'datos');
    expect(leer(lectorDatos.respuesta(el, aprox, ctx('es')))).toBe(
      'Unas 1000 filas y 5 columnas. En los primeros 50 MB hay 4 latencias de 30 s y 5 nulos en bytes.',
    );
    expect(leer(lectorDatos.respuesta(el, exacta, ctx('es')))).toBe(
      '1000 filas y 5 columnas. En las primeras 100 filas hay 4 latencias de 30 s y 5 nulos en bytes.',
    );
    expect(leer(lectorDatos.respuesta(el, aprox, ctx('en')))).toBe(
      'About 1,000 rows and 5 columns. In the first 50 MB there are 4 latencias of 30 s and 5 nulls in bytes.',
    );
    for (const d of [aprox, exacta]) expect(comprobarEstilo(lectorDatos.respuesta(el, d, ctx('es')))).toEqual([]);
    expect(lectorDatos.resumen(aprox).filas).toBe(1000);
  }, 60_000);

  it('el perfil, con pocas consultas para todas las columnas (no tres por columna)', async () => {
    const base = await obtenerMotor();
    let consultas = 0;
    const contador: MotorSql = { ...base, consultar: (sql, o) => (consultas++, base.consultar(sql, o)) };
    await perfilar(contador, bytes(gateway()), 'csv');
    // Crear la tabla, describirla, medidas, histogramas, más repetidos, vista previa y borrarla.
    expect(consultas).toBe(7);
  }, 60_000);
});
