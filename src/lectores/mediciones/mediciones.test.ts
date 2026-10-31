import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisosDeMetodo, describir } from '@rimor/estadistica';
import { describe, expect, it } from 'vitest';
import { detectar } from '../../captura/detector';
import { comprobarEstilo, textoDe } from '../../respuestas/reglas';
import type { Respuesta } from '../../respuestas/tipos';
import type { Contexto } from '../contrato';
import { lectorLog } from '../log/lector';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { MAX_PUNTOS, marcasEje, pasoBonito, puntosADibujar } from './GraficoPuntos';
import { type DatosMediciones, decimalesPara, escalaDe, lectorMediciones } from './lector';
import { confianzaMediciones, leerSeries, medidaDeLinea } from './series';

const raiz = join(process.cwd(), 'fixtures/mediciones');
const leer = (archivo: string) => readFileSync(join(raiz, archivo), 'utf8');
interface SerieEsperada {
  etiqueta: string;
  unidad: string;
  n: number;
  mediana: number;
  icBajo: number;
  icAlto: number;
}
const esperado = JSON.parse(leer('esperado.json')) as Record<string, { formato: string; series: SerieEsperada[] }>;

const ctx = (idioma: 'es' | 'en' = 'es'): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
});

async function derivar(texto: string): Promise<DatosMediciones> {
  return lectorMediciones.derivar(elementoFalso(1, texto, 'mediciones'));
}

/** La cifra y su unidad van con un espacio de no separación (guía); aquí se escriben con un espacio normal. */
const NBSP = '\u00a0';
const textoRespuesta = (r: Respuesta) => r.texto.map(textoDe).join('').replaceAll(NBSP, ' ');

describe('los ejemplos de fixtures/mediciones', () => {
  for (const [archivo, e] of Object.entries(esperado))
    it(archivo, async () => {
      const texto = leer(archivo);
      expect(lectorMediciones.detectar({ texto })).toBeGreaterThanOrEqual(0.88);
      const d = await derivar(texto);
      expect(d.formato).toBe(e.formato);
      expect(
        d.series.map((s) => ({
          etiqueta: s.etiqueta,
          unidad: s.unidad,
          n: s.d.n,
          mediana: s.d.mediana,
          icBajo: s.d.icBajo,
          icAlto: s.d.icAlto,
        })),
      ).toEqual(
        e.series.map((s) => ({
          ...s,
          mediana: expect.closeTo(s.mediana, 9),
          icBajo: expect.closeTo(s.icBajo, 9),
          icAlto: expect.closeTo(s.icAlto, 9),
        })),
      );
    });
});

describe('medidaDeLinea', () => {
  it.each([
    ['38.41 ms', 38.41],
    ['38,41ms', 38.41],
    ['850 µs', 0.85],
    ['850 μs', 0.85],
    ['850 us', 0.85],
    ['120ns', 0.00012],
    ['1.2 s', 1200],
    ['38.41', 38.41],
    ['  12,5  ', 12.5],
    ['run 3: 38.4 ms', 38.4],
    ['1e3 ms', 1000],
  ])('%s → %f ms', (linea, ms) => {
    expect(medidaDeLinea(linea)).toBeCloseTo(ms, 12);
  });

  it.each(['a 38 ms y 40 ms', 'run 3 tardó mucho', '12 sec', '12 segundos', '', 'v1.2.3', '38.41 MB'])(
    '«%s» no es una medida',
    (linea) => {
      expect(medidaDeLinea(linea)).toBeNull();
    },
  );

  it('al detectar, una línea de log o una frase con una duración no cuentan', () => {
    expect(medidaDeLinea('2026-10-18 12:00:01 done in 410ms', true)).toBeNull();
    expect(medidaDeLinea('INFO request done in 410ms', true)).toBeNull();
    expect(medidaDeLinea('ayer el despliegue tardó bastante más de lo normal, unos 410ms', true)).toBeNull();
    expect(medidaDeLinea('run 3: 38.4 ms', true)).toBe(38.4);
  });
});

describe('leerSeries', () => {
  it('etiqueta desde el primer comentario, hasta el «·»; los demás comentarios no cuentan', () => {
    const { series } = leerSeries('# rápido · con caché\n# otra cosa\n1 ms\n2 ms\n3 ms\n');
    expect(series).toEqual([{ etiqueta: 'rápido', unidad: 'ms', valores: [1, 2, 3] }]);
  });

  it('sin unidad, ms; con todo por encima de 10 s, en segundos', () => {
    expect(leerSeries('1\n2\n3').series[0]?.unidad).toBe('ms');
    const s = leerSeries('10.5 s\n11 s\n12 s').series[0];
    expect(s?.unidad).toBe('s');
    expect(s?.valores).toEqual([10.5, 11, 12]);
    // Con un valor por debajo de 10 s, todo en ms.
    expect(leerSeries('9 s\n11 s\n12 s').series[0]).toMatchObject({ unidad: 'ms', valores: [9000, 11000, 12000] });
  });

  it('go test -bench: una serie por benchmark, sin el sufijo de GOMAXPROCS, en ms', () => {
    const { formato, series } = leerSeries(leer('go-bench.txt'));
    expect(formato).toBe('go');
    expect(series.map((s) => s.etiqueta)).toEqual(['Parse', 'Encode']);
    expect(series[0]?.valores[0]).toBeCloseTo(0.012733, 12);
    expect(series.map((s) => s.valores.length)).toEqual([5, 5]);
  });

  it('hyperfine: una serie por comando, de s a ms; un JSON roto o sin resultados no es hyperfine', () => {
    const { formato, series } = leerSeries(leer('hyperfine.json'));
    expect(formato).toBe('hyperfine');
    expect(series.map((s) => s.etiqueta)).toEqual(['rg TODO src', 'grep -r TODO src']);
    expect(series[0]?.valores[0]).toBeCloseTo(40.5, 9);
    expect(leerSeries('{"results": [').formato).toBe('lineas');
    expect(leerSeries('{"results": []}').series).toEqual([]);
    expect(leerSeries('{"results": [{"command": "x", "times": ["a", null]}]}').series).toEqual([]);
  });

  it('todas las series de un pegado van en la misma unidad', () => {
    const json = (a: number[], b: number[]) =>
      JSON.stringify({
        results: [
          { command: 'lento', times: a },
          { command: 'rápido', times: b },
        ],
      });
    expect(leerSeries(json([12, 13, 14], [2, 3, 4])).series.map((s) => s.unidad)).toEqual(['ms', 'ms']);
    expect(leerSeries(json([12, 13, 14], [11, 12, 13])).series.map((s) => s.unidad)).toEqual(['s', 's']);
  });

  it('nada que leer: ninguna serie', () => {
    expect(leerSeries('hola\nqué tal').series).toEqual([]);
  });
});

describe('detección', () => {
  it('0,97 con hyperfine (por encima del JSON genérico), 0,9 con go test -bench; 0,88 con una medida por línea', () => {
    expect(confianzaMediciones(leer('hyperfine.json'))).toBe(0.97);
    expect(confianzaMediciones(leer('go-bench.txt'))).toBe(0.9);
    expect(confianzaMediciones(leer('reqwest.txt'))).toBe(0.88);
  });

  it('menos de 3 medidas o menos del 70 % de las líneas: no', () => {
    expect(confianzaMediciones('38 ms\n39 ms')).toBe(0);
    expect(confianzaMediciones('38 ms\n39 ms\n40 ms\nuno\ndos\ntres')).toBe(0);
    expect(confianzaMediciones('38 ms\n39 ms\n40 ms\n41 ms\nnota al margen')).toBe(0.88);
  });

  it('un log con duraciones es un log; una idea con un número, no son mediciones', () => {
    const log = [
      '2026-10-18 12:00:01 INFO request done in 410ms',
      '2026-10-18 12:00:02 INFO request done in 380ms',
      '2026-10-18 12:00:03 WARN request done in 1200ms',
      '2026-10-18 12:00:04 INFO request done in 395ms',
    ].join('\n');
    expect(confianzaMediciones(log)).toBe(0);
    expect(lectorLog.detectar({ texto: log })).toBeGreaterThan(0.6);
    expect(confianzaMediciones('Probar a bajar el timeout a 30 s')).toBe(0);
  });
});

describe('estadísticas y avisos', () => {
  it('son los de @rimor/estadistica', async () => {
    const texto = leer('ureq.txt');
    const d = await derivar(texto);
    const valores = leerSeries(texto).series[0]?.valores ?? [];
    expect(d.series[0]?.d).toEqual(describir(valores));
    expect(d.series[0]?.avisos).toEqual(avisosDeMetodo(valores));
  });

  it('pocas repeticiones y atípicos', async () => {
    const pocas = await derivar(leer('pocas.txt'));
    expect(pocas.series[0]?.avisos.map((a) => a.tipo)).toContain('pocas');
    const conAtipico = await derivar(leer('reqwest.txt'));
    expect(conAtipico.series[0]?.avisos).toContainEqual({ tipo: 'atipicos', valores: [41.7] });
  });

  it('sin el original no deriva (nunca «0 mediciones» de un adjunto que no cargó)', async () => {
    const el = { ...elementoFalso(1, 'x', 'mediciones'), original: null };
    await expect(lectorMediciones.derivar(el)).rejects.toThrow('mediciones.sinOriginal');
  });
});

describe('respuesta', () => {
  it('el ejemplo de la ficha', async () => {
    const d = await derivar(leer('reqwest.txt'));
    const r = lectorMediciones.respuesta(elementoFalso(1), d, ctx());
    expect(textoRespuesta(r)).toBe('20 mediciones · mediana 38,54 ms (IC 95 %: 38,11 – 39,02).');
    expect(textoDe(r.texto[0] ?? { t: 'texto', v: '' })).toContain(`38,54${NBSP}ms`);
    expect(comprobarEstilo(r)).toEqual([]);
  });

  it('con menos de 10, «Son pocas»; en inglés también', async () => {
    const d = await derivar(leer('pocas.txt'));
    const es = lectorMediciones.respuesta(elementoFalso(1), d, ctx());
    expect(textoRespuesta(es)).toBe(
      '5 mediciones · mediana 4300 ms (IC 95 %: 4100 – 4500). Son pocas: lo recomendable son al menos 10.',
    );
    expect(comprobarEstilo(es)).toEqual([]);
    const en = lectorMediciones.respuesta(elementoFalso(1), d, ctx('en'));
    expect(textoRespuesta(en)).toBe(
      '5 measurements · median 4,300 ms (95% CI: 4,100 – 4,500). That is few: at least 10 are recommended.',
    );
    expect(comprobarEstilo(en)).toEqual([]);
  });

  it('varias series: la primera y cuántas más; una sola medición, sin intervalo; vacía', async () => {
    const varias = await derivar(leer('hyperfine.json'));
    const r = lectorMediciones.respuesta(elementoFalso(1), varias, ctx());
    expect(textoRespuesta(r)).toBe('12 mediciones · mediana 41,05 ms (IC 95 %: 40,30 – 42,00), y 1 serie más.');
    expect(comprobarEstilo(r)).toEqual([]);
    const una = await derivar('38.4 ms');
    expect(textoRespuesta(lectorMediciones.respuesta(elementoFalso(1), una, ctx()))).toBe(
      '1 medición: 38,40 ms. Son pocas: lo recomendable son al menos 10.',
    );
    const vacia = await derivar('nada');
    expect(textoRespuesta(lectorMediciones.respuesta(elementoFalso(1), vacia, ctx()))).toBe(
      'No he encontrado mediciones que leer.',
    );
  });

  it('en segundos', async () => {
    const d = await derivar(leer('segundos.txt'));
    expect(textoRespuesta(lectorMediciones.respuesta(elementoFalso(1), d, ctx()))).toBe(
      '10 mediciones · mediana 62,15 s (IC 95 %: 61,40 – 63,00).',
    );
  });
});

describe('cifras, resumen y título', () => {
  it('mediana, ic_bajo, ic_alto, n y cv de la primera serie', async () => {
    const d = await derivar(leer('reqwest.txt'));
    const c = lectorMediciones.cifras ?? {};
    const s = d.series[0];
    expect(c.mediana?.(d)).toEqual({ texto: `38,54${NBSP}ms`, valor: s?.d.mediana, unidad: 'ms' });
    expect(c.ic_bajo?.(d)).toEqual({ texto: `38,11${NBSP}ms`, valor: 38.11, unidad: 'ms' });
    expect(c.ic_alto?.(d)).toEqual({ texto: `39,02${NBSP}ms`, valor: 39.02, unidad: 'ms' });
    expect(c.n?.(d)).toEqual({ texto: '20', valor: 20 });
    expect(c.cv?.(d).texto).toBe(`${((s?.d.cv ?? 0) * 100).toFixed(1).replace('.', ',')}${NBSP}%`);
    expect(c.cv?.(d).unidad).toBe('%');
    const vacia = await derivar('nada');
    expect(c.mediana?.(vacia)).toEqual({ texto: '—' });
  });

  it('resumen y resumen legible', async () => {
    const d = await derivar(leer('reqwest.txt'));
    const r = lectorMediciones.resumen(d);
    expect(r).toEqual({ n: 20, mediana: 38.535, unidad: 'ms', series: 1 });
    expect(lectorMediciones.resumenLegible?.(r, 'es')).toBe(`20 mediciones · mediana 38,54${NBSP}ms`);
    expect(lectorMediciones.resumenLegible?.({ n: 3 }, 'es')).toBe('3 mediciones');
    expect(lectorMediciones.resumenLegible?.({}, 'es')).toBe('');
  });

  it('título desde la etiqueta; sin ella, «Mediciones»; las etiquetas se indexan', async () => {
    expect((await lectorMediciones.leer({ texto: leer('reqwest.txt') })).titulo).toBe('reqwest');
    expect((await lectorMediciones.leer({ texto: '1 ms\n2 ms\n3 ms' })).titulo).toBe('Mediciones');
    expect((await lectorMediciones.leer({ texto: leer('go-bench.txt') })).titulo).toBe('Parse');
    const d = await derivar(leer('go-bench.txt'));
    expect(lectorMediciones.textoIndexable?.(d)).toBe('Parse\nEncode');
  });
});

describe('formato de números y eje', () => {
  it('unas cuatro cifras significativas', () => {
    expect([38.54, 410.2, 1234, 0.001234, 0, Number.NaN].map(decimalesPara)).toEqual([2, 1, 0, 6, 2, 2]);
  });

  it('pasos «bonitos» y marcas sin errores de coma flotante', () => {
    // Como `nice` de la referencia: < 1,5 → 1; < 3 → 2; < 7 → 5; si no, 10.
    expect([0.7, 1.4, 2.2, 4, 8, 0.025, 0.03].map(pasoBonito)).toEqual([0.5, 1, 2, 5, 10, 0.02, 0.05]);
    expect(marcasEje(37.3, 42.1, 1)).toEqual([38, 39, 40, 41, 42]);
    expect(marcasEje(0.05, 0.31, 0.1).length).toBe(3);
  });
});

/** Casos de la revisión independiente: falsos positivos, lecturas engañosas y valores extremos. */
describe('revisión: lo que no son mediciones (con el detector real)', () => {
  const casos: Record<string, string> = {
    csv: 'a,b\n1,2\n3,4\n5,6',
    'acceso tipo morgan':
      'GET /api/users 200 12.345 ms - 512\nGET /api/items 200 8.120 ms - 1024\nPOST /api/login 401 3.002 ms - 64',
    'resumen de go test': 'ok  \texample.com/a\t0.012s\nok  \texample.com/b\t1.234s\nok  \texample.com/c\t0.500s',
    vitest: ' ✓ src/a.test.ts (5 tests) 12ms\n ✓ src/b.test.ts (3 tests) 8ms\n ✓ src/c.test.ts (10 tests) 120ms',
    años: '2024\n2025\n2026',
    ids: '1001\n1002\n1003\n1004',
    versiones: '1.2\n1.3\n1.4',
    'nota corta': 'Bajar el timeout a 30 s\nprobar 5 s\ny 10 s',
    lista: '- 30 s de espera\n- 5 ms de latencia\n- 2 s de arranque',
    configuración: 'timeout: 30s\nretry: 5s\ninterval: 10s\nname: api',
    'log con una línea de benchmark':
      '2026-10-18 12:00:01 INFO start\n2026-10-18 12:00:02 INFO running\nBenchmarkFoo-8   1000   1234 ns/op\n2026-10-18 12:00:03 ERROR boom\n2026-10-18 12:00:04 INFO end',
    'documento con un benchmark':
      '# Resultados\n\nHemos medido el parser con go test:\n\n```\nBenchmarkParse-8   1000   1234 ns/op\n```\n\nConclusión: va bien y lo dejamos así por ahora, con varias frases más de texto para que sea un documento.',
  };
  for (const [nombre, texto] of Object.entries(casos))
    it(nombre, () => {
      expect(confianzaMediciones(texto)).toBe(0);
      expect(detectar({ texto }, REGISTRO).lector).not.toBe('mediciones');
    });

  it('una traza de pánico de Go con una línea de benchmark es un error', () => {
    const texto =
      'panic: runtime error: index out of range [5] with length 3\n\ngoroutine 1 [running]:\nmain.foo(...)\n\t/home/u/main.go:10 +0x1d\nmain.main()\n\t/home/u/main.go:5 +0x25\nBenchmarkFoo-8   1000   1234 ns/op\nexit status 2';
    expect(detectar({ texto }, REGISTRO).lector).toBe('error');
  });

  it('números sueltos con decimales y sin paso fijo sí parecen tiempos', () => {
    expect(confianzaMediciones('20,8\n20,8\n21,0\n20,6')).toBe(0.88);
    expect(confianzaMediciones('1.2\n1.3\n1.4\n1.5')).toBe(0);
  });

  it('una lista de números con un comentario que la presenta sí son mediciones', () => {
    expect(confianzaMediciones('# latencia en ms\n12\n13\n14')).toBe(0.88);
    expect(confianzaMediciones('tiempo: 12 ms\ntiempo: 13 ms\ntiempo: 14 ms')).toBe(0.88);
  });
});

describe('revisión: lecturas', () => {
  const valores = (texto: string) => leerSeries(texto).series.map((s) => s.valores);

  it('un CSV no se lee como una serie (su coma separa columnas)', () => {
    expect(leerSeries('a,b\n1,2\n3,4\n5,6').series).toEqual([]);
    // Una columna con coma decimal y su cabecera comentada, sí.
    expect(valores('# tiempo\n12,5\n13,1\n12,9')).toEqual([[12.5, 13.1, 12.9]]);
  });

  it('miles a la inglesa y a la española; un solo separador es el decimal; «.5»', () => {
    expect(valores('1,234.5 ms\n1,456.1 ms')).toEqual([[1234.5, 1456.1]]);
    expect(valores('1.234,5 ms\n1.456,1 ms')).toEqual([[1234.5, 1456.1]]);
    expect(valores('1,234 ms')).toEqual([[1.234]]);
    expect(valores('.5 ms\n0,5 ms')).toEqual([[0.5, 0.5]]);
  });

  it('rangos, negativos, dos medidas en la línea y valores fuera de rango no son medidas', () => {
    expect(valores('10-12 ms\n11-13 ms')).toEqual([]);
    expect(valores('-5 ms\n-3 ms\n4 ms')).toEqual([[4]]);
    expect(valores('2 min 3 s')).toEqual([]);
    expect(valores('1e306 s\n1 s\n2 s')).toEqual([[1000, 2000]]);
    expect(valores('2 min\n3 min')).toEqual([[120, 180]]);
  });

  it('cada comentario tras unas medidas empieza otra serie', () => {
    const { series } = leerSeries('# a\n1 ms\n2 ms\n# b\n10 ms\n20 ms');
    expect(series.map((s) => [s.etiqueta, s.valores])).toEqual([
      ['a', [1, 2]],
      ['b', [10, 20]],
    ]);
  });

  it('go: `-cpu=1,2,4` son series distintas; el mismo benchmark en dos paquetes, también', () => {
    const cpu = leerSeries(
      'BenchmarkX     100  1000 ns/op\nBenchmarkX-2   100  600 ns/op\nBenchmarkX-4   100  400 ns/op',
    );
    expect(cpu.series.map((s) => s.etiqueta)).toEqual(['X', 'X-2', 'X-4']);
    const pkgs = leerSeries(
      'pkg: ejemplo.org/a\nBenchmarkParse-8 100 1000 ns/op\nok a 1s\npkg: ejemplo.org/b\nBenchmarkParse-8 100 9000 ns/op\nok b 1s',
    );
    expect(pkgs.series.map((s) => [s.etiqueta, s.valores.length])).toEqual([
      ['Parse (a)', 1],
      ['Parse (b)', 1],
    ]);
  });
});

describe('revisión: escala y valores extremos', () => {
  it('menos de 1 µs se enseña en ns, menos de 1 ms en µs (el valor citable sigue en ms)', async () => {
    const go = Array.from({ length: 10 }, (_, i) => `BenchmarkAdd-8 1000000000 0.25${60 + i} ns/op`).join('\n');
    const d = await derivar(go);
    expect(textoRespuesta(lectorMediciones.respuesta(elementoFalso(1), d, ctx()))).toBe(
      '10 mediciones · mediana 0,2565 ns (IC 95 %: 0,2560 – 0,2569).',
    );
    expect(escalaDe(d.series)).toEqual({ unidad: 'ns', factor: 1e6 });
    const mediana = lectorMediciones.cifras?.mediana?.(d);
    expect(mediana?.texto).toBe(`0,2565${NBSP}ns`);
    expect(mediana?.unidad).toBe('ms');
    expect(escalaDe((await derivar(leer('mezcla.txt'))).series).unidad).toBe('µs');
    expect(escalaDe((await derivar(leer('reqwest.txt'))).series).unidad).toBe('ms');
  });

  it('el eje nunca se queda en un bucle: valores enormes o casi iguales', () => {
    expect(marcasEje(1e20, 1e20 + 1e5, 1).length).toBeLessThanOrEqual(50);
    expect(marcasEje(0, Number.POSITIVE_INFINITY, 1)).toEqual([]);
    expect(marcasEje(0, 10, 0)).toEqual([]);
  });

  it('con cientos de miles de valores se dibuja una muestra', () => {
    const indices = puntosADibujar(150_000);
    expect(indices).toHaveLength(MAX_PUNTOS);
    expect(indices[0]).toBe(0);
    expect(indices.at(-1)).toBeLessThan(150_000);
  });
});

describe('revisión: título', () => {
  it('de hyperfine, «Mediciones de {comando}»', async () => {
    expect((await lectorMediciones.leer({ texto: leer('hyperfine.json') })).titulo).toBe('Mediciones de rg TODO src');
  });
});

describe('formatos de v0.2 (IN-047)', () => {
  it('un resumen de criterion (estimates.json): la mediana y el intervalo de criterion, sin mediciones sueltas', async () => {
    const texto = leer('criterion-estimates.json');
    expect(lectorMediciones.detectar({ texto })).toBe(0.97);
    expect(detectar({ texto }, REGISTRO).lector).toBe('mediciones');
    const d = await derivar(texto);
    const [s] = d.series;
    expect(d.formato).toBe('criterion');
    expect(s?.valores).toEqual([]);
    expect(s?.d.n).toBe(0);
    expect(s?.d.mediana).toBeCloseTo(0.0384819, 9);
    expect([s?.d.icBajo, s?.d.icAlto].map((x) => Number(x?.toFixed(7)))).toEqual([0.0383901, 0.0385754]);
    expect(s?.avisos).toEqual([]);
    const r = lectorMediciones.respuesta(elementoFalso(1, texto), d, ctx());
    expect(textoRespuesta(r)).toBe(
      'Mediana de 38,48 µs según criterion (IC 95 %: 38,39 – 38,58), sin las mediciones sueltas.',
    );
    expect(comprobarEstilo(r)).toEqual([]);
    expect(lectorMediciones.resumenLegible?.(lectorMediciones.resumen(d), 'es')?.replaceAll(NBSP, ' ')).toBe(
      'mediana 38,48 µs',
    );
    expect(lectorMediciones.cifras?.n?.(d, {} as never)).toEqual({ texto: '—' });
  });

  it('pytest-benchmark sin `data`: un resumen sin intervalo; con `data`, sus series', async () => {
    const d = await derivar(leer('pytest-sin-data.json'));
    expect(d.formato).toBe('pytest');
    expect(textoRespuesta(lectorMediciones.respuesta(elementoFalso(1, ''), d, ctx()))).toBe(
      'Mediana de 393,5 µs según pytest-benchmark, sin las mediciones sueltas.',
    );
    const conData = await derivar(leer('pytest-benchmark.json'));
    expect(conData.series.map((s) => [s.etiqueta, s.valores.length])).toEqual([
      ['test_parsear_toml', 10],
      ['test_parsear_yaml', 10],
    ]);
  });

  it('JMH: solo los modos de tiempo (el de rendimiento no es un tiempo)', async () => {
    const d = await derivar(leer('jmh.json'));
    expect(d.series.map((s) => s.etiqueta)).toEqual(['ParserBench.parseJson (size=1000)']);
    const soloThrpt = JSON.stringify([JSON.parse(leer('jmh.json'))[1]]);
    expect(confianzaMediciones(soloThrpt)).toBe(0);
  });

  it('columnas CSV: solo con su unidad; sin ella es una tabla de Datos', () => {
    expect(leerSeries(leer('columnas.csv')).formato).toBe('csv');
    expect(detectar({ texto: leer('columnas.csv') }, REGISTRO).lector).toBe('mediciones');
    const sinUnidad = 'reqwest,ureq\n38.41,36.92\n39.02,37.40\n37.88,35.88\n38.76,36.51\n';
    expect(confianzaMediciones(sinUnidad)).toBe(0);
    expect(detectar({ texto: sinUnidad }, REGISTRO).lector).toBe('datos');
    // Unidades en las celdas, y decimales con coma con `;`.
    expect(leerSeries('a;b\n38,4 ms;36,9 ms\n39,0 ms;37,4 ms\n37,9 ms;35,9 ms\n').series.map((s) => s.valores)).toEqual(
      [
        [38.4, 39, 37.9],
        [36.9, 37.4, 35.9],
      ],
    );
    // Una columna que no es un número: no son mediciones.
    expect(leerSeries('cliente,latencia_ms\nureq,31\nreqwest,30000\nureq,33\n').formato).not.toBe('csv');
  });
});

describe('revisión de IN-047', () => {
  it('criterion: el change/estimates.json (fracciones) y un JSON cualquiera con iters y times no son tiempos', () => {
    const cambio = JSON.stringify({
      mean: { point_estimate: 0.034, confidence_interval: { lower_bound: 0.02, upper_bound: 0.049 } },
      median: { point_estimate: 0.034, confidence_interval: { lower_bound: 0.02, upper_bound: 0.049 } },
    });
    expect(confianzaMediciones(cambio)).toBe(0);
    expect(confianzaMediciones(JSON.stringify({ iters: [1, 2, 3], times: [10, 20, 30] }))).toBe(0);
  });

  it('JMH en modo sample (solo histograma): un resumen con su percentil 50', async () => {
    const sample = JSON.stringify([
      {
        benchmark: 'org.rimor.Bench.parse',
        mode: 'sample',
        primaryMetric: {
          score: 41.9,
          scoreUnit: 'us/op',
          scorePercentiles: { '0.0': 39.1, '50.0': 41.5, '99.0': 55.2 },
          rawDataHistogram: [
            [
              [
                [41.5, 120000],
                [42.0, 80000],
              ],
            ],
          ],
        },
      },
    ]);
    const d = await derivar(sample);
    expect(d.formato).toBe('jmh');
    expect(d.series[0]?.valores).toEqual([]);
    expect(d.series[0]?.d.mediana).toBeCloseTo(0.0415, 9);
  });

  it('CSV: una columna con su unidad entre paréntesis; un sufijo con enteros no; columnas de distinta longitud', () => {
    const una = leerSeries('tiempo (s)\n1.21\n1.35\n1.18\n1.27\n1.33\n');
    expect(una.formato).toBe('csv');
    expect(una.series[0]).toMatchObject({ etiqueta: 'tiempo', unidad: 'ms', valores: [1210, 1350, 1180, 1270, 1330] });
    const us = leerSeries('latencia [µs]\n41.2\n40.8\n42.1\n').series[0]?.valores ?? [];
    expect(us.map((v) => Number(v.toFixed(7)))).toEqual([0.0412, 0.0408, 0.0421]);
    expect(confianzaMediciones('ventas_us,costes_us\n1200,800\n1350,900\n1100,750\n')).toBe(0);
    const desiguales = leerSeries('a (ms),b (ms)\n1.5,2.5\n1.6,2.6\n1.7,2.7\n1.8,\n');
    expect(desiguales.series.map((s) => s.valores.length)).toEqual([4, 3]);
  });

  it('la respuesta y las cifras hablan de la primera serie con mediciones, no de un resumen delante', async () => {
    const mezcla = JSON.stringify({
      machine_info: {},
      benchmarks: [
        { name: 'sin_data', stats: { median: 0.001, mean: 0.001 } },
        { name: 'con_data', stats: { median: 0.002, data: [0.002, 0.0021, 0.0019, 0.002] } },
      ],
    });
    const d = await derivar(mezcla);
    expect(lectorMediciones.resumen(d)).toMatchObject({ n: 4 });
    expect(textoRespuesta(lectorMediciones.respuesta(elementoFalso(1, mezcla), d, ctx()))).toMatch(/^4 mediciones/);
  });

  it('el lector sube a la versión 2 (los derivados y las comparaciones guardadas se recalculan)', () => {
    expect(lectorMediciones.version).toBe(2);
  });
});
