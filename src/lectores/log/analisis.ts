/**
 * Análisis de logs (LEC-04, F0-6): marcas de tiempo, niveles, plantillas, pares `clave=valor`, primer y último
 * error e histograma, por bloques de 50.000 líneas. TS puro: se ejecuta en el Worker de derivados.
 */

export type Nivel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type Formato = 'texto' | 'json' | 'logfmt' | 'syslog' | 'apache';

export const BLOQUE = 50_000;
const MAX_PARES = 30;
const MAX_VALORES = 5;

export interface Marca {
  /** Instante (ms desde 1970), para ordenar y agrupar. */
  ms: number;
  /** La hora tal como está escrita en el log: «17:40:01». */
  pared: string;
}

export interface LineaAnalizada {
  marca: Marca | null;
  nivel: Nivel;
  formato: Formato;
  plantilla: string;
  pares: [string, string][];
}

const MESES: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const ISO = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}))?\s?(Z|[+-]\d{2}:?\d{2})?/;
const GO = /(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?/;
const SYSLOG = /^(?:<\d+>)?([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2})/;
const APACHE = /\[(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-]\d{4})\]/;
const HORA = /^\s*\[?(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\]?/;
/** PHP: `[18-Oct-2026 21:00:01 UTC] PHP Warning: …`. */
const PHP = /\[(\d{2})-([A-Z][a-z]{2})-(\d{4}) (\d{2}):(\d{2}):(\d{2})(?: ([A-Za-z/_+-]+))?\]/;
/** klog (Kubernetes, glog): `E1018 16:00:01.123456 …`, con el nivel en la letra inicial. */
const KLOG = /^([IWEF])(\d{2})(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\s/;

/** Milisegundos de un desfase `+02:00`, `+0200` o `Z` (0); `null` si no hay (hora local). */
function desfase(z: string | undefined): number | null {
  if (!z) return null;
  if (z === 'Z') return 0;
  const m = /([+-])(\d{2}):?(\d{2})/.exec(z);
  if (!m) return null;
  const s = m[1] === '-' ? -1 : 1;
  return s * (Number(m[2]) * 60 + Number(m[3])) * 60_000;
}

/** Número de una parte capturada (que siempre está si la expresión casó). */
const n = (x: string | undefined): number => Number(x ?? 0);

const ms3 = (f: string | undefined) => (f ? Number(f.slice(0, 3).padEnd(3, '0')) : 0);

function instante(
  a: number,
  mes: number,
  d: number,
  h: number,
  mi: number,
  s: number,
  mil: number,
  z: number | null,
): number {
  return z === null ? new Date(a, mes, d, h, mi, s, mil).getTime() : Date.UTC(a, mes, d, h, mi, s, mil) - z;
}

const pared = (h: string | number, m: string | number, s: string | number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

/** Marca de un texto de fecha (o de un número de segundos o milisegundos, en JSON). */
export function marcaDe(texto: string | number, anioPorDefecto: number): Marca | null {
  if (typeof texto === 'number' || /^\d{10}(?:\d{3})?(?:\.\d+)?$/.test(texto)) {
    const n = Number(texto);
    const ms = n < 1e12 ? n * 1000 : n;
    const d = new Date(ms);
    return Number.isFinite(ms) ? { ms, pared: pared(d.getHours(), d.getMinutes(), d.getSeconds()) } : null;
  }
  let m = ISO.exec(texto);
  if (m) {
    const [, a, mes, d, h, mi, s, f, z] = m;
    return {
      ms: instante(n(a), n(mes) - 1, n(d), n(h), n(mi), n(s), ms3(f), desfase(z)),
      pared: pared(h ?? 0, mi ?? 0, s ?? 0),
    };
  }
  m = APACHE.exec(texto);
  if (m) {
    const [, d, mes, a, h, mi, s, z] = m;
    const numMes = MESES[(mes ?? '').toLowerCase()];
    if (numMes !== undefined)
      return {
        ms: instante(n(a), numMes, n(d), n(h), n(mi), n(s), 0, desfase(z)),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
      };
  }
  m = GO.exec(texto);
  if (m) {
    const [, a, mes, d, h, mi, s, f] = m;
    return {
      ms: instante(n(a), n(mes) - 1, n(d), n(h), n(mi), n(s), ms3(f), null),
      pared: pared(h ?? 0, mi ?? 0, s ?? 0),
    };
  }
  m = PHP.exec(texto);
  if (m) {
    const [, d, mes, a, h, mi, s, zona] = m;
    const numMes = MESES[(mes ?? '').toLowerCase()];
    const z = zona === 'UTC' || zona === 'GMT' ? 0 : null;
    if (numMes !== undefined)
      return { ms: instante(n(a), numMes, n(d), n(h), n(mi), n(s), 0, z), pared: pared(h ?? 0, mi ?? 0, s ?? 0) };
  }
  m = KLOG.exec(texto);
  if (m) {
    const [, , mes, d, h, mi, s, f] = m;
    return {
      ms: instante(anioPorDefecto, n(mes) - 1, n(d), n(h), n(mi), n(s), ms3(f), null),
      pared: pared(h ?? 0, mi ?? 0, s ?? 0),
    };
  }
  m = SYSLOG.exec(texto);
  if (m) {
    const [, mes, d, h, mi, s] = m;
    const numMes = MESES[(mes ?? '').toLowerCase()];
    if (numMes !== undefined)
      return {
        ms: instante(anioPorDefecto, numMes, n(d), n(h), n(mi), n(s), 0, null),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
      };
  }
  m = HORA.exec(texto);
  if (m) {
    const [, h, mi, s, f] = m;
    // Solo hora: el día no se sabe; se cuenta desde el 1 de enero de ese año, para ordenar dentro del log.
    return {
      ms: instante(anioPorDefecto, 0, 1, n(h), n(mi), n(s), ms3(f), null),
      pared: pared(h ?? 0, mi ?? 0, s ?? 0),
    };
  }
  return null;
}

const NIVELES: Record<string, Nivel> = {
  trace: 'TRACE',
  debug: 'DEBUG',
  dbg: 'DEBUG',
  info: 'INFO',
  information: 'INFO',
  notice: 'INFO',
  warn: 'WARN',
  warning: 'WARN',
  error: 'ERROR',
  err: 'ERROR',
  fatal: 'FATAL',
  critical: 'FATAL',
  crit: 'FATAL',
  panic: 'FATAL',
  emerg: 'FATAL',
  alert: 'FATAL',
};

export const nivelDe = (palabra: string): Nivel | null => NIVELES[palabra.toLowerCase()] ?? null;

const CAMPO_NIVEL = /\b(?:level|lvl|severity|loglevel)\s*[=:]\s*"?([A-Za-z]+)"?/i;
const PALABRA_NIVEL =
  /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|ERR|FATAL|CRITICAL|PANIC)\b|\[(trace|debug|info|warn|warning|error|err|fatal|critical)\]/i;
const MAYUSCULAS = /^[A-Z]+$/;
const PALABRA_NIVEL_G = new RegExp(PALABRA_NIVEL.source, 'gi');
const NIVEL_DE_PHP = /\bPHP (Fatal error|Parse error|Recoverable fatal error|Warning|Notice|Deprecated)\b/;

/** Nivel de una línea de texto: campo de nivel, palabra en mayúsculas o entre corchetes. */
const NIVEL_KLOG: Record<string, Nivel> = { I: 'INFO', W: 'WARN', E: 'ERROR', F: 'FATAL' };
const NIVEL_PHP: Record<string, Nivel> = {
  'fatal error': 'FATAL',
  'parse error': 'ERROR',
  'recoverable fatal error': 'ERROR',
  warning: 'WARN',
  notice: 'INFO',
  deprecated: 'INFO',
};

function nivelDeTexto(linea: string): Nivel | null {
  const klog = KLOG.exec(linea);
  if (klog?.[1]) return NIVEL_KLOG[klog[1]] ?? null;
  const php = NIVEL_DE_PHP.exec(linea);
  if (php?.[1]) return NIVEL_PHP[php[1].toLowerCase()] ?? null;
  const campo = CAMPO_NIVEL.exec(linea);
  if (campo?.[1]) {
    const n = nivelDe(campo[1]);
    if (n) return n;
  }
  for (const m of linea.matchAll(PALABRA_NIVEL_G)) {
    // Una palabra suelta solo cuenta en mayúsculas («no error» en un mensaje no es un nivel).
    const palabra = m[1] ?? m[2] ?? '';
    if (m[1] && !MAYUSCULAS.test(palabra)) continue;
    const n = nivelDe(palabra);
    if (n) return n;
  }
  return null;
}

/** Quita las marcas de tiempo de todos los formatos, para que no cuenten en la plantilla. */
const ISO_G = new RegExp(ISO.source, 'g');
const APACHE_G = new RegExp(APACHE.source, 'g');
const PHP_G = new RegExp(PHP.source, 'g');
const GO_G = new RegExp(GO.source, 'g');

export function sinMarcas(linea: string): string {
  return (
    linea
      .replace(ISO_G, '')
      .replace(APACHE_G, '')
      .replace(PHP_G, '')
      .replace(GO_G, '')
      .replace(SYSLOG, '')
      // De klog queda la letra del nivel, para que «E» e «I» no compartan plantilla.
      .replace(KLOG, (m) => `${m.charAt(0)} `)
      .replace(HORA, '')
  );
}

/**
 * Normalización de la pantalla de referencia: fechas fuera y UUID, IP, hexadecimales y números por marcadores.
 * Idempotente: los marcadores no contienen nada que se vuelva a sustituir.
 */
export function normalizar(linea: string): string {
  return sinMarcas(linea)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<ID>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<IP>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{12,}\b/gi, '<HEX>')
    .replace(/\b\d+(?:\.\d+)?/g, '<N>')
    .replace(/\s+/g, ' ')
    .trim();
}

const PAR = /([A-Za-z_][\w.-]*)=("(?:[^"\\]|\\.)*"|[^\s"]+)/g;
const CLAVES_MENSAJE = ['msg', 'message', 'mensaje', 'text', 'event'];
const CLAVES_MARCA = ['time', 'timestamp', 'ts', '@timestamp', 'datetime', 'date', 't'];
const CLAVES_NIVEL = ['level', 'lvl', 'severity', 'loglevel', 'log.level'];

function paresDe(linea: string): [string, string][] {
  const pares: [string, string][] = [];
  for (const m of linea.matchAll(PAR)) pares.push([m[1] ?? '', (m[2] ?? '').replace(/^"|"$/g, '')]);
  return pares;
}

/** Analiza una línea con su formato. */
export function analizarLinea(linea: string, anio: number): LineaAnalizada {
  const t = linea.trim();
  if (t.startsWith('{') && t.endsWith('}')) {
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      if (o && typeof o === 'object' && !Array.isArray(o)) {
        const clave = (lista: string[]) => lista.find((k) => k in o);
        const kMarca = clave(CLAVES_MARCA);
        const kNivel = clave(CLAVES_NIVEL);
        const kMsg = clave(CLAVES_MENSAJE);
        const valorMarca = kMarca ? o[kMarca] : undefined;
        const marca =
          typeof valorMarca === 'string' || typeof valorMarca === 'number' ? marcaDe(valorMarca, anio) : null;
        const nivel = (kNivel && typeof o[kNivel] === 'string' ? nivelDe(o[kNivel] as string) : null) ?? 'INFO';
        const resto = Object.keys(o)
          .filter((k) => k !== kMarca && k !== kNivel && k !== kMsg)
          .sort();
        const msg = kMsg && typeof o[kMsg] === 'string' ? normalizar(o[kMsg] as string) : '';
        const pares = Object.entries(o)
          .filter(
            ([k, v]) =>
              k !== kMarca && k !== kMsg && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
          )
          .map(([k, v]) => [k, String(v)] as [string, string]);
        return {
          marca,
          nivel,
          formato: 'json',
          plantilla: [nivel, msg, resto.length ? `{${resto.join(',')}}` : ''].filter(Boolean).join(' '),
          pares,
        };
      }
    } catch {
      // No era JSON: se trata como texto.
    }
  }
  const pares = paresDe(t);
  const esLogfmt =
    pares.length >= 2 &&
    pares.some(
      ([k]) =>
        CLAVES_NIVEL.includes(k.toLowerCase()) ||
        CLAVES_MENSAJE.includes(k.toLowerCase()) ||
        CLAVES_MARCA.includes(k.toLowerCase()),
    );
  if (esLogfmt) {
    const mapa = new Map(pares.map(([k, v]) => [k.toLowerCase(), v]));
    const kMarca = CLAVES_MARCA.find((k) => mapa.has(k));
    const kNivel = CLAVES_NIVEL.find((k) => mapa.has(k));
    const kMsg = CLAVES_MENSAJE.find((k) => mapa.has(k));
    const marca = kMarca ? marcaDe(mapa.get(kMarca) ?? '', anio) : marcaDe(t, anio);
    const nivel = (kNivel ? nivelDe(mapa.get(kNivel) ?? '') : null) ?? 'INFO';
    const resto = [...mapa.keys()].filter((k) => k !== kMarca && k !== kNivel && k !== kMsg).sort();
    const msg = kMsg ? normalizar(mapa.get(kMsg) ?? '') : '';
    return {
      marca,
      nivel,
      formato: 'logfmt',
      plantilla: [nivel, msg, resto.length ? `{${resto.join(',')}}` : ''].filter(Boolean).join(' '),
      pares: pares.filter(([k]) => k.toLowerCase() !== kMarca && k.toLowerCase() !== kMsg),
    };
  }
  const apache = APACHE.test(t) && /"\s*(\d{3})\s/.exec(t);
  let nivel = nivelDeTexto(t);
  if (!nivel && apache) {
    const estado = Number(apache[1]);
    nivel = estado >= 500 ? 'ERROR' : estado >= 400 ? 'WARN' : 'INFO';
  }
  return {
    marca: marcaDe(t, anio),
    nivel: nivel ?? 'INFO',
    formato: apache ? 'apache' : SYSLOG.test(t) ? 'syslog' : 'texto',
    plantilla: normalizar(t),
    pares,
  };
}

export interface Barra {
  inicio: number;
  pared: string;
  errores: number;
  avisos: number;
  otros: number;
}

export interface Plantilla {
  plantilla: string;
  n: number;
  nivel: Nivel;
}

export interface Suceso {
  linea: number;
  pared: string | null;
  texto: string;
}

export interface DatosLog {
  lineas: number;
  formato: Formato;
  desde: string | null;
  hasta: string | null;
  duracionMs: number | null;
  niveles: Record<Nivel, number>;
  plantillas: Plantilla[];
  /** Índice en `plantillas` de cada línea con contenido (-1 en las vacías). */
  lineaPlantilla: number[];
  pares: { clave: string; n: number; valores: { valor: string; n: number }[] }[];
  primerError: Suceso | null;
  ultimoError: Suceso | null;
  histograma: { paso: 'minuto' | 'hora' | 'dia'; barras: Barra[] } | null;
  /** La ventana más corta de barras con al menos el 80 % de los errores. */
  concentracion: { desde: string; hasta: string } | null;
}

const VACIO_NIVELES = (): Record<Nivel, number> => ({ TRACE: 0, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 });
const esError = (n: Nivel) => n === 'ERROR' || n === 'FATAL';
const MINUTO = 60_000;
const HORA_MS = 60 * MINUTO;

export interface OpcionesAnalisis {
  alProgreso?: (hechas: number, total: number) => void;
  /** Año para las marcas sin año (syslog, solo hora). */
  anio?: number;
}

/** Analiza un log entero, por bloques de 50.000 líneas que se suman. */
export function analizar(
  texto: string,
  { alProgreso, anio = new Date().getFullYear() }: OpcionesAnalisis = {},
): DatosLog {
  const lineas = texto.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  const niveles = VACIO_NIVELES();
  const indice = new Map<string, number>();
  const plantillas: Plantilla[] = [];
  const lineaPlantilla: number[] = new Array(lineas.length).fill(-1);
  const pares = new Map<string, { n: number; valores: Map<string, number> }>();
  const formatos = new Map<Formato, number>();
  const marcas: { ms: number; pared: string; nivel: Nivel }[] = [];
  let primerError: Suceso | null = null;
  let ultimoError: Suceso | null = null;
  let conContenido = 0;

  for (let inicio = 0; inicio < lineas.length; inicio += BLOQUE) {
    const fin = Math.min(lineas.length, inicio + BLOQUE);
    for (let i = inicio; i < fin; i++) {
      const linea = lineas[i] ?? '';
      if (!linea.trim()) continue;
      conContenido++;
      const a = analizarLinea(linea, anio);
      niveles[a.nivel]++;
      formatos.set(a.formato, (formatos.get(a.formato) ?? 0) + 1);
      let k = indice.get(a.plantilla);
      if (k === undefined) {
        k = plantillas.length;
        indice.set(a.plantilla, k);
        plantillas.push({ plantilla: a.plantilla, n: 0, nivel: a.nivel });
      }
      const p = plantillas[k];
      if (p) p.n++;
      lineaPlantilla[i] = k;
      for (const [clave, valor] of a.pares) {
        const e = pares.get(clave) ?? { n: 0, valores: new Map<string, number>() };
        e.n++;
        if (e.valores.size < 200 || e.valores.has(valor)) e.valores.set(valor, (e.valores.get(valor) ?? 0) + 1);
        pares.set(clave, e);
      }
      if (a.marca) marcas.push({ ms: a.marca.ms, pared: a.marca.pared, nivel: a.nivel });
      if (esError(a.nivel)) {
        const suceso = { linea: i + 1, pared: a.marca?.pared ?? null, texto: linea.slice(0, 300) };
        primerError ??= suceso;
        ultimoError = suceso;
      }
    }
    alProgreso?.(fin, lineas.length);
  }

  // Orden por frecuencia; los índices de cada línea se reasignan al nuevo orden.
  const orden = plantillas.map((_, i) => i).sort((a, b) => (plantillas[b]?.n ?? 0) - (plantillas[a]?.n ?? 0) || a - b);
  const nuevo = new Array<number>(plantillas.length);
  orden.forEach((viejo, i) => {
    nuevo[viejo] = i;
  });
  for (let i = 0; i < lineaPlantilla.length; i++) {
    const v = lineaPlantilla[i] ?? -1;
    if (v >= 0) lineaPlantilla[i] = nuevo[v] ?? -1;
  }

  // Con un bucle: `Math.min(...ms)` desborda la pila con cientos de miles de marcas.
  let minimo: number | null = null;
  let maximo: number | null = null;
  for (const m of marcas) {
    if (minimo === null || m.ms < minimo) minimo = m.ms;
    if (maximo === null || m.ms > maximo) maximo = m.ms;
  }
  const primeraMarca = marcas.find((m) => m.ms === minimo);
  const ultimaMarca = [...marcas].reverse().find((m) => m.ms === maximo);
  const histograma = minimo !== null && maximo !== null ? histogramaDe(marcas, minimo, maximo) : null;

  return {
    lineas: conContenido,
    formato: [...formatos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'texto',
    desde: primeraMarca?.pared ?? null,
    hasta: ultimaMarca?.pared ?? null,
    duracionMs: minimo !== null && maximo !== null ? maximo - minimo : null,
    niveles,
    plantillas: orden.map((i) => plantillas[i]).filter((p): p is Plantilla => Boolean(p)),
    lineaPlantilla,
    pares: [...pares]
      .sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]))
      .slice(0, MAX_PARES)
      .map(([clave, e]) => ({
        clave,
        n: e.n,
        valores: [...e.valores]
          .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
          .slice(0, MAX_VALORES)
          .map(([valor, n]) => ({ valor, n })),
      })),
    primerError,
    ultimoError,
    histograma,
    concentracion: histograma ? concentracionDe(histograma.barras) : null,
  };
}

function histogramaDe(
  marcas: { ms: number; pared: string; nivel: Nivel }[],
  minimo: number,
  maximo: number,
): DatosLog['histograma'] {
  const rango = maximo - minimo;
  const paso = rango > 20 * 24 * HORA_MS ? 'dia' : rango > 6 * HORA_MS ? 'hora' : 'minuto';
  const tam = paso === 'dia' ? 24 * HORA_MS : paso === 'hora' ? HORA_MS : MINUTO;
  const base = Math.floor(minimo / tam) * tam;
  const n = Math.floor((maximo - base) / tam) + 1;
  const barras: Barra[] = Array.from({ length: n }, (_, i) => ({
    inicio: base + i * tam,
    pared: '',
    errores: 0,
    avisos: 0,
    otros: 0,
  }));
  for (const m of marcas) {
    const b = barras[Math.floor((m.ms - base) / tam)];
    if (!b) continue;
    if (!b.pared)
      b.pared =
        paso === 'minuto'
          ? m.pared.slice(0, 5)
          : paso === 'hora'
            ? `${m.pared.slice(0, 2)}:00`
            : new Date(b.inicio).toISOString().slice(5, 10).split('-').reverse().join('/');
    if (esError(m.nivel)) b.errores++;
    else if (m.nivel === 'WARN') b.avisos++;
    else b.otros++;
  }
  // Las barras sin líneas toman la etiqueta que les toca contando desde la vecina (para el eje).
  const primera = barras.findIndex((b) => b.pared);
  for (let i = primera - 1; i >= 0; i--) {
    const b = barras[i];
    if (b) b.pared = etiquetaDesplazada(barras[i + 1]?.pared ?? '', paso, -1, b.inicio);
  }
  for (let i = Math.max(primera, 0) + 1; i < barras.length; i++) {
    const b = barras[i];
    if (b && !b.pared) b.pared = etiquetaDesplazada(barras[i - 1]?.pared ?? '', paso, 1, b.inicio);
  }
  return { paso, barras };
}

/** La etiqueta de una barra vecina movida un paso: «17:59» + 1 minuto = «18:00»; los días, por su fecha. */
function etiquetaDesplazada(vecina: string, paso: 'minuto' | 'hora' | 'dia', sentido: 1 | -1, inicio: number): string {
  if (paso === 'dia') return new Date(inicio).toISOString().slice(5, 10).split('-').reverse().join('/');
  const [h, m] = vecina.split(':').map(Number);
  const minutos = paso === 'minuto' ? 1 : 60;
  const total = ((((h ?? 0) * 60 + (m ?? 0) + sentido * minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** La ventana más corta de barras con al menos el 80 % de los errores. */
export function concentracionDe(barras: readonly Barra[]): DatosLog['concentracion'] {
  const total = barras.reduce((s, b) => s + b.errores, 0);
  if (!total) return null;
  const objetivo = Math.ceil(total * 0.8);
  let mejor: [number, number] | null = null;
  let suma = 0;
  let izq = 0;
  for (let der = 0; der < barras.length; der++) {
    suma += barras[der]?.errores ?? 0;
    while (suma - (barras[izq]?.errores ?? 0) >= objetivo && izq < der) suma -= barras[izq++]?.errores ?? 0;
    if (suma >= objetivo && (!mejor || der - izq < mejor[1] - mejor[0])) mejor = [izq, der];
  }
  if (!mejor) return null;
  return { desde: barras[mejor[0]]?.pared ?? '', hasta: barras[mejor[1]]?.pared ?? '' };
}
