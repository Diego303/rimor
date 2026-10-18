/**
 * Series de mediciones (LEC-06, plan §8.3): una medida por línea (con o sin unidad), `go test -bench` y el JSON
 * de hyperfine. TS puro: lo usan la detección (hilo principal) y la derivación (Worker).
 */

/** Unidad en la que se guardan los valores de una serie (la vista puede enseñarlos en µs o ns). */
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
const A_MS: Record<string, number> = { ns: 1e-6, us: 1e-3, µs: 1e-3, μs: 1e-3, ms: 1, s: 1000, min: 60_000 };

/** Por encima de esto (en ms), si todos los valores lo pasan, la serie va en segundos. */
const UMBRAL_SEGUNDOS_MS = 10_000;

/**
 * Un número: con miles y decimales a la inglesa (`1,234.5`) o a la española (`1.234,5`); si solo hay un separador,
 * es el decimal (`38,41`, `38.41`, `.5`). Con exponente (`1e3`).
 */
const NUMERO = String.raw`\d{1,3}(?:,\d{3})+\.\d+|\d{1,3}(?:\.\d{3})+,\d+|\d*[.,]\d+(?:e[-+]?\d+)?|\d+(?:e[-+]?\d+)?`;
/**
 * Un número con unidad de tiempo, que no forme parte de otra palabra («12 sec» no; «12 s,» sí) ni de un rango o
 * una resta (`10-12 ms`). Sin signo: un tiempo negativo no es una medida.
 */
const CON_UNIDAD = new RegExp(String.raw`(?<![\w.,-])(${NUMERO})[ \t]*(ns|us|µs|μs|ms|s|min)(?![\p{L}\d])`, 'giu');
/** La línea entera es un número. */
const SOLO_NUMERO = new RegExp(String.raw`^(${NUMERO})$`, 'i');
/** `BenchmarkNombre-8   1000000   1234 ns/op …` (el sufijo `-N` es GOMAXPROCS, o la lista de `-cpu`). */
const GO_BENCH = /^Benchmark(\S+)\s+\d+\s+(\d+(?:\.\d+)?)\s+(ns|us|µs|ms|s)\/op\b/;
/** Lo que acompaña a `go test -bench`: entorno, paquete, resultado. */
const GO_CONTEXTO = /^(?:goos|goarch|pkg|cpu):|^PASS$|^FAIL\b|^ok\s|^---|^===|^exit status/;

/** El valor de un número escrito con cualquiera de las formas de `NUMERO`. */
export function aNumero(s: string): number {
  if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(s)) return Number(s.replaceAll(',', ''));
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(s)) return Number(s.replaceAll('.', '').replace(',', '.'));
  return Number(s.replace(',', '.'));
}

/** Lo que delata una línea de log con una duración: una hora, una fecha o un nivel. */
const PARECE_LOG = /\d:\d\d|\d{4}-\d\d|\b(?:TRACE|DEBUG|INFO|WARN(?:ING)?|ERROR|FATAL)\b/;
/** Palabras que puede llevar una medida además del número («run 3: 38.4 ms»). */
const MAX_PALABRAS = 6;
/**
 * Lo que puede acompañar a una medida al detectar: una etiqueta corta con letras, como mucho un número (el de la
 * repetición) y `: = # - _ .`. Sin barras, paréntesis ni marcas de pruebas: así no pasan una petición HTTP
 * (`GET /api 200 12 ms`), una línea de vitest (`✓ a.test.ts (5 tests) 12ms`) ni el resumen de `go test`.
 */
const ETIQUETA_DE_MEDIDA = /^[\p{L}\s:=#_.-]*\d*[\p{L}\s:=#_.-]*$/u;
const NO_ES_MEDIDA = /^\s*(?:ok|FAIL|PASS|---|===)\b/;

export interface Medida {
  ms: number;
  /** Lo que acompaña al número en la línea (sin cifras), para ver si las medidas son de lo mismo. */
  etiqueta: string;
  conUnidad: boolean;
}

/**
 * La medida de una línea, o `null` si no lo es: tiene que haber exactamente un número con unidad, o ser la línea
 * solo un número (en ms). Con dos medidas en la línea no se sabe cuál es. `estricta` (al detectar) descarta además
 * las líneas que parecen de log, de otra herramienta o una frase con una duración.
 */
export function medidaDe(linea: string, estricta = false): Medida | null {
  const l = linea.trim();
  if (!l) return null;
  const solo = SOLO_NUMERO.exec(l);
  if (solo?.[1]) {
    const v = aNumero(solo[1]);
    return Number.isFinite(v) ? { ms: v, etiqueta: '', conUnidad: false } : null;
  }
  const encontradas = [...l.matchAll(CON_UNIDAD)];
  if (encontradas.length !== 1) return null;
  const [medida, num, unidad] = encontradas[0] as RegExpExecArray;
  const resto = l.replace(medida, ' ');
  if (estricta) {
    if (PARECE_LOG.test(resto) || NO_ES_MEDIDA.test(resto) || !ETIQUETA_DE_MEDIDA.test(resto)) return null;
    if (resto.split(/\s+/).filter(Boolean).length > MAX_PALABRAS) return null;
  }
  const factor = A_MS[(unidad ?? '').toLowerCase()];
  const v = aNumero(num ?? '') * (factor ?? Number.NaN);
  if (!Number.isFinite(v)) return null;
  return {
    ms: v,
    etiqueta: resto
      .replace(/[\d\s:=#_.-]+/g, ' ')
      .trim()
      .toLowerCase(),
    conUnidad: true,
  };
}

/** El valor en ms de una línea de medida, o `null` (ver `medidaDe`). */
export const medidaDeLinea = (linea: string, estricta = false): number | null => medidaDe(linea, estricta)?.ms ?? null;

/** Comentario `#`: da la etiqueta de las medidas que le siguen, hasta un `·`. */
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
    const ms = times
      .filter((x): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0)
      .map((x) => x * 1000)
      .filter(Number.isFinite);
    if (ms.length) series.push({ etiqueta: typeof command === 'string' ? command : null, ms });
  }
  return series.length ? enSuUnidad(series) : null;
}

/**
 * `go test -bench` (con `-count=N`): una serie por benchmark y paquete, en el orden en que aparecen. El sufijo
 * `-N` es GOMAXPROCS si todos los benchmarks lo llevan igual (se quita); si no (`-cpu=1,2,4`), distingue series.
 * Un benchmark con el mismo nombre en dos paquetes lleva el paquete entre paréntesis.
 */
function deGo(lineas: string[]): Serie[] | null {
  const filas: { pkg: string; nombre: string; ms: number }[] = [];
  let pkg = '';
  for (const l of lineas) {
    const t = l.trim();
    const p = /^pkg:\s*(\S+)/.exec(t);
    if (p?.[1]) pkg = p[1];
    const m = GO_BENCH.exec(t);
    if (!m) continue;
    const ms = Number(m[2]) * (A_MS[m[3] ?? ''] ?? Number.NaN);
    if (Number.isFinite(ms)) filas.push({ pkg, nombre: m[1] ?? '', ms });
  }
  if (!filas.length) return null;
  const sufijos = new Set(filas.map((f) => /-\d+$/.exec(f.nombre)?.[0] ?? ''));
  const [unico] = sufijos;
  const quitar = sufijos.size === 1 && unico ? unico : '';
  const base = (n: string) => (quitar && n.endsWith(quitar) ? n.slice(0, -quitar.length) : n);
  const paquetesDe = new Map<string, Set<string>>();
  for (const f of filas) paquetesDe.set(base(f.nombre), (paquetesDe.get(base(f.nombre)) ?? new Set()).add(f.pkg));
  const series = new Map<string, SerieEnMs>();
  for (const f of filas) {
    const nombre = base(f.nombre);
    const enVarios = (paquetesDe.get(nombre)?.size ?? 0) > 1;
    const etiqueta = enVarios && f.pkg ? `${nombre} (${f.pkg.split('/').at(-1)})` : nombre;
    const clave = `${f.pkg}\u0000${nombre}`;
    const s = series.get(clave) ?? { etiqueta, ms: [] };
    s.ms.push(f.ms);
    series.set(clave, s);
  }
  return enSuUnidad([...series.values()]);
}

/** Una medida por línea; cada comentario `#` tras unas medidas empieza otra serie, con su etiqueta. */
function deLineas(lineas: string[]): Serie[] {
  const series: SerieEnMs[] = [];
  let actual: SerieEnMs = { etiqueta: null, ms: [] };
  for (const l of lineas) {
    if (comentario(l)) {
      if (actual.ms.length) {
        series.push(actual);
        actual = { etiqueta: etiquetaDe(l), ms: [] };
      } else actual.etiqueta ??= etiquetaDe(l);
      continue;
    }
    const m = medidaDe(l);
    if (m && m.ms >= 0) actual.ms.push(m.ms);
  }
  if (actual.ms.length) series.push(actual);
  return enSuUnidad(series);
}

/** Separadores de columna: si casi todas las líneas los tienen, es una tabla y la coma no es decimal. */
function pareceTabla(lineas: string[]): boolean {
  const datos = lineas.filter((l) => l.trim() && !comentario(l));
  if (datos.length < 2) return false;
  const conSeparador = datos.filter((l) => /[,;\t]/.test(l.trim()));
  if (conSeparador.length / datos.length < 0.7) return false;
  // Una cabecera sin números, o filas con dos separadores o más.
  return (
    datos.some((l) => /[,;\t]/.test(l) && !/\d/.test(l)) || datos.some((l) => (l.match(/[,;\t]/g) ?? []).length >= 2)
  );
}

export function leerSeries(texto: string): LecturaMediciones {
  const hyperfine = deHyperfine(texto);
  if (hyperfine) return { formato: 'hyperfine', series: hyperfine };
  const lineas = texto.split(/\r?\n/);
  const go = deGo(lineas);
  if (go) return { formato: 'go', series: go };
  // Una tabla (CSV) no es una serie: su coma separa columnas.
  if (pareceTabla(lineas)) return { formato: 'lineas', series: [] };
  return { formato: 'lineas', series: deLineas(lineas) };
}

/** Con decimales y sin avanzar de paso fijo: una serie medida, no una numeración. */
function parecenTiempos(valores: number[]): boolean {
  if (!valores.some((v) => !Number.isInteger(v))) return false;
  const pasos = valores.slice(1).map((v, i) => v - (valores[i] as number));
  return !pasos.every((p) => Math.abs(p - (pasos[0] as number)) < 1e-9);
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
  // `go test -bench`: casi todo son líneas de benchmark (lo demás, su contexto). Una suelta en un log no basta.
  const deGoTest = lineas.filter((l) => !GO_CONTEXTO.test(l.trim()));
  const bench = deGoTest.filter((l) => GO_BENCH.test(l.trim())).length;
  if (bench >= 1 && bench / deGoTest.length >= FRACCION_MEDIDAS) return 0.9;
  if (pareceTabla(lineas)) return 0;
  const datos = lineas.filter((l) => !comentario(l));
  const medidas = datos.map((l) => medidaDe(l, true)).filter((m): m is Medida => m !== null && m.ms >= 0);
  if (medidas.length < MINIMO_MEDIDAS || medidas.length / datos.length < FRACCION_MEDIDAS) return 0;
  // Números sueltos sin unidad ni comentario que los presente: solo si parecen tiempos medidos (con decimales y sin
  // un paso fijo). Años, IDs y versiones (`1.2`, `1.3`, `1.4`) no se suponen mediciones.
  if (!medidas.some((m) => m.conUnidad) && !lineas.some(comentario) && !parecenTiempos(medidas.map((m) => m.ms)))
    return 0;
  // Una lista de cosas distintas con su duración (`timeout: 30s`, `retry: 5s`) no es una serie de lo mismo.
  const etiquetas = new Set(medidas.map((m) => m.etiqueta).filter(Boolean));
  if (etiquetas.size > 1 && etiquetas.size > medidas.length / 2) return 0;
  return 0.88;
}
