/**
 * Estado de cuidado del espacio (`.rimor/estado.json`): si se pidió el almacenamiento persistente y qué dijo el
 * navegador, cuándo se hizo la última copia y cuántos cambios hay desde entonces (alimenta IN-037). Puro.
 */

export type ResultadoPersistencia = 'sin-pedir' | 'concedida' | 'denegada' | 'no-disponible';

export interface EstadoCuidado {
  esquema: 1;
  persistencia: ResultadoPersistencia;
  pedidaEn: string | null;
  ultimaCopia: string | null;
  cambiosDesdeCopia: number;
}

export const RUTA_ESTADO = '.rimor/estado.json';

export const ESTADO_INICIAL: EstadoCuidado = {
  esquema: 1,
  persistencia: 'sin-pedir',
  pedidaEn: null,
  ultimaCopia: null,
  cambiosDesdeCopia: 0,
};

const RESULTADOS: readonly ResultadoPersistencia[] = ['sin-pedir', 'concedida', 'denegada', 'no-disponible'];

/** Lee el estado guardado; lo que falte o no sea válido toma el valor inicial. */
export function leerEstado(texto: string | null): EstadoCuidado {
  if (!texto) return { ...ESTADO_INICIAL };
  try {
    const d = JSON.parse(texto) as Partial<Record<keyof EstadoCuidado, unknown>>;
    const cadena = (x: unknown) => (typeof x === 'string' ? x : null);
    return {
      esquema: 1,
      persistencia: RESULTADOS.find((r) => r === d.persistencia) ?? 'sin-pedir',
      pedidaEn: cadena(d.pedidaEn),
      ultimaCopia: cadena(d.ultimaCopia),
      cambiosDesdeCopia:
        Number.isInteger(d.cambiosDesdeCopia) && (d.cambiosDesdeCopia as number) >= 0
          ? (d.cambiosDesdeCopia as number)
          : 0,
    };
  } catch {
    return { ...ESTADO_INICIAL };
  }
}

export const conCambios = (e: EstadoCuidado, n = 1): EstadoCuidado => ({
  ...e,
  cambiosDesdeCopia: e.cambiosDesdeCopia + n,
});

export const conCopia = (e: EstadoCuidado, fecha: string): EstadoCuidado => ({
  ...e,
  ultimaCopia: fecha,
  cambiosDesdeCopia: 0,
});

export const conPersistencia = (e: EstadoCuidado, resultado: ResultadoPersistencia, fecha: string): EstadoCuidado => ({
  ...e,
  persistencia: resultado,
  pedidaEn: fecha,
});
