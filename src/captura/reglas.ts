/**
 * Reglas de detección aprendidas (CAP-06, IN-049): si se corrige tres veces el tipo de contenidos que empiezan igual
 * (su firma: `[app]`, `svc:`), Rimor propone que los siguientes sean de ese tipo. Se guardan en
 * `.rimor/reglas-deteccion.json` con las correcciones que llevan a ellas y las propuestas que se rechazaron. TS puro:
 * leer, escribir, aprender y aplicar.
 */
import { esTipoElemento, type TipoElemento } from '@rimor/formato';

export const RUTA_REGLAS = '.rimor/reglas-deteccion.json';

/** Correcciones con la misma firma y el mismo tipo que hacen una propuesta. */
export const CORRECCIONES_PARA_PROPONER = 3;
/** Correcciones que se recuerdan (las últimas). */
export const MAX_CORRECCIONES = 100;
/** Largo máximo de una firma y de un prefijo. */
export const LARGO_FIRMA = 32;
export const LARGO_PREFIJO = 64;

export interface ReglaDeteccion {
  /** Lo que empieza la primera línea con contenido. */
  prefijo: string;
  tipo: TipoElemento;
  creada: string;
}

export interface Correccion {
  firma: string;
  tipo: TipoElemento;
  en: string;
}

export interface Propuesta {
  firma: string;
  tipo: TipoElemento;
}

export interface DatosReglas {
  esquema: 1;
  reglas: ReglaDeteccion[];
  correcciones: Correccion[];
  /** Propuestas a las que se dijo «No»: no se vuelven a ofrecer. */
  descartadas: Propuesta[];
}

export const REGLAS_INICIALES: DatosReglas = Object.freeze({
  esquema: 1,
  reglas: [],
  correcciones: [],
  descartadas: [],
}) as DatosReglas;

const esTipo = esTipoElemento;
const esTexto = (x: unknown): x is string => typeof x === 'string';

/** La primera línea con contenido, sin los espacios del principio (sin partir el texto entero: puede ser enorme). */
function primeraLinea(texto: string): string {
  for (let i = 0; i < texto.length; ) {
    const salto = texto.indexOf('\n', i);
    const fin = salto < 0 ? texto.length : salto;
    const linea = texto.slice(i, fin);
    if (linea.trim()) return linea.replace(/\r$/, '').trimStart();
    i = fin + 1;
  }
  return '';
}

/**
 * La firma de un contenido: la primera palabra de su primera línea con contenido, si lleva una letra y un signo que no
 * es letra ni cifra (`[app]`, `app:`, `<svc>`). Una palabra corriente no hace una regla útil; una fecha cambia cada vez
 * (y la de más de 32 caracteres no es una firma). `null` si no tiene.
 */
export function firmaDe(texto: string): string | null {
  const palabra = primeraLinea(texto).split(/\s/, 1)[0] ?? '';
  if (!palabra || palabra.length > LARGO_FIRMA) return null;
  return /\p{L}/u.test(palabra) && /[^\p{L}\p{N}]/u.test(palabra) ? palabra : null;
}

/** ¿Vale como prefijo de una regla (el que se escribe en Ajustes)? Sin saltos de línea y de largo razonable. */
export const prefijoValido = (p: string): boolean =>
  p.trim() !== '' && p.length <= LARGO_PREFIJO && !/[\r\n]/.test(p) && p === p.trimStart();

/** Lee el archivo; `null` si existe pero no se entiende (no se sobrescribe: se perderían las reglas). */
export function leerReglas(texto: string | null): DatosReglas | null {
  if (!texto) return { esquema: 1, reglas: [], correcciones: [], descartadas: [] };
  let d: unknown;
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return null;
  const o = d as Record<string, unknown>;
  const lista = (x: unknown): Record<string, unknown>[] =>
    Array.isArray(x) ? x.filter((y): y is Record<string, unknown> => typeof y === 'object' && y !== null) : [];
  const vistos = new Set<string>();
  const reglas: ReglaDeteccion[] = [];
  for (const r of lista(o.reglas)) {
    if (!esTexto(r.prefijo) || !prefijoValido(r.prefijo) || !esTipo(r.tipo) || vistos.has(r.prefijo)) continue;
    vistos.add(r.prefijo);
    reglas.push({ prefijo: r.prefijo, tipo: r.tipo, creada: esTexto(r.creada) ? r.creada : '' });
  }
  const correcciones = lista(o.correcciones)
    .flatMap((c) =>
      esTexto(c.firma) && esTipo(c.tipo) ? [{ firma: c.firma, tipo: c.tipo, en: esTexto(c.en) ? c.en : '' }] : [],
    )
    .slice(-MAX_CORRECCIONES);
  const descartadas = lista(o.descartadas).flatMap((p) =>
    esTexto(p.firma) && esTipo(p.tipo) ? [{ firma: p.firma, tipo: p.tipo }] : [],
  );
  return { esquema: 1, reglas, correcciones, descartadas };
}

export const escribirReglas = (d: DatosReglas): string => `${JSON.stringify(d, null, 2)}\n`;

const misma = (a: Propuesta, b: Propuesta) => a.firma === b.firma && a.tipo === b.tipo;

/**
 * Anota que un contenido se corrigió a `tipo`. Si con esta ya van {@link CORRECCIONES_PARA_PROPONER} con su firma y ese
 * tipo, y ni hay ya una regla que lo diga ni se rechazó, la propuesta. Sin firma, nada cambia.
 */
export function anotarCorreccion(
  d: DatosReglas,
  texto: string,
  tipo: TipoElemento,
  en: string,
): { datos: DatosReglas; propuesta: Propuesta | null } {
  const firma = firmaDe(texto);
  if (!firma) return { datos: d, propuesta: null };
  const correcciones = [...d.correcciones, { firma, tipo, en }].slice(-MAX_CORRECCIONES);
  const datos = { ...d, correcciones };
  const p = { firma, tipo };
  const veces = correcciones.filter((c) => misma(c, p)).length;
  const yaEsRegla = d.reglas.some((r) => r.prefijo === firma && r.tipo === tipo);
  const rechazada = d.descartadas.some((x) => misma(x, p));
  return { datos, propuesta: veces >= CORRECCIONES_PARA_PROPONER && !yaEsRegla && !rechazada ? p : null };
}

/** Acepta una propuesta: la regla (si ya había una con ese prefijo, cambia su tipo) y fuera sus correcciones. */
export function aceptarPropuesta(d: DatosReglas, p: Propuesta, creada: string): DatosReglas {
  const existe = d.reglas.some((r) => r.prefijo === p.firma);
  return {
    ...d,
    reglas: existe
      ? d.reglas.map((r) => (r.prefijo === p.firma ? { ...r, tipo: p.tipo } : r))
      : [...d.reglas, { prefijo: p.firma, tipo: p.tipo, creada }],
    correcciones: d.correcciones.filter((c) => c.firma !== p.firma),
  };
}

/** Rechaza una propuesta: no se vuelve a ofrecer, y fuera sus correcciones. */
export function descartarPropuesta(d: DatosReglas, p: Propuesta): DatosReglas {
  return {
    ...d,
    // Solo la firma y el tipo (la del feed lleva también su momento).
    descartadas: d.descartadas.some((x) => misma(x, p))
      ? d.descartadas
      : [...d.descartadas, { firma: p.firma, tipo: p.tipo }],
    correcciones: d.correcciones.filter((c) => !misma(c, p)),
  };
}

/** Cambia la regla `i` (su prefijo o su tipo); un prefijo que no vale o que ya tiene otra regla no se aplica. */
export function editarRegla(d: DatosReglas, i: number, cambio: Partial<Pick<ReglaDeteccion, 'prefijo' | 'tipo'>>) {
  const actual = d.reglas[i];
  if (!actual) return d;
  const prefijo = cambio.prefijo ?? actual.prefijo;
  if (!prefijoValido(prefijo) || d.reglas.some((r, j) => j !== i && r.prefijo === prefijo)) return d;
  const reglas = [...d.reglas];
  reglas[i] = { ...actual, prefijo, tipo: cambio.tipo ?? actual.tipo };
  return { ...d, reglas };
}

export const borrarRegla = (d: DatosReglas, i: number): DatosReglas => ({
  ...d,
  reglas: d.reglas.filter((_, j) => j !== i),
});

/** La primera regla cuyo prefijo empieza la primera línea con contenido del texto. */
export function reglaPara(texto: string, reglas: readonly ReglaDeteccion[]): ReglaDeteccion | undefined {
  if (!reglas.length) return undefined;
  const linea = primeraLinea(texto);
  return reglas.find((r) => r.prefijo && linea.startsWith(r.prefijo));
}
