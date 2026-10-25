/**
 * Lo ligero del lector JSON, YAML y TOML (IN-045): los tipos del valor, cuántas claves tiene, si tiene forma de
 * configuración y la confianza de la detección. Va en la carga inicial (el detector es síncrono): JSON con
 * `JSON.parse`, YAML con `yaml` (que ya está, por el frontmatter) y TOML por la forma de sus líneas, sin su
 * analizador (`smol-toml` solo se carga al leer y derivar, en `analisis.ts`). TS puro.
 */
import { parseAllDocuments } from 'yaml';

export type FormatoJson = 'json' | 'yaml' | 'toml';
export type ValorJson = null | boolean | number | string | ValorJson[] | { [clave: string]: ValorJson };
export type MapaJson = { [clave: string]: ValorJson };

export interface Analizado {
  formato: FormatoJson;
  valor: ValorJson;
}

export const esMapa = (x: unknown): x is MapaJson => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Un valor de YAML o TOML como JSON: fechas a texto ISO, números no finitos y enteros enormes a texto. */
export function normalizar(x: unknown): ValorJson {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : String(x);
  if (typeof x === 'bigint')
    return x <= BigInt(Number.MAX_SAFE_INTEGER) && x >= BigInt(-Number.MAX_SAFE_INTEGER) ? Number(x) : String(x);
  if (typeof x === 'string' || typeof x === 'boolean') return x;
  // Las fechas de TOML (`TomlDate`) saben escribirse a sí mismas (también las locales, sin zona).
  if (x instanceof Date) return Number.isNaN(x.getTime()) && !('isDate' in x) ? null : x.toISOString();
  if (Array.isArray(x)) return x.map(normalizar);
  if (x instanceof Map) return Object.fromEntries([...x].map(([k, v]) => [String(k), normalizar(v)]));
  if (x instanceof Set) return [...x].map(normalizar);
  if (typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, normalizar(v)]));
  return String(x);
}

/** Las claves de todos los mapas, a cualquier profundidad (la referencia: «TOML · 34 claves»). */
export function contarClaves(v: ValorJson): number {
  if (Array.isArray(v)) return v.reduce<number>((s, x) => s + contarClaves(x), 0);
  if (!esMapa(v)) return 0;
  return Object.values(v).reduce<number>((s, x) => s + 1 + contarClaves(x), 0);
}

/** Cuántos niveles de mapas y listas tiene (un escalar, 0). */
export function profundidad(v: ValorJson): number {
  const hijos = Array.isArray(v) ? v : esMapa(v) ? Object.values(v) : null;
  if (!hijos) return 0;
  return 1 + hijos.reduce<number>((m, x) => Math.max(m, profundidad(x)), 0);
}

/** Los textos de las hojas (los primeros `max`), para ver si son prosa. */
function textosDe(v: ValorJson, max: number, fuera: string[] = []): string[] {
  if (fuera.length >= max) return fuera;
  if (typeof v === 'string') fuera.push(v);
  else if (Array.isArray(v)) for (const x of v) textosDe(x, max, fuera);
  else if (esMapa(v)) for (const x of Object.values(v)) textosDe(x, max, fuera);
  return fuera;
}

/** Una clave con forma de identificador (`stream_timeout_ms`, `server.port`, `@scope/pkg`): sin espacios. */
const IDENTIFICADOR = /^[\p{L}\p{N}_.$@/:+-]+$/u;

/**
 * ¿Tiene forma de configuración? Un mapa (o una lista de mapas) con al menos 2 claves, casi todas de identificador,
 * y valores que no son prosa: `Rol: Eres un revisor…` es un prompt, `- uno` es una lista de Markdown.
 */
export function pareceConfiguracion(v: ValorJson): boolean {
  const mapas = Array.isArray(v) ? v : [v];
  if (!mapas.length || !mapas.every(esMapa) || contarClaves(v) < 2) return false;
  const claves = mapas.flatMap((m) => Object.keys(m as MapaJson));
  if (claves.filter((k) => IDENTIFICADOR.test(k)).length < claves.length * 0.8) return false;
  const textos = textosDe(v, 200);
  const prosa = textos.filter((t) => t.trim().split(/\s+/).length >= 5).length;
  return !textos.length || prosa * 2 < textos.length;
}

export const pista = (nombre: string | undefined): FormatoJson | null => {
  const m = /\.(json|jsonc?|ya?ml|toml)$/i.exec(nombre ?? '');
  if (!m) return null;
  const ext = (m[1] ?? '').toLowerCase();
  return ext.startsWith('y') ? 'yaml' : ext === 'toml' ? 'toml' : 'json';
};

/** JSON: un mapa o una lista; con `cualquiera`, también un valor suelto (`"hola"`, `42`). */
export function comoJson(texto: string, cualquiera = false): ValorJson | undefined {
  const t = texto.trim();
  if (!cualquiera && !/^[[{]/.test(t)) return undefined;
  try {
    return JSON.parse(t) as ValorJson;
  } catch {
    return undefined;
  }
}

export function comoYaml(texto: string): ValorJson | undefined {
  try {
    const documentos = parseAllDocuments(texto, { prettyErrors: false, merge: true });
    if (!Array.isArray(documentos) || !documentos.length) return undefined;
    if (documentos.some((d) => d.errors.length)) return undefined;
    const valores = documentos.map((d) => normalizar(d.toJS({ maxAliasCount: 1000 })));
    // Varios documentos (`---`, como un manifiesto de Kubernetes): una lista.
    return valores.length === 1 ? (valores[0] ?? null) : valores;
  } catch {
    return undefined;
  }
}

// ---------- TOML, sin su analizador ----------

/** Una clave de TOML: desnuda, entre comillas o con puntos (`a."b c".d`). */
const CLAVE_TOML = String.raw`(?:[A-Za-z0-9_-]+|"[^"\n]*"|'[^'\n]*')(?:\s*\.\s*(?:[A-Za-z0-9_-]+|"[^"\n]*"|'[^'\n]*'))*`;
const CABECERA_TOML = new RegExp(String.raw`^\[\[?\s*${CLAVE_TOML}\s*\]\]?\s*(?:#.*)?$`);
const PAR_TOML = new RegExp(String.raw`^${CLAVE_TOML}\s*=\s*(.+)$`);
/** Cómo empieza un valor de TOML: texto, número (también `inf` y `nan`), sí o no, fecha, lista o tabla en línea. */
const VALOR_TOML = /^(?:"|'|[+-]?(?:\d|inf\b|nan\b)|true\b|false\b|\[|\{)/;
const TEXTO_TOML = /^"((?:[^"\\]|\\.)*)"|^'([^']*)'/;
const TRIPLES = ['"""', "'''"];

/** Corchetes y llaves abiertos menos cerrados, fuera de los textos (para las listas de varias líneas). */
const balance = (s: string) => {
  const sin = s.replace(/"(?:[^"\\]|\\.)*"|'[^']*'|#.*$/g, '');
  return (sin.match(/[[{]/g)?.length ?? 0) - (sin.match(/[\]}]/g)?.length ?? 0);
};

export interface FormaToml {
  tablas: number;
  pares: number;
  /** Los textos de los valores (para ver si son prosa). */
  textos: string[];
}

/**
 * Si todas las líneas son de TOML (tablas `[x]` y `[[x]]`, pares `clave = valor` con un valor de TOML, comentarios,
 * listas y textos de varias líneas), cuántas tablas y pares tiene; si no, `null`. Un `.env` (`FOO=bar`) o un INI con
 * valores sin comillas no lo son. Es la forma, no un análisis completo: al leerlo, `smol-toml` tiene la última palabra.
 */
export function formaToml(texto: string): FormaToml | null {
  const forma: FormaToml = { tablas: 0, pares: 0, textos: [] };
  let abiertos = 0;
  let enTexto: string | null = null;
  for (const bruta of texto.split(/\r?\n/)) {
    const l = bruta.trim();
    if (enTexto) {
      if (l.includes(enTexto)) enTexto = null;
      continue;
    }
    if (abiertos > 0) {
      abiertos += balance(l);
      continue;
    }
    if (!l || l.startsWith('#')) continue;
    if (CABECERA_TOML.test(l)) {
      forma.tablas++;
      continue;
    }
    const valor = PAR_TOML.exec(l)?.[1]?.trim();
    if (!valor || !VALOR_TOML.test(valor)) return null;
    forma.pares++;
    const triple = valor.slice(0, 3);
    if (TRIPLES.includes(triple)) {
      if (!valor.slice(3).includes(triple)) enTexto = triple;
      continue;
    }
    if (valor[0] === '"' || valor[0] === "'") {
      const t = TEXTO_TOML.exec(valor);
      if (!t) return null;
      forma.textos.push(t[1] ?? t[2] ?? '');
    }
    abiertos = Math.max(0, balance(valor));
  }
  return enTexto || abiertos > 0 ? null : forma;
}

/** ¿Tiene forma de configuración un TOML? Al menos 2 claves (o una tabla y una clave) y valores que no son prosa. */
function tomlDeConfiguracion(f: FormaToml): boolean {
  if (f.pares + f.tablas < 2 || !f.pares) return false;
  const prosa = f.textos.filter((t) => t.trim().split(/\s+/).length >= 5).length;
  return !f.textos.length || prosa * 2 < f.textos.length;
}

/** Lo que se mira para detectar: más allá, un texto de varios MB se reconoce por su principio. */
export const LIMITE_DETECCION = 200_000;

/**
 * El formato que tendría el texto (con forma de configuración), sin analizar el TOML: para detectar. Con el nombre
 * del archivo (`.toml`, `.yaml`), su formato no necesita forma de configuración.
 */
export function formatoProbable(texto: string, nombre?: string): { formato: FormatoJson; valor?: ValorJson } | null {
  const p = pista(nombre);
  const json = comoJson(texto);
  if (json !== undefined) return { formato: 'json', valor: json };
  const toml = formaToml(texto);
  if (toml && (p === 'toml' || tomlDeConfiguracion(toml))) return { formato: 'toml' };
  const yaml = comoYaml(texto);
  if (yaml !== undefined && (p === 'yaml' || pareceConfiguracion(yaml))) return { formato: 'yaml', valor: yaml };
  return null;
}

/**
 * Confianza de que el texto sea JSON, YAML o TOML: JSON 0,95 (por debajo de los formatos con lector propio, como el
 * JSON de hyperfine); TOML 0,92 con una tabla, 0,85 sin ella; YAML 0,85, y 0,9 con varios niveles o empezando por
 * `---`. Mira los primeros `LIMITE_DETECCION` caracteres.
 */
export function confianzaJson(texto: string, nombre?: string): number {
  if (!texto.trim()) return 0;
  // Un JSON enorme cortado no se puede analizar: basta con que empiece como uno.
  if (texto.length > LIMITE_DETECCION && /^\s*[[{]/.test(texto)) return 0.9;
  const muestra = texto.length > LIMITE_DETECCION ? texto.slice(0, texto.lastIndexOf('\n', LIMITE_DETECCION)) : texto;
  const f = formatoProbable(muestra, nombre);
  if (!f) return 0;
  if (f.formato === 'json') return 0.95;
  if (f.formato === 'toml') return (formaToml(muestra)?.tablas ?? 0) > 0 ? 0.92 : 0.85;
  return profundidad(f.valor ?? null) > 1 || /^---\s*$/.test(muestra.split('\n', 1)[0] ?? '') ? 0.9 : 0.85;
}
