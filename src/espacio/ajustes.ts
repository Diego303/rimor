/**
 * Ajustes del espacio (`.rimor/ajustes.json`). Aquí lo que ya se usa: los tipos con las respuestas de Rimor
 * desactivadas (D14, IN-016) y el recordatorio de copia (IN-037). IN-038 añade el resto sin perder lo que no
 * conoce. Puro.
 */
import { esTipoElemento, type TipoElemento } from '@rimor/formato';
import { MARGEN_DUDA, UMBRAL_DETECCION } from '../captura/detector';
import { REGLAS_SECRETOS } from '../seguridad/secretos/reglas';

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

export type TemaAjustes = 'sistema' | 'claro' | 'oscuro';

/** La detección de tipo (D13): por encima de qué confianza gana un lector y a qué distancia se duda entre dos. */
export interface AjustesDeteccion {
  umbral: number;
  duda: number;
}

export const DETECCION_INICIAL: AjustesDeteccion = { umbral: UMBRAL_DETECCION, duda: MARGEN_DUDA };
export const LIMITES_DETECCION = { umbral: [0.3, 0.9], duda: [0.05, 0.4] } as const;

export interface Ajustes {
  esquema: 1;
  /** Sin él, el del navegador (o el del sistema). */
  tema?: TemaAjustes;
  idioma?: 'es' | 'en';
  deteccion: AjustesDeteccion;
  /** Los ids de las reglas de secretos que no se aplican (IN-010). */
  secretos: { desactivadas: string[] };
  respuestas: { desactivadas: TipoElemento[] };
  copias: AjustesCopias;
  /** Lo que escriban versiones posteriores: se conserva tal cual. */
  [otra: string]: unknown;
}

export const AJUSTES_INICIALES: Ajustes = {
  esquema: 1,
  deteccion: DETECCION_INICIAL,
  secretos: { desactivadas: [] },
  respuestas: { desactivadas: [] },
  copias: COPIAS_INICIALES,
};

/** Un objeto (no una lista ni un texto), o vacío. */
const objeto = (x: unknown): Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : {};

const enLimites = (x: unknown, [min, max]: readonly [number, number], porDefecto: number) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : porDefecto;

const IDS_REGLAS: ReadonlySet<string> = new Set(REGLAS_SECRETOS.map((r) => r.id));

export function leerAjustes(texto: string | null): Ajustes {
  if (!texto) return structuredClone(AJUSTES_INICIALES);
  try {
    const d = JSON.parse(texto) as Record<string, unknown>;
    if (typeof d !== 'object' || d === null || Array.isArray(d)) return structuredClone(AJUSTES_INICIALES);
    const respuestas = objeto(d.respuestas) as { desactivadas?: unknown };
    const desactivadas = Array.isArray(respuestas.desactivadas)
      ? [...new Set(respuestas.desactivadas.filter((x): x is TipoElemento => esTipoElemento(x)))]
      : [];
    const leidos: Ajustes = {
      ...d,
      esquema: 1,
      respuestas: { ...respuestas, desactivadas },
      // De cada parte se conserva también lo que no se conoce (si es un objeto, no una lista ni un texto).
      copias: { ...objeto(d.copias), ...copiasDe(d.copias) },
      deteccion: {
        ...objeto(d.deteccion),
        umbral: enLimites(objeto(d.deteccion).umbral, LIMITES_DETECCION.umbral, DETECCION_INICIAL.umbral),
        duda: enLimites(objeto(d.deteccion).duda, LIMITES_DETECCION.duda, DETECCION_INICIAL.duda),
      },
      secretos: {
        ...objeto(d.secretos),
        desactivadas: Array.isArray(objeto(d.secretos).desactivadas)
          ? [
              ...new Set(
                // También las que esta versión no conoce: una posterior puede haber desactivado una regla nueva, y
                // reescribir el archivo no debe volver a activarla.
                (objeto(d.secretos).desactivadas as unknown[]).filter((x): x is string => typeof x === 'string'),
              ),
            ]
          : [],
      },
    };
    // Un tema o un idioma que no se entienden no se usan (se quita lo que haya).
    if (!(d.tema === 'sistema' || d.tema === 'claro' || d.tema === 'oscuro')) delete leidos.tema;
    if (!(d.idioma === 'es' || d.idioma === 'en')) delete leidos.idioma;
    return leidos;
  } catch {
    return structuredClone(AJUSTES_INICIALES);
  }
}

export const respuestaDesactivada = (a: Ajustes, tipo: TipoElemento): boolean =>
  a.respuestas.desactivadas.includes(tipo);

/** Lo que la captura y la vista previa del compositor toman de los ajustes (serializable: va también al Worker). */
export interface OpcionesCaptura {
  secretosDesactivados: string[];
  umbral: number;
  margen: number;
}

export const opcionesCaptura = (a: Ajustes): OpcionesCaptura => ({
  secretosDesactivados: a.secretos.desactivadas.filter((id) => IDS_REGLAS.has(id)),
  umbral: a.deteccion.umbral,
  margen: a.deteccion.duda,
});
