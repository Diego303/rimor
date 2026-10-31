/**
 * Reglas de detección aprendidas (CAP-06, IN-049): si se corrige tres veces el tipo de contenidos que empiezan igual
 * (su firma: `[app]`, `svc:`), Rimor propone que los siguientes sean de ese tipo. Se guardan en
 * `.rimor/reglas-deteccion.json` con las correcciones que llevan a ellas y las propuestas que se rechazaron; de esas dos,
 * solo la huella de su firma (el principio de un elemento borrado no se queda en el archivo ni viaja en el ZIP). TS
 * puro: leer, escribir, aprender y aplicar.
 */
import { esTipoElemento, sha256Hex, type TipoElemento } from '@rimor/formato';

export const RUTA_REGLAS = '.rimor/reglas-deteccion.json';
export const ESQUEMA_REGLAS = 1;

/** Correcciones con la misma firma y el mismo tipo que hacen una propuesta. */
export const CORRECCIONES_PARA_PROPONER = 3;
/** Correcciones que se recuerdan (las últimas). */
export const MAX_CORRECCIONES = 100;
/** Largo máximo de una firma y de un prefijo. */
export const LARGO_FIRMA = 32;
export const LARGO_PREFIJO = 64;

/** Tipos a los que no lleva una regla: los binarios no se detectan por su texto. */
const SIN_REGLA: ReadonlySet<TipoElemento> = new Set(['imagen', 'pdf', 'archivo']);

export interface ReglaDeteccion {
  /** Lo que empieza la primera línea con contenido. */
  prefijo: string;
  tipo: TipoElemento;
  creada: string;
}

export interface Correccion {
  /** La huella de la firma (`huellaDe`), no la firma. */
  huella: string;
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
  /** Propuestas a las que se dijo «No» (la huella de su firma): no se vuelven a ofrecer. */
  descartadas: { huella: string; tipo: TipoElemento }[];
}

export const REGLAS_INICIALES: DatosReglas = Object.freeze({
  esquema: 1,
  reglas: [],
  correcciones: [],
  descartadas: [],
}) as DatosReglas;

const esTipo = esTipoElemento;
const esTexto = (x: unknown): x is string => typeof x === 'string';

/** La huella de una firma: los 16 primeros caracteres de su SHA-256. */
export const huellaDe = (firma: string): string => sha256Hex(firma).slice(0, 16);

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

/** Una fecha o una hora (`2026-10-31`, `18:00:00`, `31/10`): cambia en cada captura. */
const FECHA_U_HORA = /\d{1,4}[-/.:]\d{1,2}/;

/**
 * La firma de un contenido: la primera palabra de su primera línea con contenido, si lleva una letra y un signo que no
 * es letra ni cifra (`[app]`, `app:`, `<svc>`). No cuenta la puntuación de una palabra corriente (`¿Por`, `Hola,`,
 * `(nota)`, `"Cita"`, `I'm`): no hace una regla útil. Tampoco una fecha o una hora, que cambian cada vez, ni lo de más
 * de 32 caracteres. `null` si no tiene.
 */
export function firmaDe(texto: string): string | null {
  const palabra = primeraLinea(texto).split(/\s/, 1)[0] ?? '';
  if (!palabra || palabra.length > LARGO_FIRMA || FECHA_U_HORA.test(palabra)) return null;
  const sinPuntuacion = palabra.replace(/^[¿¡"'“‘«(]+|[,;.!?"'”’»)]+$/gu, '').replace(/(?<=\p{L})['’-](?=\p{L})/gu, '');
  return /\p{L}/u.test(sinPuntuacion) && /[^\p{L}\p{N}]/u.test(sinPuntuacion) ? palabra : null;
}

/** ¿Vale como prefijo de una regla (el que se escribe en Ajustes)? Sin saltos de línea y de largo razonable. */
export const prefijoValido = (p: string): boolean =>
  p.trim() !== '' && p.length <= LARGO_PREFIJO && !/[\r\n]/.test(p) && p === p.trimStart();

/**
 * Lee el archivo; `null` si existe pero no se entiende o es de un esquema más nuevo (no se sobrescribe: se perderían
 * las reglas o lo que no se conoce).
 */
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
  if (typeof o.esquema === 'number' && o.esquema > ESQUEMA_REGLAS) return null;
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
      esTexto(c.huella) && esTipo(c.tipo) ? [{ huella: c.huella, tipo: c.tipo, en: esTexto(c.en) ? c.en : '' }] : [],
    )
    .slice(-MAX_CORRECCIONES);
  const descartadas = lista(o.descartadas).flatMap((p) =>
    esTexto(p.huella) && esTipo(p.tipo) ? [{ huella: p.huella, tipo: p.tipo }] : [],
  );
  return { esquema: 1, reglas, correcciones, descartadas };
}

export const escribirReglas = (d: DatosReglas): string => `${JSON.stringify(d, null, 2)}\n`;

const misma = (a: { huella: string; tipo: TipoElemento }, huella: string, tipo: TipoElemento) =>
  a.huella === huella && a.tipo === tipo;

/**
 * Anota que un contenido se corrigió a `tipo`. Si con esta ya van {@link CORRECCIONES_PARA_PROPONER} con su firma y ese
 * tipo, y ni hay ya una regla que lo diga ni se rechazó, la propuesta. Sin firma, o a un binario, nada cambia.
 */
export function anotarCorreccion(
  d: DatosReglas,
  texto: string,
  tipo: TipoElemento,
  en: string,
): { datos: DatosReglas; propuesta: Propuesta | null } {
  const firma = firmaDe(texto);
  if (!firma || SIN_REGLA.has(tipo)) return { datos: d, propuesta: null };
  const huella = huellaDe(firma);
  const correcciones = [...d.correcciones, { huella, tipo, en }].slice(-MAX_CORRECCIONES);
  const datos = { ...d, correcciones };
  const veces = correcciones.filter((c) => misma(c, huella, tipo)).length;
  const yaEsRegla = d.reglas.some((r) => r.prefijo === firma && r.tipo === tipo);
  const rechazada = d.descartadas.some((x) => misma(x, huella, tipo));
  return {
    datos,
    propuesta: veces >= CORRECCIONES_PARA_PROPONER && !yaEsRegla && !rechazada ? { firma, tipo } : null,
  };
}

/** Acepta una propuesta: la regla (si ya había una con ese prefijo, cambia su tipo) y fuera sus correcciones. */
export function aceptarPropuesta(d: DatosReglas, p: Propuesta, creada: string): DatosReglas {
  const existe = d.reglas.some((r) => r.prefijo === p.firma);
  const huella = huellaDe(p.firma);
  return {
    ...d,
    reglas: existe
      ? d.reglas.map((r) => (r.prefijo === p.firma ? { ...r, tipo: p.tipo } : r))
      : [...d.reglas, { prefijo: p.firma, tipo: p.tipo, creada }],
    correcciones: d.correcciones.filter((c) => c.huella !== huella),
  };
}

/** Rechaza una propuesta: no se vuelve a ofrecer, y fuera sus correcciones. */
export function descartarPropuesta(d: DatosReglas, p: Propuesta): DatosReglas {
  const huella = huellaDe(p.firma);
  return {
    ...d,
    descartadas: d.descartadas.some((x) => misma(x, huella, p.tipo))
      ? d.descartadas
      : [...d.descartadas, { huella, tipo: p.tipo }],
    correcciones: d.correcciones.filter((c) => !misma(c, huella, p.tipo)),
  };
}

/**
 * Cambia la regla de prefijo `prefijo` (su prefijo o su tipo): por su prefijo y no por su posición, que puede cambiar
 * si la lista cambia entre tanto. Un prefijo que no vale o que ya tiene otra regla no se aplica.
 */
export function editarRegla(
  d: DatosReglas,
  prefijo: string,
  cambio: Partial<Pick<ReglaDeteccion, 'prefijo' | 'tipo'>>,
): DatosReglas {
  const i = d.reglas.findIndex((r) => r.prefijo === prefijo);
  const actual = d.reglas[i];
  if (!actual) return d;
  const nuevo = cambio.prefijo ?? actual.prefijo;
  if (!prefijoValido(nuevo) || d.reglas.some((r, j) => j !== i && r.prefijo === nuevo)) return d;
  const reglas = [...d.reglas];
  reglas[i] = { ...actual, prefijo: nuevo, tipo: cambio.tipo ?? actual.tipo };
  return { ...d, reglas };
}

export const borrarRegla = (d: DatosReglas, prefijo: string): DatosReglas => ({
  ...d,
  reglas: d.reglas.filter((r) => r.prefijo !== prefijo),
});

/**
 * La regla que decide un texto: de las que su prefijo empieza la primera línea con contenido, la del prefijo más largo
 * (la más concreta: `[app]` gana a `[`, en el orden que sea).
 */
export function reglaPara(texto: string, reglas: readonly ReglaDeteccion[]): ReglaDeteccion | undefined {
  if (!reglas.length) return undefined;
  const linea = primeraLinea(texto);
  let mejor: ReglaDeteccion | undefined;
  for (const r of reglas)
    if (r.prefijo && linea.startsWith(r.prefijo) && r.prefijo.length > (mejor?.prefijo.length ?? 0)) mejor = r;
  return mejor;
}
