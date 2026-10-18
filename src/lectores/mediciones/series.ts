/**
 * Series de mediciones (LEC-06, plan §8.3): una medida por línea (con o sin unidad), `go test -bench` y el JSON
 * de hyperfine. TS puro: lo usan la detección (hilo principal) y la derivación (Worker).
 */

/** Unidad en la que se guardan y se muestran los valores de una serie. */
export type UnidadSerie = 'ms' | 's';

export interface Serie {
  /** El nombre de la serie: el comentario `#`, el benchmark o el comando; `null` si no lo hay. */
  etiqueta: string | null;
  unidad: UnidadSerie;
  /** En `unidad`, en el orden en que se midieron. */
  valores: number[];
}

/** Formato del que salió la serie. */
export type FormatoMediciones = 'lineas' | 'go' | 'hyperfine';

export interface LecturaMediciones {
  formato: FormatoMediciones;
  series: Serie[];
}

/** Milisegundos por unidad. `µ` (U+00B5) y `μ` (U+03BC) se escriben igual. */
const A_MS: Record<string, number> = { ns: 1e-6, us: 1e-3, µs: 1e-3, μs: 1e-3, ms: 1, s: 1000 };

/** Por encima de esto (en ms), si todos los valores lo pasan, la serie va en segundos. */
const UMBRAL_SEGUNDOS_MS = 10_000;

const NUMERO = String.raw`[-+]?\d+(?:[.,]\d+)?(?:e[-+]?\d+)?`;
/** Un número con unidad de tiempo, que no forme parte de otra palabra («12 sec» no; «12 s,» sí). */
const CON_UNIDAD = new RegExp(String.raw`(?<![\w.,])(${NUMERO})[ \t]*(ns|us|µs|μs|ms|s)(?![\p{L}\d])`, 'giu');
/** La línea entera es un número. */
const SOLO_NUMERO = new RegExp(String.raw`^(${NUMERO})$`, 'i');
/** `BenchmarkNombre-8   1000000   1234 ns/op …` (el sufijo `-N` es GOMAXPROCS). */
const GO_BENCH = /^(Benchmark\S+?)(?:-\d+)?\s+\d+\s+(\d+(?:\.\d+)?)\s+(ns|us|µs|ms|s)\/op\b/;

const aNumero = (s: string) => Number(s.replace(',', '.'));

/** Lo que delata una línea de log con una duración: una hora, una fecha o un nivel. */
const PARECE_LOG = /\d:\d\d|\d{4}-\d\d|\b(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/;
/** Palabras que puede llevar una medida además del número («run 3: 38.4 ms»). */
const MAX_PALABRAS = 6;

/**
 * El valor en ms de una línea de medida, o `null` si no lo es: tiene que haber exactamente un número con unidad,
 * o ser la línea solo un número (en ms). Con dos medidas en la línea no se sabe cuál es. `estricta` (al detectar)
 * descarta además las líneas que parecen de log o que son una frase con una duración.
 */
export function medidaDeLinea(linea: string, estricta = false): number | null {
  const l = linea.trim();
  if (!l) return null;
  const solo = SOLO_NUMERO.exec(l);
  if (solo?.[1]) {
    const v = aNumero(solo[1]);
    return Number.isFinite(v) ? v : null;
  }
  const encontradas = [...l.matchAll(CON_UNIDAD)];
  if (encontradas.length !== 1) return null;
  const [medida, num, unidad] = encontradas[0] as RegExpExecArray;
  if (estricta) {
    const resto = l.replace(medida, ' ');
    if (PARECE_LOG.test(resto) || resto.split(/\s+/).filter(Boolean).length > MAX_PALABRAS) return null;
  }
  const factor = A_MS[(unidad ?? '').toLowerCase()];
  const v = aNumero(num ?? '');
  return factor !== undefined && Number.isFinite(v) ? v * factor : null;
}

/** Comentario `#`: el primero da la etiqueta, hasta un `·`. */
const comentario = (l: string) => /^\s*#/.test(l);
const etiquetaDe = (l: string) => {
  const e =
    l
      .replace(/^\s*#+\s*/, '')
      .split('·')[0]
      ?.trim() ?? '';
  return e || null;
};

interface SerieEnMs {
  etiqueta: string | null;
  ms: number[];
}

/**
 * Todas las series de un pegado en la misma unidad (para dibujarlas y compararlas juntas): en segundos si todos
 * sus valores pasan de 10 s; si no, en ms.
 */
function enSuUnidad(series: SerieEnMs[]): Serie[] {
  const segundos = series.length > 0 && series.every((s) => s.ms.every((v) => v > UMBRAL_SEGUNDOS_MS));
  return series.map(({ etiqueta, ms }) => ({
    etiqueta,
    unidad: segundos ? 's' : 'ms',
    valores: segundos ? ms.map((v) => v / 1000) : ms,
  }));
}

/** El JSON de hyperfine (`--export-json`): una serie por comando, con `times` en segundos. */
function deHyperfine(texto: string): Serie[] | null {
  const t = texto.trim();
  if (!t.startsWith('{') || !t.includes('"results"')) return null;
  let json: unknown;
  try {
    json = JSON.parse(t);
  } catch {
    return null;
  }
  const resultados = (json as { results?: unknown }).results;
  if (!Array.isArray(resultados)) return null;
  const series: SerieEnMs[] = [];
  for (const r of resultados) {
    if (!r || typeof r !== 'object') continue;
    const { command, times } = r as { command?: unknown; times?: unknown };
    if (!Array.isArray(times)) continue;
    const ms = times.filter((x): x is number => typeof x === 'number' && Number.isFinite(x)).map((x) => x * 1000);
    if (ms.length) series.push({ etiqueta: typeof command === 'string' ? command : null, ms });
  }
  return series.length ? enSuUnidad(series) : null;
}

/** `go test -bench` (con `-count=N`): una serie por benchmark, en el orden en que aparecen. */
function deGo(lineas: string[]): Serie[] | null {
  const porNombre = new Map<string, number[]>();
  for (const l of lineas) {
    const m = GO_BENCH.exec(l.trim());
    if (!m) continue;
    const [, nombre = '', valor = '', unidad = ''] = m;
    const factor = A_MS[unidad] ?? 1;
    const lista = porNombre.get(nombre) ?? [];
    lista.push(Number(valor) * factor);
    porNombre.set(nombre, lista);
  }
  if (!porNombre.size) return null;
  return enSuUnidad(
    [...porNombre].map(([nombre, ms]) => ({ etiqueta: nombre.replace(/^Benchmark/, '') || nombre, ms })),
  );
}

/** Una medida por línea; los comentarios `#` no cuentan y el primero da la etiqueta. */
function deLineas(lineas: string[]): Serie[] {
  let etiqueta: string | null = null;
  const ms: number[] = [];
  for (const l of lineas) {
    if (comentario(l)) {
      etiqueta ??= etiquetaDe(l);
      continue;
    }
    const v = medidaDeLinea(l);
    if (v !== null) ms.push(v);
  }
  return ms.length ? enSuUnidad([{ etiqueta, ms }]) : [];
}

export function leerSeries(texto: string): LecturaMediciones {
  const hyperfine = deHyperfine(texto);
  if (hyperfine) return { formato: 'hyperfine', series: hyperfine };
  const lineas = texto.split(/\r?\n/);
  const go = deGo(lineas);
  if (go) return { formato: 'go', series: go };
  return { formato: 'lineas', series: deLineas(lineas) };
}

/** Líneas con contenido que se miran para detectar. */
const MUESTRA_DETECCION = 500;
/** Al menos 3 medidas, y el 70 % de las líneas que no son comentarios. */
const MINIMO_MEDIDAS = 3;
const FRACCION_MEDIDAS = 0.7;

/** Confianza de que un texto es una serie de mediciones. */
export function confianzaMediciones(texto: string): number {
  if (deHyperfine(texto)) return 0.9;
  const lineas = texto
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, MUESTRA_DETECCION);
  if (lineas.some((l) => GO_BENCH.test(l.trim()))) return 0.9;
  const datos = lineas.filter((l) => !comentario(l));
  const medidas = datos.filter((l) => medidaDeLinea(l, true) !== null).length;
  return medidas >= MINIMO_MEDIDAS && medidas / datos.length >= FRACCION_MEDIDAS ? 0.88 : 0;
}
