/**
 * Textos propios de un lector (IN-012): viven en su carpeta, no en `es.json`, con claves tipadas y el mismo motor
 * que los de la app (plurales, `{x}`, números). TS puro: el Worker de derivados también los carga.
 */
import type { Idioma } from '../i18n/formatos';
import { type Plural, type RutasHoja, traducirEn, type Vars } from '../i18n/motor';

/** Lo mínimo que todo lector dice: qué está calculando mientras deriva. */
export interface TextosBase {
  analizando: string;
}

/** Un catálogo en otro idioma puede dejar claves sin traducir: caen al español. */
export type Parcial<T> = {
  [K in keyof T]?: T[K] extends string ? string : T[K] extends Plural ? Plural : Parcial<T[K]>;
};

export interface TextosLector<C extends TextosBase = TextosBase> {
  readonly es: C;
  readonly en?: Parcial<C>;
  /** Texto de `clave` en `idioma`, con sus variables. */
  t(idioma: Idioma, clave: RutasHoja<C>, vars?: Vars): string;
}

export function definirTextos<const C extends TextosBase>(es: C, en?: Parcial<C>): TextosLector<C> {
  const catalogos = en ? { es, en } : { es };
  return { es, ...(en ? { en } : {}), t: (idioma, clave, vars) => traducirEn(catalogos, idioma, clave, vars) };
}
