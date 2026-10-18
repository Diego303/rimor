/**
 * Ajustes del espacio (`.rimor/ajustes.json`). Aquí solo lo que ya se usa: los tipos con las respuestas de
 * Rimor desactivadas (D14, IN-016). IN-038 añade el resto sin perder lo que no conoce. Puro.
 */
import { esTipoElemento, type TipoElemento } from '@rimor/formato';

export const RUTA_AJUSTES = '.rimor/ajustes.json';

export interface Ajustes {
  esquema: 1;
  respuestas: { desactivadas: TipoElemento[] };
  /** Lo que escriban versiones posteriores: se conserva tal cual. */
  [otra: string]: unknown;
}

export const AJUSTES_INICIALES: Ajustes = { esquema: 1, respuestas: { desactivadas: [] } };

export function leerAjustes(texto: string | null): Ajustes {
  if (!texto) return structuredClone(AJUSTES_INICIALES);
  try {
    const d = JSON.parse(texto) as Record<string, unknown>;
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return structuredClone(AJUSTES_INICIALES);
    const respuestas = (d.respuestas ?? {}) as { desactivadas?: unknown };
    const desactivadas = Array.isArray(respuestas.desactivadas)
      ? [...new Set(respuestas.desactivadas.filter((x): x is TipoElemento => esTipoElemento(x)))]
      : [];
    return { ...d, esquema: 1, respuestas: { ...respuestas, desactivadas } };
  } catch {
    return structuredClone(AJUSTES_INICIALES);
  }
}

export const respuestaDesactivada = (a: Ajustes, tipo: TipoElemento): boolean =>
  a.respuestas.desactivadas.includes(tipo);
