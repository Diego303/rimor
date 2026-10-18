/**
 * Almacenamiento persistente y espacio usado (DAT-06, F0-1) sobre `navigator.storage`, inyectable para probar.
 * Nada de esto bloquea: si una API falta, se dice y se sigue.
 */
import type { ResultadoPersistencia } from './estado';

/** Lo que se usa de `navigator.storage`. */
export interface AlmacenamientoNavegador {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
  estimate?: () => Promise<{ usage?: number; quota?: number }>;
  getDirectory?: () => Promise<unknown>;
}

const del = (): AlmacenamientoNavegador | undefined =>
  globalThis.navigator?.storage as AlmacenamientoNavegador | undefined;

/** Pide el almacenamiento persistente. Debe llamarse desde un gesto del usuario (un botón). */
export async function pedirPersistencia(
  s: AlmacenamientoNavegador | undefined = del(),
): Promise<ResultadoPersistencia> {
  if (!s?.persist) return 'no-disponible';
  try {
    return (await s.persist()) ? 'concedida' : 'denegada';
  } catch {
    return 'no-disponible';
  }
}

export async function estaPersistido(s: AlmacenamientoNavegador | undefined = del()): Promise<boolean> {
  try {
    return (await s?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

/** Bytes usados y cuota, o `null` si el navegador no lo dice. */
export async function espacioUsado(
  s: AlmacenamientoNavegador | undefined = del(),
): Promise<{ usado: number; cuota: number } | null> {
  try {
    const e = await s?.estimate?.();
    return e && typeof e.usage === 'number' && typeof e.quota === 'number' ? { usado: e.usage, cuota: e.quota } : null;
  } catch {
    return null;
  }
}

/** Por debajo de esta cuota, lo normal es una ventana privada (Chromium y Safari dan cuotas pequeñas). */
export const CUOTA_VENTANA_PRIVADA = 150 * 1024 * 1024;

/**
 * Heurística de ventana privada: OPFS no se puede abrir (Firefox) o la cuota es muy pequeña (Chromium, Safari).
 * Solo sirve para avisar; nunca bloquea nada.
 */
export async function esVentanaPrivada(s: AlmacenamientoNavegador | undefined = del()): Promise<boolean> {
  if (!s?.getDirectory) return false;
  try {
    await s.getDirectory();
  } catch {
    return true;
  }
  const e = await espacioUsado(s);
  return e !== null && e.cuota < CUOTA_VENTANA_PRIVADA;
}
