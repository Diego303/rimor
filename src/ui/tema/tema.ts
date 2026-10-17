/**
 * Preferencia de tema (APP-02): sigue al sistema o se fuerza en claro u oscuro con `data-theme` en `<html>`.
 * Vive en localStorage para aplicarla antes de pintar (script en línea de Base.astro); IN-038 la refleja en Ajustes.
 */

export type PreferenciaTema = 'sistema' | 'claro' | 'oscuro';

export const CLAVE_TEMA = 'rimor:tema';
const PREFERENCIAS: readonly PreferenciaTema[] = ['sistema', 'claro', 'oscuro'];
const ATRIBUTO: Record<PreferenciaTema, 'light' | 'dark' | null> = { sistema: null, claro: 'light', oscuro: 'dark' };

/** Lee la preferencia guardada; si no hay o no es válida, «sistema». */
export function leerPreferencia(
  almacen: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): PreferenciaTema {
  try {
    const v = almacen?.getItem(CLAVE_TEMA);
    return PREFERENCIAS.find((p) => p === v) ?? 'sistema';
  } catch {
    return 'sistema';
  }
}

/** Aplica la preferencia al documento. */
export function aplicarTema(p: PreferenciaTema, raiz: HTMLElement = document.documentElement): void {
  const atributo = ATRIBUTO[p];
  if (atributo) raiz.dataset.theme = atributo;
  else delete raiz.dataset.theme;
}

/** Guarda y aplica la preferencia. El guardado puede fallar (modo privado estricto) sin romper nada. */
export function guardarPreferencia(
  p: PreferenciaTema,
  almacen: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  try {
    almacen?.setItem(CLAVE_TEMA, p);
  } catch {
    // Sin almacenamiento local: el tema se aplica igual para esta sesión.
  }
  aplicarTema(p);
}
