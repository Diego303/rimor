/**
 * Lo capturado en esta sesión (IN-026): el feed lo marca con el borde naranja de «fresco» durante 10 minutos o
 * hasta que se abre. Por id (la ref cambia si cambia el tipo). No se guarda: es de la sesión.
 */
import { create } from 'zustand';

/** Cuánto dura «fresco». */
export const DURACION_FRESCO_MS = 10 * 60_000;

interface Frescos {
  /** Id → cuándo se capturó (ms). */
  capturados: Record<string, number>;
  anadir(ids: readonly string[], ahora?: number): void;
  /** Abrirlo lo deja de marcar. */
  abierto(id: string): void;
}

export const useFrescos = create<Frescos>((set) => ({
  capturados: {},
  anadir: (ids, ahora = Date.now()) =>
    set((s) => ({ capturados: { ...s.capturados, ...Object.fromEntries(ids.map((id) => [id, ahora])) } })),
  abierto: (id) =>
    set((s) => {
      if (!(id in s.capturados)) return s;
      const { [id]: _, ...resto } = s.capturados;
      return { capturados: resto };
    }),
}));

export const esFresco = (capturados: Readonly<Record<string, number>>, id: string, ahora = Date.now()) => {
  const cuando = capturados[id];
  return cuando !== undefined && ahora - cuando < DURACION_FRESCO_MS;
};
