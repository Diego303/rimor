import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avisosDeMetodo, describir } from '@rimor/estadistica';
import { describe, expect, it } from 'vitest';
import { comprobarEstilo, textoDe } from '../../respuestas/reglas';
import type { Respuesta } from '../../respuestas/tipos';
import type { Contexto } from '../contrato';
import { lectorLog } from '../log/lector';
import { elementoFalso } from '../pruebas/falsos';
import { marcasEje, pasoBonito } from './GraficoPuntos';
import { type DatosMediciones, decimalesPara, lectorMediciones } from './lector';
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
  it('0,9 con hyperfine o go test -bench; 0,88 con una medida por línea', () => {
    expect(confianzaMediciones(leer('hyperfine.json'))).toBe(0.9);
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
