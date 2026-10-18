/** Resultado de una operación que puede fallar por un caso esperado: el dominio no lanza (plan §6.2). */

export interface ErrorRimor {
  /** Código estable, en minúsculas con puntos: `formato.frontmatterInvalido`. */
  codigo: string;
  /** Clave de i18n del mensaje para la interfaz. */
  clave: string;
  datos?: Record<string, unknown>;
}

export type Resultado<T, E = ErrorRimor> = { ok: true; valor: T } | { ok: false; error: E };

export const ok = <T>(valor: T): Resultado<T, never> => ({ ok: true, valor });

export function fallo(codigo: string, datos?: Record<string, unknown>): Resultado<never> {
  return {
    ok: false,
    error: datos ? { codigo, clave: `errores.${codigo}`, datos } : { codigo, clave: `errores.${codigo}` },
  };
}
