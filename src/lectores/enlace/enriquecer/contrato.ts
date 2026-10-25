/**
 * Enriquecer un enlace (LEC-03b, IN-041): cada proveedor sabe qué enlaces acepta, qué dominios consultaría y cómo
 * sacar de su API los campos de la ficha. Solo los que F0-7 validó (admiten peticiones desde el navegador). TS puro.
 */
import type { DatosEnlace } from '../lector';

export type FuenteFicha = 'github' | 'gitlab' | 'paquete' | 'crossref' | 'arxiv';

/** Lo que se guarda de una consulta: números, textos, sí o no; lo que no se sabe, fuera. */
export type CamposFicha = Record<string, string | number | boolean>;

/** La ficha de un enlace (en su frontmatter): de dónde salió, cuándo y qué decía. */
export interface Ficha {
  fuente: FuenteFicha;
  /** ISO con zona. */
  consultada: string;
  campos: CamposFicha;
}

export interface Consulta {
  /** `fetch` (o un doble en las pruebas). */
  pedir: (url: string, init?: RequestInit) => Promise<Response>;
  /** Los dominios activados en Ajustes (`api.github.com`…): los demás no se consultan. */
  activos: ReadonlySet<string>;
  /** Token de GitHub, de este navegador. */
  token?: string;
  senal?: AbortSignal;
}

export interface Enriquecedor {
  id: FuenteFicha;
  acepta(d: DatosEnlace): boolean;
  /** Los dominios que consultaría para este enlace; el primero es el imprescindible. */
  dominios(d: DatosEnlace): string[];
  consultar(d: DatosEnlace, c: Consulta): Promise<CamposFicha>;
}

/** `token`: GitHub no acepta el token de este navegador (caducado o revocado). */
export type CodigoFallo = 'sin-red' | 'limite' | 'no-encontrado' | 'token' | 'fallo';

/** Un fallo con nombre: la vista dice qué pasó y si se puede reintentar. */
export class FalloConsulta extends Error {
  constructor(
    readonly codigo: CodigoFallo,
    /** Con `limite`: cuándo se puede volver a consultar (ISO), si la API lo dice. */
    readonly hasta?: string,
  ) {
    super(codigo);
    this.name = 'FalloConsulta';
  }
}

const dominioDe = (url: string) => new URL(url).hostname;

/**
 * Pide JSON a un dominio activado. Sin conexión, bloqueada o sin respuesta en el plazo (el navegador no distingue),
 * `sin-red`; 404, `no-encontrado`; 401, `token`; el límite de GitHub, `limite`; cualquier otra respuesta mala o una
 * redirección a un dominio no activado, `fallo`.
 */
export async function pedirJson(url: string, c: Consulta, init: RequestInit = {}): Promise<unknown> {
  if (!c.activos.has(dominioDe(url))) throw new FalloConsulta('fallo');
  let r: Response;
  try {
    r = await c.pedir(url, { ...init, ...(c.senal ? { signal: c.senal } : {}) });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new FalloConsulta('sin-red');
  }
  // Una redirección acaba donde diga el servidor: lo que llegue de un dominio no activado no se lee.
  if (r.url && !c.activos.has(dominioDe(r.url))) throw new FalloConsulta('fallo');
  if (r.status === 404) throw new FalloConsulta('no-encontrado');
  if (r.status === 401) throw new FalloConsulta('token');
  if ((r.status === 403 || r.status === 429) && r.headers.get('x-ratelimit-remaining') === '0') {
    const reinicio = Number(r.headers.get('x-ratelimit-reset'));
    throw new FalloConsulta(
      'limite',
      Number.isFinite(reinicio) && reinicio > 0 ? new Date(reinicio * 1000).toISOString() : undefined,
    );
  }
  if (!r.ok) throw new FalloConsulta('fallo');
  try {
    return await r.json();
  } catch {
    throw new FalloConsulta('fallo');
  }
}

/** Lectura defensiva de un JSON de API: lo que no tiene la forma esperada, `undefined`. */
export const objeto = (x: unknown): Record<string, unknown> | undefined =>
  x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : undefined;
export const texto = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() ? x.trim() : undefined);
export const numero = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);
export const booleano = (x: unknown): boolean | undefined => (typeof x === 'boolean' ? x : undefined);
export const fecha = (x: unknown): string | undefined => {
  const t = texto(x);
  return t && !Number.isNaN(Date.parse(t)) ? t : undefined;
};

/** Solo los campos con valor. */
export function campos(entradas: Record<string, string | number | boolean | undefined>): CamposFicha {
  return Object.fromEntries(Object.entries(entradas).filter(([, v]) => v !== undefined)) as CamposFicha;
}
