/**
 * Idioma al arrancar y al elegirlo: localStorage «rimor:idioma» (IN-038 lo reflejará en Ajustes)
 * o, si no hay, el del navegador. Separado de i18n.ts para que este siga siendo puro.
 */
import { CLAVE_IDIOMA, cambiarIdioma, type Idioma, idiomaInicial } from './i18n';

function leerGuardado(): string | null {
  try {
    return globalThis.localStorage?.getItem(CLAVE_IDIOMA) ?? null;
  } catch {
    return null;
  }
}

/** Aplica el idioma inicial. Se llama una vez al montar la isla. */
export function iniciarIdioma(): void {
  const idioma = idiomaInicial(leerGuardado(), globalThis.navigator?.language);
  cambiarIdioma(idioma);
  // cambiarIdioma no hace nada si ya era el activo: el atributo se fija igualmente.
  if (typeof document !== 'undefined') document.documentElement.lang = idioma;
}

/** Cambia el idioma y lo recuerda. */
export function elegirIdioma(idioma: Idioma): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    // Sin almacenamiento local: vale para esta sesión.
  }
  cambiarIdioma(idioma);
}
