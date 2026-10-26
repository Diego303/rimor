/**
 * Lo ligero del lector JSON, YAML y TOML (IN-045): los tipos del valor, cuántas claves tiene, si tiene forma de
 * configuración y la confianza de la detección. Va en la carga inicial (el detector es síncrono): JSON con
 * `JSON.parse`, YAML con `yaml` (que ya está, por el frontmatter) y TOML por la forma de sus líneas, sin su
 * analizador (`smol-toml` solo se carga al leer y derivar, en `analisis.ts`). TS puro.
 */
import { parseAllDocuments, visit } from 'yaml';

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
  // Las fechas de TOML (`TomlDate`) saben escribirse a sí mismas (también las locales, sin zona); sin un `.000`
  // que el original no tenía (`07:32:00`, no `07:32:00.000`).
  if (x instanceof Date)
    return Number.isNaN(x.getTime()) && !('isDate' in x)
      ? null
      : x.toISOString().replace(/\.000(?=Z$|[+-]\d\d:\d\d$|$)/, '');
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
/** Una palabra de un idioma con mayúscula inicial (`Lunes`, `From`, `Autor`): de una nota, no de una configuración. */
const PALABRA_CAPITAL = /^\p{Lu}\p{Ll}+$/u;
/** Las claves de un prompt estructurado (`Rol:`, `Tarea:`): es un prompt, no una configuración. */
const CLAVE_DE_PROMPT =
  /^(?:rol|role|tarea|task|contexto|context|formato|format|objetivo|goal|instrucciones|instructions|tono|tone)$/i;

/** Palabras de un texto a partir de las que es prosa: 5 en una configuración con niveles; 3 en una plana. */
const esProsa = (t: string, palabras: number) => t.trim().split(/\s+/).length >= palabras;

/**
 * ¿Tiene forma de configuración? Un mapa (o una lista de mapas) con al menos 2 claves, casi todas de identificador,
 * y valores que no son prosa: `Rol: Eres un revisor…` es un prompt, `- uno` es una lista de Markdown. Una plana (un
 * solo nivel) pide más: 3 claves, ninguna de prompt, que no sean palabras con mayúscula («Lunes: gimnasio», las
 * cabeceras de un correo) y valores de menos de 3 palabras (`user_1: logged in from…` es un log).
 */
export function pareceConfiguracion(v: ValorJson): boolean {
  const mapas = Array.isArray(v) ? v : [v];
  if (!mapas.length || !mapas.every(esMapa) || contarClaves(v) < 2) return false;
  const claves = mapas.flatMap((m) => Object.keys(m as MapaJson));
  if (claves.filter((k) => IDENTIFICADOR.test(k)).length < claves.length * 0.8) return false;
  const planos = mapas.filter((m) => profundidad(m) <= 1) as MapaJson[];
  for (const m of planos) {
    const propias = Object.keys(m);
    if (propias.some((k) => CLAVE_DE_PROMPT.test(k))) return false;
    if (propias.filter((k) => PALABRA_CAPITAL.test(k)).length * 2 > propias.length) return false;
  }
  const plana = planos.length === mapas.length;
  if (plana && contarClaves(v) < 3) return false;
  const textos = textosDe(v, 200);
  const prosa = textos.filter((t) => esProsa(t, plana ? 3 : 5)).length;
  return !textos.length || prosa * 2 < textos.length;
}

export const pista = (nombre: string | undefined): FormatoJson | null => {
  const m = /\.(json|jsonc?|ya?ml|toml)$/i.exec(nombre ?? '');
  if (!m) return null;
  const ext = (m[1] ?? '').toLowerCase();
  return ext.startsWith('y') ? 'yaml' : ext === 'toml' ? 'toml' : 'json';
};

/**
 * Un JSON con comentarios (de línea y de bloque) y comas al final (JSONC: `tsconfig.json`, los ajustes de VS Code), sin
 * ellos. Fuera de los textos.
 */
export function sinComentarios(s: string): string {
  let fuera = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      const fin = finDeTexto(s, i);
      const hasta = fin < 0 ? s.length : fin;
      fuera += s.slice(i, hasta);
      i = hasta - 1;
    } else if (c === '/' && s[i + 1] === '/') {
      const fin = s.indexOf('\n', i);
      i = (fin < 0 ? s.length : fin) - 1;
    } else if (c === '/' && s[i + 1] === '*') {
      const fin = s.indexOf('*/', i + 2);
      i = fin < 0 ? s.length : fin + 1;
    } else if (c !== ',' || !/[}\]]/.test(siguienteSignificativo(s, i + 1))) fuera += c;
    // (Una coma al final de una lista o un mapa se queda fuera.)
  }
  return fuera;
}

/** El siguiente carácter que no es blanco ni comentario desde `i` (o `''` al final). */
function siguienteSignificativo(s: string, i: number): string {
  let j = i;
  while (j < s.length) {
    const c = s[j] ?? '';
    if (/\s/.test(c)) j++;
    else if (c === '/' && s[j + 1] === '/') {
      const fin = s.indexOf('\n', j);
      j = fin < 0 ? s.length : fin;
    } else if (c === '/' && s[j + 1] === '*') {
      const fin = s.indexOf('*/', j + 2);
      j = fin < 0 ? s.length : fin + 2;
    } else return c;
  }
  return '';
}

/** Dónde acaba (justo después de la comilla) el texto JSON que empieza en `i`, o −1 si no acaba. */
function finDeTexto(s: string, i: number): number {
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++;
    else if (s[j] === '"') return j + 1;
    else if (s[j] === '\n') return -1;
  }
  return -1;
}

/** Los enteros más allá de 2^53 (un identificador grande), como texto: `JSON.parse` los redondearía. */
const conEnterosGrandes = (_clave: string, v: unknown, contexto?: { source?: string }) =>
  typeof v === 'number' && Number.isInteger(v) && !Number.isSafeInteger(v) && contexto?.source ? contexto.source : v;

/**
 * JSON: un mapa o una lista; con `cualquiera`, también un valor suelto (`"hola"`, `42`); con `jsonc` (un archivo
 * `.json`), también con comentarios y comas al final.
 */
export function comoJson(texto: string, { cualquiera = false, jsonc = false } = {}): ValorJson | undefined {
  const t = texto.trim();
  if (!cualquiera && !/^[[{]/.test(t)) return undefined;
  const leer = (x: string) => JSON.parse(x, conEnterosGrandes as Parameters<typeof JSON.parse>[1]) as ValorJson;
  try {
    return leer(t);
  } catch {
    if (!jsonc) return undefined;
    try {
      return leer(sinComentarios(t));
    } catch {
      return undefined;
    }
  }
}

/**
 * ¿Es `s` el principio de un único JSON (un mapa o una lista), hasta donde llega? Para lo que no se puede analizar
 * entero: un JSON de varios MB cortado sí; un log `[2026-10-17 17:40:00] INFO …`, `[INFO] …` o un JSON por línea, no.
 */
export function principioDeJson(s: string): boolean {
  const pila: string[] = [];
  let espera: 'valor' | 'valorOCierre' | 'clave' | 'claveOCierre' | 'dosPuntos' | 'comaOCierre' = 'valor';
  let i = s.search(/\S/);
  if (i < 0 || (s[i] !== '{' && s[i] !== '[')) return false;
  const cerrar = () => {
    pila.pop();
    i++;
    espera = 'comaOCierre';
  };
  while (i < s.length) {
    const c = s[i] ?? '';
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // Cerrado el valor entero, solo puede quedar blanco.
    if (!pila.length && espera === 'comaOCierre') return false;
    if (espera === 'valor' || espera === 'valorOCierre') {
      if (c === ']' && espera === 'valorOCierre') cerrar();
      else if (c === '{' || c === '[') {
        pila.push(c);
        i++;
        espera = c === '{' ? 'claveOCierre' : 'valorOCierre';
      } else if (c === '"') {
        const fin = finDeTexto(s, i);
        if (fin < 0) return s.indexOf('\n', i) < 0;
        i = fin;
        espera = 'comaOCierre';
      } else {
        const m = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(s.slice(i, i + 400));
        if (!m) return false;
        i += m[0].length;
        // Un número que sigue con letras o guiones (`2026-10-17`) no es JSON; al final de lo leído, puede seguir.
        if (i < s.length && !/[\s,\]}]/.test(s[i] ?? '')) return false;
        espera = 'comaOCierre';
      }
    } else if (espera === 'clave' || espera === 'claveOCierre') {
      if (c === '}' && espera === 'claveOCierre') cerrar();
      else if (c === '"') {
        const fin = finDeTexto(s, i);
        if (fin < 0) return s.indexOf('\n', i) < 0;
        i = fin;
        espera = 'dosPuntos';
      } else return false;
    } else if (espera === 'dosPuntos') {
      if (c !== ':') return false;
      i++;
      espera = 'valor';
    } else {
      const abierto = pila.at(-1);
      if (c === ',') {
        i++;
        espera = abierto === '{' ? 'clave' : 'valor';
      } else if ((c === '}' && abierto === '{') || (c === ']' && abierto === '[')) cerrar();
      else return false;
    }
  }
  return true;
}

/**
 * YAML (también varios documentos y las fusiones `<<: *base`). Sin comprobar claves repetidas (`uniqueKeys`), que
 * hace el análisis cuadrático con miles de claves. Las etiquetas propias (`!Ref Bucket` de CloudFormation) se
 * conservan en el valor: si no, cambiar `!Ref` por `!GetAtt` no sería un cambio.
 */
export function comoYaml(texto: string): ValorJson | undefined {
  try {
    const documentos = parseAllDocuments(texto, { prettyErrors: false, merge: true, uniqueKeys: false });
    if (!Array.isArray(documentos) || !documentos.length) return undefined;
    if (documentos.some((d) => d.errors.length)) return undefined;
    for (const d of documentos)
      visit(d, {
        Scalar(_, nodo) {
          if (nodo.tag?.startsWith('!') && !nodo.tag.startsWith('!!') && !nodo.tag.startsWith('tag:'))
            nodo.value = `${nodo.tag} ${String(nodo.value)}`;
        },
      });
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

/** Hasta aquí, un JSON se analiza entero para detectarlo; más allá, se mira si su principio lo es. */
export const LIMITE_DETECCION = 200_000;
/** Lo que se mira de un YAML o un TOML para detectarlo (cortado en un salto de línea), y del principio de un JSON. */
export const MUESTRA_DETECCION = 64_000;

/** Los primeros `n` caracteres, cortados en un salto de línea. */
export const principio = (texto: string, n: number) =>
  texto.length > n ? texto.slice(0, Math.max(texto.lastIndexOf('\n', n), 0) || n) : texto;

/**
 * El formato que tendría el texto (con forma de configuración), sin analizar el TOML: para detectar. Con el nombre
 * del archivo (`.toml`, `.yaml`), su formato no necesita forma de configuración.
 */
export function formatoProbable(texto: string, nombre?: string): { formato: FormatoJson; valor?: ValorJson } | null {
  const p = pista(nombre);
  const json = comoJson(texto, { jsonc: p === 'json' });
  if (json !== undefined) return { formato: 'json', valor: json };
  const toml = formaToml(texto);
  if (toml && (p === 'toml' || tomlDeConfiguracion(toml))) return { formato: 'toml' };
  const yaml = comoYaml(texto);
  if (yaml !== undefined && (p === 'yaml' || pareceConfiguracion(yaml))) return { formato: 'yaml', valor: yaml };
  return null;
}

/**
 * Confianza de que el texto sea JSON, YAML o TOML: JSON 0,95 (por debajo de los formatos con lector propio, como el
 * JSON de hyperfine), y 0,9 si es tan grande que solo se mira su principio; TOML 0,92 con una tabla, 0,85 sin ella;
 * YAML 0,85, y 0,9 con varios niveles o empezando por `---`. De un YAML o un TOML se miran sus primeros 64 KB.
 */
export function confianzaJson(texto: string, nombre?: string): number {
  if (!texto.trim()) return 0;
  const p = pista(nombre);
  if (/^\s*[[{]/.test(texto)) {
    if (texto.length > LIMITE_DETECCION) return principioDeJson(principio(texto, MUESTRA_DETECCION)) ? 0.9 : 0;
    if (comoJson(texto, { jsonc: p === 'json' }) !== undefined) return 0.95;
  }
  const muestra = principio(texto, MUESTRA_DETECCION);
  const f = formatoProbable(muestra, nombre);
  if (!f) return 0;
  if (f.formato === 'json') return 0.95;
  if (f.formato === 'toml') return (formaToml(muestra)?.tablas ?? 0) > 0 ? 0.92 : 0.85;
  return profundidad(f.valor ?? null) > 1 || /^---\s*$/.test(muestra.split('\n', 1)[0] ?? '') ? 0.9 : 0.85;
}
