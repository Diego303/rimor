/**
 * Textos de la interfaz (APP-07): claves tipadas a partir de `es.json`, interpolación `{x}`, plurales con
 * `Intl.PluralRules` (objetos `{ one, other }`) e idioma activo con cambio en caliente.
 */
import en from './en.json';
import es from './es.json';
import type { Idioma } from './formatos';
import { type RutasHoja, traducirEn, type Vars } from './motor';

export type { Idioma } from './formatos';
export type { Plural, RutasHoja, Vars } from './motor';

export type Catalogo = typeof es;
export type Clave = RutasHoja<Catalogo>;

const CATALOGOS = { es, en };
export const IDIOMAS: readonly Idioma[] = ['es', 'en'];
export const CLAVE_IDIOMA = 'rimor:idioma';

/** Texto de la app (ver `traducirEn`). */
export function traducir(idioma: Idioma, clave: Clave, vars?: Vars): string {
  return traducirEn(CATALOGOS, idioma, clave, vars);
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
