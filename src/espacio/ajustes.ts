/**
 * Ajustes del espacio (`.rimor/ajustes.json`). Aquí lo que ya se usa: los tipos con las respuestas de Rimor
 * desactivadas (D14, IN-016) y el recordatorio de copia (IN-037). IN-038 añade el resto sin perder lo que no
 * conoce. Puro.
 */
import { esTipoElemento, type TipoElemento } from '@rimor/formato';

export const RUTA_AJUSTES = '.rimor/ajustes.json';

/** El recordatorio de copia (DAT-07) y la copia previa a lo destructivo. */
export interface AjustesCopias {
  /** Cambios sin copia a partir de los que toca copiar. */
  cambios: number;
  /** Días sin copia a partir de los que toca copiar. */
  dias: number;
  /** Recordarlo en Inicio. */
  avisar: boolean;
  /** Descargar un ZIP antes de reemplazar al importar o de vaciar la papelera. */
  zipPrevio: boolean;
}

export const COPIAS_INICIALES: AjustesCopias = { cambios: 50, dias: 7, avisar: true, zipPrevio: true };
export const LIMITES_COPIAS = { cambios: [5, 1000], dias: [1, 90] } as const;

/** Los ajustes de copia de lo guardado: lo que falte o no valga, por defecto; los números, dentro de sus límites. */
export function copiasDe(d: unknown): AjustesCopias {
  const c = (typeof d === 'object' && d !== null ? d : {}) as Record<string, unknown>;
  const numero = (x: unknown, [min, max]: readonly [number, number], porDefecto: number) =>
    typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, Math.round(x))) : porDefecto;
  return {
    cambios: numero(c.cambios, LIMITES_COPIAS.cambios, COPIAS_INICIALES.cambios),
    dias: numero(c.dias, LIMITES_COPIAS.dias, COPIAS_INICIALES.dias),
    avisar: typeof c.avisar === 'boolean' ? c.avisar : COPIAS_INICIALES.avisar,
    zipPrevio: typeof c.zipPrevio === 'boolean' ? c.zipPrevio : COPIAS_INICIALES.zipPrevio,
  };
}

export interface Ajustes {
  esquema: 1;
  respuestas: { desactivadas: TipoElemento[] };
  copias: AjustesCopias;
  /** Lo que escriban versiones posteriores: se conserva tal cual. */
  [otra: string]: unknown;
}

export const AJUSTES_INICIALES: Ajustes = { esquema: 1, respuestas: { desactivadas: [] }, copias: COPIAS_INICIALES };

export function leerAjustes(texto: string | null): Ajustes {
  if (!texto) return structuredClone(AJUSTES_INICIALES);
  try {
    const d = JSON.parse(texto) as Record<string, unknown>;
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return structuredClone(AJUSTES_INICIALES);
    const respuestas = (d.respuestas ?? {}) as { desactivadas?: unknown };
    const desactivadas = Array.isArray(respuestas.desactivadas)
      ? [...new Set(respuestas.desactivadas.filter((x): x is TipoElemento => esTipoElemento(x)))]
      : [];
    return {
      ...d,
      esquema: 1,
      respuestas: { ...respuestas, desactivadas },
      copias: { ...(d.copias as object), ...copiasDe(d.copias) },
    };
  } catch {
    return structuredClone(AJUSTES_INICIALES);
  }
}

export const respuestaDesactivada = (a: Ajustes, tipo: TipoElemento): boolean =>
  a.respuestas.desactivadas.includes(tipo);
