/**
 * Análisis de JSON, YAML y TOML (LEC-12, IN-045): el valor (normalizado a JSON), su esquema inferido, la ruta de cada
 * valor y la comparación estructural de dos (claves añadidas, quitadas y cambiadas). Lo carga el lector al leer y
 * derivar (con `smol-toml`); lo ligero de la detección está en `formas.ts`. TS puro.
 */
import { parse as analizarToml } from 'smol-toml';
import {
  type Analizado,
  comoJson,
  comoYaml,
  esMapa,
  type FormatoJson,
  formaToml,
  type MapaJson,
  normalizar,
  pareceConfiguracion,
  pista,
  type ValorJson,
} from './formas';

export * from './formas';

function comoToml(texto: string): ValorJson | undefined {
  try {
    // Los enteros que no caben en un número, como `bigint` (y `normalizar` los pasa a texto).
    return normalizar(analizarToml(texto, { integersAsBigInt: 'asNeeded' }));
  } catch {
    return undefined;
  }
}

/**
 * El valor del texto y su formato, o `null` si no es JSON, ni YAML ni TOML con forma de configuración. Con el nombre
 * del archivo (`.toml`, `.yaml`), su formato se prueba primero y no se le pide forma de configuración; con
 * `estricto: false` (al derivar lo que ya se guardó como configuración, o se pidió con `/json`), tampoco.
 */
export function analizar(texto: string, nombre?: string, { estricto = true } = {}): Analizado | null {
  const p = pista(nombre);
  const json = comoJson(texto, { cualquiera: !estricto, jsonc: p === 'json' });
  if (json !== undefined) return { formato: 'json', valor: json };
  const vale = (formato: FormatoJson, valor: ValorJson) => !estricto || p === formato || pareceConfiguracion(valor);
  // Con la forma de un TOML, es TOML o no se lee (una clave repetida): como YAML sería un texto suelto.
  if (p === 'toml' || formaToml(texto)) {
    const valor = comoToml(texto);
    return valor !== undefined && vale('toml', valor) ? { formato: 'toml', valor } : null;
  }
  const yaml = comoYaml(texto);
  if (yaml !== undefined && vale('yaml', yaml)) return { formato: 'yaml', valor: yaml };
  return null;
}

// ---------- Rutas ----------

/**
 * Un trozo de ruta: una clave, una posición, los elementos de una lista (en el esquema, `[]`) o uno de una lista de
 * mapas por su clave (`[name="b"]`). Las marcas no son textos: una clave que se llame `[0]` no se confunde con ellas.
 */
export type Segmento = string | number | { elementos: true } | { clave: string; valor: string | number };

/** `gateway.stream_timeout_ms`, `servers[0].host`, `["clave con espacios"]`, `servers[]`, `servers[name="b"]`. */
export function rutaDe(segmentos: readonly Segmento[]): string {
  let r = '';
  for (const s of segmentos) {
    if (typeof s === 'number') r += `[${s}]`;
    else if (typeof s === 'object') r += 'elementos' in s ? '[]' : `[${s.clave}=${JSON.stringify(s.valor)}]`;
    else if (/^[\p{L}_$][\p{L}\p{N}_$-]*$/u.test(s)) r += r ? `.${s}` : s;
    else r += `[${JSON.stringify(s)}]`;
  }
  return r || '$';
}

// ---------- Esquema ----------

export type TipoValor = 'objeto' | 'lista' | 'texto' | 'numero' | 'logico' | 'nulo';

export const tipoDe = (v: ValorJson): TipoValor =>
  v === null
    ? 'nulo'
    : Array.isArray(v)
      ? 'lista'
      : typeof v === 'object'
        ? 'objeto'
        : typeof v === 'string'
          ? 'texto'
          : typeof v === 'number'
            ? 'numero'
            : 'logico';

export interface EntradaEsquema {
  ruta: string;
  tipos: TipoValor[];
  /** Cuántas veces aparece (más de 1 dentro de las listas). */
  veces: number;
  /** En las listas, cuántos elementos tiene (la mayor, si aparece varias veces). */
  elementos?: number;
}

/** Como mucho estas rutas en el esquema (un JSON con miles de claves distintas se resume). */
export const MAX_ESQUEMA = 500;

/** El esquema inferido: cada ruta con sus tipos; las listas funden sus elementos en `ruta[]`. */
export function esquemaDe(v: ValorJson): EntradaEsquema[] {
  const porRuta = new Map<string, EntradaEsquema>();
  const ELEMENTOS = { elementos: true } as const;
  const visitar = (x: ValorJson, segmentos: Segmento[]) => {
    const hijos = () => {
      if (Array.isArray(x)) for (const y of x) visitar(y, [...segmentos, ELEMENTOS]);
      else if (esMapa(x)) for (const [k, y] of Object.entries(x)) visitar(y, [...segmentos, k]);
    };
    // La raíz solo dice algo si es un valor suelto (y no cuenta para el máximo).
    if (!segmentos.length && (Array.isArray(x) || esMapa(x))) return hijos();
    const ruta = rutaDe(segmentos);
    let e = porRuta.get(ruta);
    if (!e) {
      if (porRuta.size >= MAX_ESQUEMA) return;
      e = { ruta, tipos: [], veces: 0 };
      porRuta.set(ruta, e);
    }
    e.veces++;
    const tipo = tipoDe(x);
    if (!e.tipos.includes(tipo)) e.tipos.push(tipo);
    if (Array.isArray(x)) e.elementos = Math.max(e.elementos ?? 0, x.length);
    hijos();
  };
  visitar(v, []);
  return [...porRuta.values()];
}

// ---------- Comparación estructural ----------

export interface CambioValor {
  ruta: string;
  antes: ValorJson;
  despues: ValorJson;
}

export interface DiferenciasJson {
  anadidas: { ruta: string; valor: ValorJson }[];
  quitadas: { ruta: string; valor: ValorJson }[];
  cambiadas: CambioValor[];
}

/** Las claves con las que se emparejan los elementos de una lista de mapas (si todos la tienen y no se repite). */
const CLAVES_IDENTIDAD = ['id', 'name', 'nombre', 'key'];

function claveDeLista(a: ValorJson[], b: ValorJson[]): string | null {
  const todos = [...a, ...b];
  if (!todos.length || !todos.every(esMapa)) return null;
  return (
    CLAVES_IDENTIDAD.find((k) => {
      const enA = a.map((x) => (x as MapaJson)[k]);
      const enB = b.map((x) => (x as MapaJson)[k]);
      const valida = (xs: (ValorJson | undefined)[]) =>
        xs.every((x) => typeof x === 'string' || typeof x === 'number') && new Set(xs).size === xs.length;
      return valida(enA) && valida(enB);
    }) ?? null
  );
}

const iguales = (a: ValorJson, b: ValorJson): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lo que cambia de `a` a `b`, por ruta y en el orden del documento: los mapas, por clave; las listas, por posición, o
 * por su `id` (o `name`, `nombre`, `key`) si son de mapas que la tienen. Un cambio de tipo es un cambio.
 */
export function compararValores(a: ValorJson, b: ValorJson): DiferenciasJson {
  const d: DiferenciasJson = { anadidas: [], quitadas: [], cambiadas: [] };
  const visitar = (x: ValorJson, y: ValorJson, segmentos: Segmento[]) => {
    if (esMapa(x) && esMapa(y)) {
      for (const [k, vy] of Object.entries(y)) {
        if (Object.hasOwn(x, k)) visitar(x[k] ?? null, vy, [...segmentos, k]);
        else d.anadidas.push({ ruta: rutaDe([...segmentos, k]), valor: vy });
      }
      for (const [k, vx] of Object.entries(x))
        if (!Object.hasOwn(y, k)) d.quitadas.push({ ruta: rutaDe([...segmentos, k]), valor: vx });
      return;
    }
    if (Array.isArray(x) && Array.isArray(y)) {
      const clave = claveDeLista(x, y);
      if (clave) {
        const idDe = (m: ValorJson) => (m as MapaJson)[clave] as string | number;
        // Cada elemento se nombra por su clave: su posición puede ser otra en cada lado.
        const nombre = (m: ValorJson): Segmento => ({ clave, valor: idDe(m) });
        const enX = new Map(x.map((m) => [idDe(m), m]));
        const enY = new Set(y.map(idDe));
        for (const my of y) {
          const mx = enX.get(idDe(my));
          if (mx !== undefined) visitar(mx, my, [...segmentos, nombre(my)]);
          else d.anadidas.push({ ruta: rutaDe([...segmentos, nombre(my)]), valor: my });
        }
        for (const mx of x)
          if (!enY.has(idDe(mx))) d.quitadas.push({ ruta: rutaDe([...segmentos, nombre(mx)]), valor: mx });
        return;
      }
      for (let i = 0; i < Math.max(x.length, y.length); i++) {
        if (i >= x.length) d.anadidas.push({ ruta: rutaDe([...segmentos, i]), valor: y[i] ?? null });
        else if (i >= y.length) d.quitadas.push({ ruta: rutaDe([...segmentos, i]), valor: x[i] ?? null });
        else visitar(x[i] ?? null, y[i] ?? null, [...segmentos, i]);
      }
      return;
    }
    if (!iguales(x, y)) d.cambiadas.push({ ruta: rutaDe(segmentos), antes: x, despues: y });
  };
  visitar(a, b, []);
  return d;
}

/** Cuántas claves cambian en total (añadidas, quitadas y cambiadas). */
export const totalCambios = (d: DiferenciasJson) => d.anadidas.length + d.quitadas.length + d.cambiadas.length;

/** Las rutas que cambian, en el orden del documento nuevo (las quitadas, al final). */
export const rutasCambiadas = (d: DiferenciasJson): string[] => [
  ...[...d.cambiadas, ...d.anadidas].map((c) => c.ruta),
  ...d.quitadas.map((c) => c.ruta),
];

/** Los trozos de una ruta escrita: `servers[0].host` → `servers`, `[0]`, `host`. */
const trozosDeRuta = (ruta: string): string[] => ruta.match(/\[(?:"(?:[^"\\]|\\.)*"|[^\]]*)\]|[^.[\]]+/g) ?? [ruta];

/** Una ruta de vuelta desde sus trozos (los índices, pegados; las claves, con punto). */
const unirTrozos = (trozos: readonly string[]): string =>
  trozos.reduce((r, t) => (t.startsWith('[') || !r ? r + t : `${r}.${t}`), '');

/**
 * Las rutas sin el prefijo que comparten todas (`gateway.client` y `gateway.stream_timeout_ms` → `client` y
 * `stream_timeout_ms`), como la referencia. Una sola ruta se queda en su último trozo.
 */
export function rutasCortas(rutas: readonly string[]): string[] {
  const partes = rutas.map(trozosDeRuta);
  const primero = partes[0]?.slice(0, -1) ?? [];
  let comun = 0;
  while (comun < primero.length && partes.every((p) => p.length - 1 > comun && p[comun] === primero[comun])) comun++;
  return partes.map((p) => {
    // Al menos una clave con nombre: `[0]` y `[1]` solos no dicen qué cambia (`hosts[0]`, sí).
    let desde = comun;
    while (desde > 0 && p.slice(desde).every((t) => t.startsWith('['))) desde--;
    return unirTrozos(p.slice(desde));
  });
}
