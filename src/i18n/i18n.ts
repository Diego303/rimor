/**
 * Textos de la interfaz (APP-07): claves tipadas a partir de `es.json`, interpolación `{x}`, plurales con
 * `Intl.PluralRules` (objetos `{ one, other }`) e idioma activo con cambio en caliente.
 */
import en from './en.json';
import es from './es.json';
import { fmtNumero, type Idioma } from './formatos';

export type { Idioma } from './formatos';

type Plural = { one?: string; other: string; zero?: string; two?: string; few?: string; many?: string };

/** Rutas `a.b.c` hasta cada texto; un objeto de plurales cuenta como hoja. */
type RutasHoja<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends Plural
      ? `${P}${K}`
      : RutasHoja<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Catalogo = typeof es;
export type Clave = RutasHoja<Catalogo>;
export type Vars = Record<string, string | number>;

const CATALOGOS: Record<Idioma, unknown> = { es, en };
export const IDIOMAS: readonly Idioma[] = ['es', 'en'];
export const CLAVE_IDIOMA = 'rimor:idioma';

const reglasPlural: Record<Idioma, Intl.PluralRules> = {
  es: new Intl.PluralRules('es'),
  en: new Intl.PluralRules('en'),
};

function buscar(catalogo: unknown, clave: string): unknown {
  let nodo = catalogo;
  for (const parte of clave.split('.')) {
    if (typeof nodo !== 'object' || nodo === null) return undefined;
    nodo = (nodo as Record<string, unknown>)[parte];
  }
  return nodo;
}

function elegir(nodo: unknown, idioma: Idioma, vars: Vars | undefined): string | undefined {
  if (typeof nodo === 'string') return nodo;
  if (typeof nodo === 'object' && nodo !== null && 'other' in nodo) {
    const formas = nodo as Plural;
    const n = Number(vars?.n ?? 0);
    const categoria = n === 0 && formas.zero ? 'zero' : reglasPlural[idioma].select(n);
    return (formas as Record<string, string | undefined>)[categoria] ?? formas.other;
  }
  return undefined;
}

/**
 * Texto de `clave` en `idioma`, con sus variables. Las variables numéricas se formatean con `fmtNumero`
 * (`10.000`, `−3`) y `n` elige la forma plural. Si falta en inglés, cae al español; si falta del todo, la clave.
 */
export function traducir(idioma: Idioma, clave: Clave, vars?: Vars): string {
  const texto =
    elegir(buscar(CATALOGOS[idioma], clave), idioma, vars) ?? elegir(buscar(CATALOGOS.es, clave), 'es', vars) ?? clave;
  if (!vars) return texto;
  return texto.replace(/\{(\w+)\}/g, (m, nombre: string) => {
    const valor = vars[nombre];
    if (valor === undefined) return m;
    return typeof valor === 'number' ? fmtNumero(valor, idioma) : valor;
  });
}

let activo: Idioma = 'es';
const suscriptores = new Set<() => void>();

/** Idioma con el que se pinta la interfaz. */
export function idiomaActivo(): Idioma {
  return activo;
}

/** Cambia el idioma y avisa a quien pinta textos (cambio en caliente). */
export function cambiarIdioma(idioma: Idioma): void {
  if (idioma === activo) return;
  activo = idioma;
  if (typeof document !== 'undefined') document.documentElement.lang = idioma;
  for (const fn of suscriptores) fn();
}

/** Se suscribe a los cambios de idioma; devuelve la función para darse de baja. */
export function suscribir(fn: () => void): () => void {
  suscriptores.add(fn);
  return () => suscriptores.delete(fn);
}

/** Texto en el idioma activo. */
export function t(clave: Clave, vars?: Vars): string {
  return traducir(activo, clave, vars);
}

/** Idioma inicial: el guardado, o el del navegador si es inglés; si no, español. */
export function idiomaInicial(guardado: string | null, navegador: string | undefined): Idioma {
  if (guardado === 'es' || guardado === 'en') return guardado;
  return navegador?.toLowerCase().startsWith('en') ? 'en' : 'es';
}
