/**
 * Análisis de logs (LEC-04, F0-6): marcas de tiempo, niveles, plantillas, pares `clave=valor`, primer y último
 * error e histograma, por bloques de 50.000 líneas. TS puro: se ejecuta en el Worker de derivados.
 */

export type Nivel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
export type Formato = 'texto' | 'json' | 'logfmt' | 'syslog' | 'apache';

export const BLOQUE = 50_000;
const MAX_PARES = 30;
const MAX_VALORES = 5;
/** Solo se buscan pares en el principio de cada línea: un volcado de 80.000 caracteres no debe atascar nada. */
const LARGO_PARA_PARES = 4000;
/** Como mucho tantas barras: si el rango da más, se agrupa por un paso mayor. */
const MAX_BARRAS = 1500;
const MINUTO = 60_000;
const HORA_MS = 60 * MINUTO;
const DIA_MS = 24 * HORA_MS;

/** De qué sabe la marca: fecha completa, sin año (syslog, klog) o solo la hora. */
export type Alcance = 'completa' | 'sin-anio' | 'hora';

export interface Marca {
  /** Instante (ms desde 1970), para ordenar, agrupar y comparar con otras capturas. */
  ms: number;
  /** La hora tal como está escrita en el log: «17:40:01». */
  pared: string;
  alcance: Alcance;
  /** Dónde empieza en la línea (la de más a la izquierda es la de la línea). */
  indice: number;
  /** Para las marcas sin año, sus partes, para rehacer el instante con otro año. */
  partes?: [mes: number, dia: number, h: number, mi: number, s: number, mil: number];
}

export interface LineaAnalizada {
  marca: Marca | null;
  nivel: Nivel;
  formato: Formato;
  plantilla: string;
  pares: [string, string][];
  /** ¿Tiene pinta de línea de log? (para la detección). */
  pareceLog: boolean;
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
  if (z === 'Z' || z === 'UTC' || z === 'GMT') return 0;
  const m = /([+-])(\d{2}):?(\d{2})/.exec(z);
  if (!m) return null;
  const s = m[1] === '-' ? -1 : 1;
  return s * (Number(m[2]) * 60 + Number(m[3])) * 60_000;
}

/** Número de una parte capturada (que siempre está si la expresión casó). */
const n = (x: string | undefined): number => Number(x ?? 0);
const ms3 = (f: string | undefined) => (f ? Number(f.slice(0, 3).padEnd(3, '0')) : 0);

function instante(a: number, mes: number, d: number, h: number, mi: number, s: number, mil: number, z: number | null) {
  return z === null ? new Date(a, mes, d, h, mi, s, mil).getTime() : Date.UTC(a, mes, d, h, mi, s, mil) - z;
}

const pared = (h: string | number, m: string | number, s: string | number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

/** Una fecha completa fuera de lo razonable (`0001-01-01`, `9999-…`) no es una marca. */
const anioValido = (a: number) => a >= 1970 && a <= 2200;

/** Marca de un número desde 1970: segundos, milisegundos, microsegundos o nanosegundos según sus cifras. */
function marcaDeEpoca(valor: number): Marca | null {
  const ms = valor >= 1e17 ? valor / 1e6 : valor >= 1e14 ? valor / 1e3 : valor >= 1e11 ? valor : valor * 1000;
  const d = new Date(ms);
  if (!Number.isFinite(ms) || !anioValido(d.getFullYear())) return null;
  return { ms, pared: pared(d.getHours(), d.getMinutes(), d.getSeconds()), alcance: 'completa', indice: 0 };
}

type Candidata = { re: RegExp; leer: (m: RegExpExecArray, anio: number) => Marca | null };

const CANDIDATAS: Candidata[] = [
  {
    re: ISO,
    leer: (m) => {
      const [, a, mes, d, h, mi, s, f, z] = m;
      if (!anioValido(n(a))) return null;
      return {
        ms: instante(n(a), n(mes) - 1, n(d), n(h), n(mi), n(s), ms3(f), desfase(z)),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'completa',
        indice: m.index,
      };
    },
  },
  {
    re: APACHE,
    leer: (m) => {
      const [, d, mes, a, h, mi, s, z] = m;
      const numMes = MESES[(mes ?? '').toLowerCase()];
      if (numMes === undefined || !anioValido(n(a))) return null;
      return {
        ms: instante(n(a), numMes, n(d), n(h), n(mi), n(s), 0, desfase(z)),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'completa',
        indice: m.index,
      };
    },
  },
  {
    re: GO,
    leer: (m) => {
      const [, a, mes, d, h, mi, s, f] = m;
      if (!anioValido(n(a))) return null;
      return {
        ms: instante(n(a), n(mes) - 1, n(d), n(h), n(mi), n(s), ms3(f), null),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'completa',
        indice: m.index,
      };
    },
  },
  {
    re: PHP,
    leer: (m) => {
      const [, d, mes, a, h, mi, s, zona] = m;
      const numMes = MESES[(mes ?? '').toLowerCase()];
      if (numMes === undefined || !anioValido(n(a))) return null;
      return {
        ms: instante(n(a), numMes, n(d), n(h), n(mi), n(s), 0, desfase(zona)),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'completa',
        indice: m.index,
      };
    },
  },
  {
    re: KLOG,
    leer: (m, anio) => {
      const [, , mes, d, h, mi, s, f] = m;
      const partes: Marca['partes'] = [n(mes) - 1, n(d), n(h), n(mi), n(s), ms3(f)];
      return {
        ms: instante(anio, ...partes, null),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'sin-anio',
        indice: 0,
        partes,
      };
    },
  },
  {
    re: SYSLOG,
    leer: (m, anio) => {
      const [, mes, d, h, mi, s] = m;
      const numMes = MESES[(mes ?? '').toLowerCase()];
      if (numMes === undefined) return null;
      const partes: Marca['partes'] = [numMes, n(d), n(h), n(mi), n(s), 0];
      return {
        ms: instante(anio, ...partes, null),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'sin-anio',
        indice: 0,
        partes,
      };
    },
  },
  {
    re: HORA,
    leer: (m, anio) => {
      const [, h, mi, s, f] = m;
      // Solo hora: el día no se sabe; se cuenta desde el 1 de enero y los cambios de día se arrastran después.
      return {
        ms: instante(anio, 0, 1, n(h), n(mi), n(s), ms3(f), null),
        pared: pared(h ?? 0, mi ?? 0, s ?? 0),
        alcance: 'hora',
        indice: 0,
      };
    },
  },
];

/**
 * Marca de un texto de fecha (o de un número desde 1970, en JSON). Con varias fechas en la línea, la de más a la
 * izquierda: la del principio es la del log; una fecha dentro del mensaje (`cert expired at 2019-…`) no.
 */
export function marcaDe(texto: string | number, anioPorDefecto: number): Marca | null {
  if (typeof texto === 'number') return marcaDeEpoca(texto);
  if (/^\d{10,19}(?:\.\d+)?$/.test(texto)) return marcaDeEpoca(Number(texto));
  let mejor: Marca | null = null;
  for (const c of CANDIDATAS) {
    const m = c.re.exec(texto);
    if (!m || (mejor && m.index >= mejor.indice)) continue;
    const marca = c.leer(m, anioPorDefecto);
    if (marca) mejor = marca;
    // Una marca al principio de la línea no la mejora ninguna otra: no hace falta probar el resto.
    if (mejor && mejor.indice <= 1) break;
  }
  return mejor;
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

/** Niveles numéricos de pino y bunyan. */
function nivelNumerico(v: number): Nivel {
  return v >= 60 ? 'FATAL' : v >= 50 ? 'ERROR' : v >= 40 ? 'WARN' : v >= 30 ? 'INFO' : v >= 20 ? 'DEBUG' : 'TRACE';
}

const CAMPO_NIVEL = /(?<![\w.-])(?:level|lvl|severity|loglevel)\s*[=:]\s*"?([A-Za-z]+)"?/i;
const PALABRA_NIVEL_G =
  /\b(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|ERR|FATAL|CRITICAL|PANIC)\b|\[(trace|debug|info|warn|warning|error|err|fatal|critical)\]/gi;
const MAYUSCULAS = /^[A-Z]+$/;
const NIVEL_KLOG: Record<string, Nivel> = { I: 'INFO', W: 'WARN', E: 'ERROR', F: 'FATAL' };
const NIVEL_PHP: Record<string, Nivel> = {
  'fatal error': 'FATAL',
  'parse error': 'ERROR',
  'recoverable fatal error': 'ERROR',
  warning: 'WARN',
  notice: 'INFO',
  deprecated: 'INFO',
};
const NIVEL_DE_PHP = /\bPHP (Fatal error|Parse error|Recoverable fatal error|Warning|Notice|Deprecated)\b/;
/** Dónde se busca el nivel explícito (al principio de la línea, tras la marca). */
const CABEZA = 120;

/** Primera palabra de nivel en mayúsculas (o entre corchetes) desde `desde`; `null` si no hay. */
function palabraDeNivel(linea: string, hasta = Number.POSITIVE_INFINITY): Nivel | null {
  for (const m of linea.matchAll(PALABRA_NIVEL_G)) {
    if (m.index > hasta) break;
    // Una palabra suelta solo cuenta en mayúsculas («no error» en un mensaje no es un nivel).
    const palabra = m[1] ?? m[2] ?? '';
    if (m[1] && !MAYUSCULAS.test(palabra)) continue;
    const nivel = nivelDe(palabra);
    if (nivel) return nivel;
  }
  return null;
}

/**
 * Nivel de una línea de texto: klog y PHP por su forma; si no, la palabra de nivel del principio de la línea
 * (`INFO GET /api?level=error` es INFO); si no, un campo `level=`; si no, una palabra de nivel en cualquier sitio.
 */
function nivelDeTexto(linea: string): Nivel | null {
  const klog = KLOG.exec(linea);
  if (klog?.[1]) return NIVEL_KLOG[klog[1]] ?? null;
  const php = NIVEL_DE_PHP.exec(linea);
  if (php?.[1]) return NIVEL_PHP[php[1].toLowerCase()] ?? null;
  // La cabeza de la línea: la marca (como mucho unos 35 caracteres) y lo que la sigue.
  const cabeza = palabraDeNivel(linea, CABEZA);
  if (cabeza) return cabeza;
  const campo = CAMPO_NIVEL.exec(linea);
  const deCampo = campo?.[1] ? nivelDe(campo[1]) : null;
  return deCampo ?? palabraDeNivel(linea);
}

const ISO_G = new RegExp(ISO.source, 'g');
const APACHE_G = new RegExp(APACHE.source, 'g');
const PHP_G = new RegExp(PHP.source, 'g');
const GO_G = new RegExp(GO.source, 'g');

/** Quita las marcas de tiempo de todos los formatos, para que no cuenten en la plantilla. */
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
  return normalizarSinMarcas(sinMarcas(linea));
}

/** `normalizar` de una línea a la que ya se le quitaron las marcas (para no hacerlo dos veces). */
function normalizarSinMarcas(resto: string): string {
  return resto
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<ID>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '<IP>')
    .replace(/\b0x[0-9a-f]+\b/gi, '<HEX>')
    .replace(/\b(?=[0-9a-f]*\d)[0-9a-f]{12,}\b/gi, '<HEX>')
    .replace(/\b\d+(?:\.\d+)?/g, '<N>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `clave=valor` (o `clave="valor con espacios"`). La clave no puede ir pegada a otra palabra: lineal en tokens largos. */
const PAR = /(?<![\w.-])([A-Za-z_][\w.-]*)=("(?:[^"\\]|\\.)*"|[^\s"]+)/g;
const CLAVES_MENSAJE = ['msg', 'message', 'mensaje', 'text', 'event'];
const CLAVES_MARCA = ['time', 'timestamp', 'ts', '@timestamp', 'datetime', 'date', 't'];
const CLAVES_NIVEL = ['level', 'lvl', 'severity', 'loglevel', 'log.level'];
const EMPIEZA_LOGFMT = /^\s*[A-Za-z_][\w.@-]*=/;
const LETRAS = /\p{L}{3,}/u;

function paresDe(linea: string): [string, string][] {
  const pares: [string, string][] = [];
  for (const m of linea.slice(0, LARGO_PARA_PARES).matchAll(PAR))
    pares.push([m[1] ?? '', (m[2] ?? '').replace(/^"|"$/g, '')]);
  return pares;
}

/** Plantilla de una línea estructurada: nivel, mensaje normalizado y los nombres de las demás claves, ordenados. */
const plantillaEstructurada = (nivel: Nivel, msg: string, resto: string[]) =>
  [nivel, msg, resto.length ? `{${resto.sort().join(',')}}` : ''].filter(Boolean).join(' ');

function analizarJson(t: string, anio: number): LineaAnalizada | null {
  let o: unknown;
  try {
    o = JSON.parse(t);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const obj = o as Record<string, unknown>;
  const clave = (lista: string[]) => lista.find((k) => k in obj);
  const kMarca = clave(CLAVES_MARCA);
  const kNivel = clave(CLAVES_NIVEL);
  const kMsg = clave(CLAVES_MENSAJE);
  const valorMarca = kMarca ? obj[kMarca] : undefined;
  const marca = typeof valorMarca === 'string' || typeof valorMarca === 'number' ? marcaDe(valorMarca, anio) : null;
  const valorNivel = kNivel ? obj[kNivel] : undefined;
  const nivel =
    (typeof valorNivel === 'number'
      ? nivelNumerico(valorNivel)
      : typeof valorNivel === 'string'
        ? nivelDe(valorNivel)
        : null) ?? 'INFO';
  const resto = Object.keys(obj).filter((k) => k !== kMarca && k !== kNivel && k !== kMsg);
  const msg = kMsg && typeof obj[kMsg] === 'string' ? normalizar(obj[kMsg] as string) : '';
  const pares = Object.entries(obj)
    .filter(
      ([k, v]) =>
        k !== kMarca && k !== kMsg && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'),
    )
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return {
    marca,
    nivel,
    formato: 'json',
    plantilla: plantillaEstructurada(nivel, msg, resto),
    pares,
    // Un JSON de datos (sin nivel, mensaje ni hora) no es una línea de log.
    pareceLog: Boolean(kNivel || kMsg || kMarca),
  };
}

/** Analiza una línea con su formato. */
export function analizarLinea(linea: string, anio: number): LineaAnalizada {
  const t = linea.trim();
  if (t.startsWith('{') && t.endsWith('}')) {
    const json = analizarJson(t, anio);
    if (json) return json;
  }
  const pares = paresDe(t);
  // logfmt: la línea empieza por `clave=` (una línea de texto con algún `time=12ms` al final no lo es).
  const esLogfmt =
    EMPIEZA_LOGFMT.test(t) &&
    pares.length >= 2 &&
    pares.some(([k]) => [...CLAVES_NIVEL, ...CLAVES_MENSAJE, ...CLAVES_MARCA].includes(k.toLowerCase()));
  if (esLogfmt) {
    const mapa = new Map(pares.map(([k, v]) => [k.toLowerCase(), v]));
    const kMarca = CLAVES_MARCA.find((k) => mapa.has(k));
    const kNivel = CLAVES_NIVEL.find((k) => mapa.has(k));
    const kMsg = CLAVES_MENSAJE.find((k) => mapa.has(k));
    const marca = kMarca ? marcaDe(mapa.get(kMarca) ?? '', anio) : null;
    const nivel = (kNivel ? nivelDe(mapa.get(kNivel) ?? '') : null) ?? 'INFO';
    const resto = [...mapa.keys()].filter((k) => k !== kMarca && k !== kNivel && k !== kMsg);
    return {
      marca,
      nivel,
      formato: 'logfmt',
      plantilla: plantillaEstructurada(nivel, kMsg ? normalizar(mapa.get(kMsg) ?? '') : '', resto),
      pares: pares.filter(([k]) => k.toLowerCase() !== kMarca && k.toLowerCase() !== kMsg),
      pareceLog: true,
    };
  }
  const apache = APACHE.test(t) ? /"\s*(\d{3})\s/.exec(t) : null;
  let nivel = nivelDeTexto(t);
  if (!nivel && apache) {
    const estado = Number(apache[1]);
    nivel = estado >= 500 ? 'ERROR' : estado >= 400 ? 'WARN' : 'INFO';
  }
  const marca = marcaDe(t, anio);
  const resto = sinMarcas(t);
  return {
    marca,
    nivel: nivel ?? 'INFO',
    formato: apache ? 'apache' : SYSLOG.test(t) ? 'syslog' : 'texto',
    plantilla: normalizarSinMarcas(resto),
    pares,
    // Una marca al principio con un mensaje de palabras detrás (no una fila de números de un CSV), o un nivel al
    // principio, o una línea de acceso web.
    pareceLog:
      Boolean(apache) ||
      (marca !== null && marca.indice <= 40 && LETRAS.test(resto)) ||
      /^\s*\[?(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\]?[\s:]/.test(t),
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
  ms: number | null;
  texto: string;
}

export interface DatosLog {
  lineas: number;
  formato: Formato;
  desde: string | null;
  hasta: string | null;
  duracionMs: number | null;
  /** ¿Llevan todas las marcas fecha completa? Solo entonces los instantes se comparan con otras capturas. */
  fechasCompletas: boolean;
  niveles: Record<Nivel, number>;
  plantillas: Plantilla[];
  /** Índice en `plantillas` de cada línea con contenido (-1 en las vacías). */
  lineaPlantilla: number[];
  pares: { clave: string; n: number; valores: { valor: string; n: number }[] }[];
  primerError: Suceso | null;
  ultimoError: Suceso | null;
  histograma: { paso: 'minuto' | 'hora' | 'dia'; barras: Barra[] } | null;
  /** La ventana más corta de barras con al menos el 80 % de los errores (etiquetas e instantes). */
  concentracion: { desde: string; hasta: string; desdeMs: number; hastaMs: number } | null;
}

const VACIO_NIVELES = (): Record<Nivel, number> => ({ TRACE: 0, DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 });
const esError = (nivel: Nivel) => nivel === 'ERROR' || nivel === 'FATAL';

export interface OpcionesAnalisis {
  alProgreso?: (hechas: number, total: number) => void;
  /** Cuándo se capturó: da el año a las marcas que no lo tienen (syslog, klog). */
  referencia?: Date;
  /** Año para las marcas sin año (si no hay `referencia`). */
  anio?: number;
}

/**
 * Las marcas sin año o solo con hora se ajustan para que el log avance: un salto atrás de más de medio año
 * (de diciembre a enero) suma un año, uno de más de 12 h (medianoche) suma un día, y una fecha sin año que
 * caería después de la captura es del año anterior.
 */
function crearAjuste(referencia: Date | null) {
  let anioSinAnio: number | null = null;
  let ultimaSinAnio: number | null = null;
  let diasHora = 0;
  let ultimaHora: number | null = null;
  return (m: Marca): Marca => {
    if (m.alcance === 'hora') {
      if (ultimaHora !== null && m.ms + diasHora * DIA_MS < ultimaHora - 12 * HORA_MS) diasHora++;
      const ms = m.ms + diasHora * DIA_MS;
      ultimaHora = ms;
      return { ...m, ms };
    }
    if (m.alcance === 'sin-anio' && m.partes) {
      if (anioSinAnio === null) {
        anioSinAnio = referencia?.getFullYear() ?? new Date(m.ms).getFullYear();
        const prueba = instante(anioSinAnio, ...m.partes, null);
        if (referencia && prueba > referencia.getTime() + 2 * DIA_MS) anioSinAnio--;
      }
      let ms = instante(anioSinAnio, ...m.partes, null);
      if (ultimaSinAnio !== null && ms < ultimaSinAnio - 180 * DIA_MS) {
        anioSinAnio++;
        ms = instante(anioSinAnio, ...m.partes, null);
      }
      ultimaSinAnio = ms;
      return { ...m, ms };
    }
    return m;
  };
}

/** Analiza un log entero, por bloques de 50.000 líneas que se suman. */
export function analizar(texto: string, { alProgreso, referencia, anio }: OpcionesAnalisis = {}): DatosLog {
  const anioBase = referencia?.getFullYear() ?? anio ?? new Date().getFullYear();
  const ajustar = crearAjuste(referencia ?? null);
  const lineas = texto.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n');
  const niveles = VACIO_NIVELES();
  const indice = new Map<string, number>();
  const plantillas: Plantilla[] = [];
  const lineaPlantilla: number[] = new Array(lineas.length).fill(-1);
  const pares = new Map<string, { n: number; valores: Map<string, number> }>();
  const formatos = new Map<Formato, number>();
  const marcas: { ms: number; pared: string; nivel: Nivel }[] = [];
  let fechasCompletas = true;
  let primerError: Suceso | null = null;
  let ultimoError: Suceso | null = null;
  let conContenido = 0;

  for (let inicio = 0; inicio < lineas.length; inicio += BLOQUE) {
    const fin = Math.min(lineas.length, inicio + BLOQUE);
    for (let i = inicio; i < fin; i++) {
      const linea = lineas[i] ?? '';
      if (!linea.trim()) continue;
      conContenido++;
      const a = analizarLinea(linea, anioBase);
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
      const marca = a.marca ? ajustar(a.marca) : null;
      if (marca) {
        marcas.push({ ms: marca.ms, pared: marca.pared, nivel: a.nivel });
        if (marca.alcance !== 'completa') fechasCompletas = false;
      }
      if (esError(a.nivel)) {
        const suceso = { linea: i + 1, pared: marca?.pared ?? null, ms: marca?.ms ?? null, texto: linea.slice(0, 300) };
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
  let primera: (typeof marcas)[number] | null = null;
  let ultima: (typeof marcas)[number] | null = null;
  for (const m of marcas) {
    if (!primera || m.ms < primera.ms) primera = m;
    if (!ultima || m.ms >= ultima.ms) ultima = m;
  }
  const histograma = primera && ultima ? histogramaDe(marcas, primera.ms, ultima.ms) : null;

  return {
    lineas: conContenido,
    formato: [...formatos].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'texto',
    desde: primera?.pared ?? null,
    hasta: ultima?.pared ?? null,
    duracionMs: primera && ultima ? ultima.ms - primera.ms : null,
    fechasCompletas: fechasCompletas && marcas.length > 0,
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
          .map(([valor, cuantas]) => ({ valor, n: cuantas })),
      })),
    primerError,
    ultimoError,
    histograma,
    concentracion: histograma ? concentracionDe(histograma.barras, histograma.paso) : null,
  };
}

type Paso = 'minuto' | 'hora' | 'dia';
const TAMANO: Record<Paso, number> = { minuto: MINUTO, hora: HORA_MS, dia: DIA_MS };

/** Etiqueta de una barra: «17:40» por minuto, «17:00» por hora, «17/10» por día (hora local). */
function etiqueta(inicio: number, paso: Paso, pared: string | null): string {
  if (paso === 'dia') {
    const d = new Date(inicio);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return pared ? (paso === 'minuto' ? pared.slice(0, 5) : `${pared.slice(0, 2)}:00`) : '';
}

function histogramaDe(
  marcas: { ms: number; pared: string; nivel: Nivel }[],
  minimo: number,
  maximo: number,
): DatosLog['histograma'] {
  const rango = maximo - minimo;
  let paso: Paso = rango > 20 * DIA_MS ? 'dia' : rango > 6 * HORA_MS ? 'hora' : 'minuto';
  // Si aun así salen demasiadas barras, se agrupa por un paso mayor.
  while (paso !== 'dia' && rango / TAMANO[paso] > MAX_BARRAS) paso = paso === 'minuto' ? 'hora' : 'dia';
  const tam = TAMANO[paso];
  // Los días se cortan a medianoche local; los minutos y las horas, por el reloj.
  const base =
    paso === 'dia' ? new Date(new Date(minimo).setHours(0, 0, 0, 0)).getTime() : Math.floor(minimo / tam) * tam;
  const total = Math.min(Math.floor((maximo - base) / tam) + 1, MAX_BARRAS);
  const barras: Barra[] = Array.from({ length: total }, (_, i) => ({
    inicio: base + i * tam,
    pared: '',
    errores: 0,
    avisos: 0,
    otros: 0,
  }));
  for (const m of marcas) {
    const b = barras[Math.min(Math.floor((m.ms - base) / tam), total - 1)];
    if (!b) continue;
    if (!b.pared) b.pared = etiqueta(b.inicio, paso, m.pared);
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
function etiquetaDesplazada(vecina: string, paso: Paso, sentido: 1 | -1, inicio: number): string {
  if (paso === 'dia') return etiqueta(inicio, 'dia', null);
  const [h, m] = vecina.split(':').map(Number);
  const minutos = paso === 'minuto' ? 1 : 60;
  const total = ((((h ?? 0) * 60 + (m ?? 0) + sentido * minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** La ventana más corta de barras con al menos el 80 % de los errores. */
export function concentracionDe(barras: readonly Barra[], paso: Paso = 'minuto'): DatosLog['concentracion'] {
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
  const [a, b] = [barras[mejor[0]], barras[mejor[1]]];
  return {
    desde: a?.pared ?? '',
    hasta: b?.pared ?? '',
    desdeMs: a?.inicio ?? 0,
    hastaMs: (b?.inicio ?? 0) + TAMANO[paso],
  };
}
