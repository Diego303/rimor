/**
 * Formatos de herramientas de benchmark (LEC-06 v0.2, IN-047): el JSON de hyperfine, de pytest-benchmark y de JMH,
 * el `sample.json` y el `estimates.json` de criterion, y una tabla CSV con una columna por serie que dice su unidad.
 * Todo en milisegundos (`series.ts` lo pasa a su unidad). Lo que no trae las mediciones sueltas (un `estimates.json`,
 * un pytest-benchmark sin `data`) es un **resumen**: la mediana y el intervalo que calculó la herramienta. TS puro.
 */

/** La mediana y lo demás que calculó la herramienta, cuando no da las mediciones sueltas (en ms). */
export interface ResumenExterno {
  mediana: number;
  icBajo?: number;
  icAlto?: number;
  media?: number;
  desviacion?: number;
}

export interface SerieEnMs {
  etiqueta: string | null;
  ms: number[];
  resumen?: ResumenExterno;
}

export type FormatoJsonMediciones = 'hyperfine' | 'pytest' | 'jmh' | 'criterion';

/** Milisegundos por unidad. `µ` (U+00B5) y `μ` (U+03BC) se escriben igual. */
export const A_MS: Record<string, number> = { ns: 1e-6, us: 1e-3, µs: 1e-3, μs: 1e-3, ms: 1, s: 1000, min: 60_000 };

/** Milisegundos por nanosegundo (criterion mide en ns). */
const NS = 1e-6;

const numero = (x: unknown): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined;
const objeto = (x: unknown): Record<string, unknown> | undefined =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined;
/** Los números (no negativos) de una lista, por `factor` (a ms). */
const enMs = (xs: unknown, factor: number): number[] =>
  Array.isArray(xs)
    ? xs
        .map(numero)
        .filter((x): x is number => x !== undefined)
        .map((x) => x * factor)
    : [];

/** hyperfine (`--export-json`): una serie por comando, con `times` en segundos. */
function deHyperfine(json: Record<string, unknown>): SerieEnMs[] | null {
  if (!Array.isArray(json.results)) return null;
  const series: SerieEnMs[] = [];
  for (const r of json.results.map(objeto)) {
    const ms = enMs(r?.times, 1000);
    if (ms.length) series.push({ etiqueta: typeof r?.command === 'string' ? r.command : null, ms });
  }
  return series.length ? series : null;
}

/**
 * pytest-benchmark: una serie por benchmark con `stats.data` (segundos; la trae `--benchmark-json`, y
 * `--benchmark-save` con `--benchmark-save-data`); sin ella, un resumen con su mediana, su media y su desviación.
 */
function dePytest(json: Record<string, unknown>): SerieEnMs[] | null {
  if (!Array.isArray(json.benchmarks) || (!objeto(json.machine_info) && !json.version)) return null;
  const series: SerieEnMs[] = [];
  for (const b of json.benchmarks.map(objeto)) {
    const stats = objeto(b?.stats);
    if (!stats) continue;
    const etiqueta = typeof b?.name === 'string' ? b.name : null;
    const ms = enMs(stats.data, 1000);
    const mediana = numero(stats.median);
    if (ms.length) series.push({ etiqueta, ms });
    else if (mediana !== undefined) {
      const media = numero(stats.mean);
      const desviacion = numero(stats.stddev);
      series.push({
        etiqueta,
        ms: [],
        resumen: {
          mediana: mediana * 1000,
          ...(media !== undefined ? { media: media * 1000 } : {}),
          ...(desviacion !== undefined ? { desviacion: desviacion * 1000 } : {}),
        },
      });
    }
  }
  return series.length ? series : null;
}

/** La unidad de un `scoreUnit` de JMH que es un tiempo por operación (`ns/op`, `us/op`…); `null` si no lo es. */
const unidadJmh = (u: unknown): number | null => {
  const m = typeof u === 'string' ? /^(ns|us|µs|μs|ms|s|min)\/op$/.exec(u) : null;
  return m ? (A_MS[m[1] ?? ''] ?? null) : null;
};

/**
 * JMH (`-rf json`): una serie por benchmark (y sus parámetros) con `primaryMetric.rawData` aplanado (`avgt`, `ss`);
 * del modo `sample`, que solo da un histograma, un resumen. En el de rendimiento (`thrpt`, `ops/s`) más es mejor y no
 * es un tiempo: no se lee.
 */
function deJmh(json: unknown): SerieEnMs[] | null {
  if (!Array.isArray(json) || !json.length || !json.every((b) => objeto(b)?.primaryMetric)) return null;
  const series: SerieEnMs[] = [];
  for (const b of json.map(objeto)) {
    const metrica = objeto(b?.primaryMetric);
    const factor = unidadJmh(metrica?.scoreUnit);
    if (!metrica || factor === null || b?.mode === 'thrpt') continue;
    const ms = Array.isArray(metrica.rawData) ? metrica.rawData.flatMap((f: unknown) => enMs(f, factor)) : [];
    // En el modo `sample`, JMH no da `rawData` sino un histograma (con recuentos de millones): un resumen con su
    // percentil 50 y su media, sin expandirlo.
    const p50 = numero(objeto(metrica.scorePercentiles)?.['50.0']);
    const media = numero(metrica.score);
    const resumen: ResumenExterno | undefined =
      !ms.length && p50 !== undefined
        ? { mediana: p50 * factor, ...(media !== undefined ? { media: media * factor } : {}) }
        : undefined;
    if (!ms.length && !resumen) continue;
    const nombre = typeof b?.benchmark === 'string' ? b.benchmark.split('.').slice(-2).join('.') : null;
    const params = objeto(b?.params);
    const sufijo = params
      ? ` (${Object.entries(params)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(', ')})`
      : '';
    series.push({ etiqueta: nombre ? `${nombre}${sufijo}` : null, ms, ...(resumen ? { resumen } : {}) });
  }
  return series.length ? series : null;
}

/**
 * criterion: el `sample.json` de un benchmark (`iters` y `times` en ns) da la serie entera (`times[i] / iters[i]`);
 * el `estimates.json`, un resumen (la mediana con su intervalo, la media y la desviación que calculó criterion).
 */
function deCriterion(json: Record<string, unknown>): SerieEnMs[] | null {
  // Un `sample.json` lleva su `sampling_mode`; un `estimates.json`, la desviación y la mediana de las desviaciones
  // (el `change/estimates.json`, en fracciones relativas, no: no son tiempos).
  if (
    typeof json.sampling_mode === 'string' &&
    Array.isArray(json.iters) &&
    Array.isArray(json.times) &&
    json.iters.length === json.times.length
  ) {
    const ms = json.times
      .map((t, i) => {
        const iters = numero(json.iters instanceof Array ? json.iters[i] : undefined);
        const tiempo = numero(t);
        return iters && tiempo !== undefined ? (tiempo / iters) * NS : undefined;
      })
      .filter((x): x is number => x !== undefined);
    return ms.length ? [{ etiqueta: null, ms }] : null;
  }
  const mediana = objeto(json.median);
  const puntual = numero(mediana?.point_estimate);
  if (!mediana || puntual === undefined || !objeto(json.mean) || !objeto(json.std_dev) || !objeto(json.median_abs_dev))
    return null;
  const ic = objeto(mediana.confidence_interval);
  const bajo = numero(ic?.lower_bound);
  const alto = numero(ic?.upper_bound);
  const media = numero(objeto(json.mean)?.point_estimate);
  const desviacion = numero(objeto(json.std_dev)?.point_estimate);
  const ns = NS;
  return [
    {
      etiqueta: null,
      ms: [],
      resumen: {
        mediana: puntual * ns,
        ...(bajo !== undefined && alto !== undefined ? { icBajo: bajo * ns, icAlto: alto * ns } : {}),
        ...(media !== undefined ? { media: media * ns } : {}),
        ...(desviacion !== undefined ? { desviacion: desviacion * ns } : {}),
      },
    },
  ];
}

/** Las series de un JSON de una herramienta de benchmark, o `null` si no lo es. */
export function deJsonDeBenchmark(texto: string): { formato: FormatoJsonMediciones; series: SerieEnMs[] } | null {
  const t = texto.trim();
  if (!/^[[{]/.test(t) || !/"(?:results|benchmarks|primaryMetric|iters|point_estimate)"/.test(t.slice(0, 20_000)))
    return null;
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch {
    return null;
  }
  const jmh = deJmh(json);
  if (jmh) return { formato: 'jmh', series: jmh };
  const o = objeto(json);
  if (!o) return null;
  const hyperfine = deHyperfine(o);
  if (hyperfine) return { formato: 'hyperfine', series: hyperfine };
  const pytest = dePytest(o);
  if (pytest) return { formato: 'pytest', series: pytest };
  const criterion = deCriterion(o);
  return criterion ? { formato: 'criterion', series: criterion } : null;
}

// ---------- Columnas CSV ----------

/**
 * La unidad que dice una cabecera: entre paréntesis o corchetes (`reqwest (ms)`, `latencia [µs]`), o como sufijo
 * (`ureq_ms`), que es más dudoso (`ventas_us` son ventas en EE. UU.): el sufijo solo vale si los valores tienen
 * decimales.
 */
const UNIDAD_ENTRE = /(?:\(|\[)\s*(ns|us|µs|μs|ms|s)\s*(?:\)|\])\s*$/iu;
const UNIDAD_SUFIJO = /[_\s-](ns|us|µs|μs|ms|s)$/iu;
const UNIDAD_CABECERA = new RegExp(`${UNIDAD_ENTRE.source}|${UNIDAD_SUFIJO.source}`, 'iu');
/** Un número con unidad opcional en una celda (`38.4`, `38,4 ms`). */
const CELDA = /^([+-]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?)\s*(ns|us|µs|μs|ms|s|min)?$/iu;

/**
 * Una tabla con una columna por serie: una cabecera con nombres y, debajo, al menos 3 filas solo de números. Cada
 * columna tiene que decir su unidad (en la cabecera o en sus valores): sin ella, es una tabla de datos (Datos). Con
 * `;` o tabulador, la coma puede ser decimal.
 */
export function deColumnas(lineas: readonly string[]): SerieEnMs[] | null {
  const filas = lineas.map((l) => l.trim()).filter(Boolean);
  if (filas.length < 4) return null;
  const cabecera = filas[0] ?? '';
  const separador = cabecera.includes('\t') ? '\t' : cabecera.includes(';') ? ';' : cabecera.includes(',') ? ',' : null;
  // Una sola columna, solo si su cabecera dice la unidad entre paréntesis (`tiempo (s)`): si no, es una medida por
  // línea con su título.
  if (!separador && !UNIDAD_ENTRE.test(cabecera)) return null;
  const partir = (l: string) => (separador ? l.split(separador) : [l]).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
  const nombres = partir(cabecera);
  if (nombres.length < 1 || nombres.some((n) => !n || CELDA.test(n))) return null;
  const columnas = nombres.map(() => [] as number[]);
  const unidades: (string | null)[] = nombres.map((n) => UNIDAD_CABECERA.exec(n)?.slice(1).find(Boolean) ?? null);
  const porSufijo = nombres.map((n) => !UNIDAD_ENTRE.test(n) && UNIDAD_SUFIJO.test(n));
  const conDecimales = nombres.map(() => false);
  for (const fila of filas.slice(1)) {
    const celdas = partir(fila);
    // Una columna más corta (20 repeticiones frente a 30) deja sus celdas vacías al final.
    if (celdas.length > nombres.length) return null;
    for (const [i, c] of celdas.entries()) {
      if (!c) continue;
      const m = CELDA.exec(c);
      if (!m || (separador === ',' && /,/.test(m[1] ?? ''))) return null;
      const unidad = m[2] ?? unidades[i];
      if (!unidad) return null;
      if (m[2]) porSufijo[i] = false;
      unidades[i] = unidad;
      if (/[.,]/.test(m[1] ?? '')) conDecimales[i] = true;
      const ms = Number((m[1] ?? '').replace(',', '.')) * (A_MS[unidad.toLowerCase()] ?? A_MS[unidad] ?? Number.NaN);
      if (!Number.isFinite(ms) || ms < 0) return null;
      columnas[i]?.push(ms);
    }
  }
  // Una unidad que solo dice un sufijo, con enteros (`ventas_us`): no son tiempos.
  if (porSufijo.some((s, i) => s && !conDecimales[i])) return null;
  if (columnas.some((c) => c.length < 3)) return null;
  return nombres.map((n, i) => ({
    etiqueta: n.replace(UNIDAD_CABECERA, '').trim() || n,
    ms: columnas[i] ?? [],
  }));
}
