import { useCallback, useSyncExternalStore } from 'react';
import { type Clave, idiomaActivo, suscribir, traducir, type Vars } from './i18n';

/** Traducción en componentes: re-pinta cuando cambia el idioma. */
export function useT() {
  const idioma = useSyncExternalStore(suscribir, idiomaActivo, idiomaActivo);
  const t = useCallback((clave: Clave, vars?: Vars) => traducir(idioma, clave, vars), [idioma]);
  return { t, idioma };
}
