/**
 * La versión anterior de un elemento, que la pantalla da a la vista de su lector (IN-029): la de Markdown marca en
 * su índice lo que cambió desde ella, como la referencia. Fuera de la pantalla, o sin versión anterior, `null`.
 */
import { createContext } from 'react';

export interface VersionAnterior {
  /** El número de la versión anterior. */
  version: number;
  /** Su original. */
  original: string;
}

export const ContextoVersion = createContext<VersionAnterior | null>(null);

/**
 * La versión que se está viendo, si no es la actual: la de Prompt la elige en la cabecera («v1 · v2 · actual», como
 * `SC.prompt`) y la vista enseña su texto y copia con sus variables, sin restaurarla.
 */
export const ContextoVersionVista = createContext<VersionAnterior | null>(null);
