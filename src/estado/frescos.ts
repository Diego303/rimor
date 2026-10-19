/**
 * Lo capturado en esta sesión (IN-026): el feed lo marca con el borde naranja de «fresco» durante 10 minutos o
 * hasta que se abre. No se guarda: es de la sesión.
 */
import { create } from 'zustand';

/** Cuánto dura «fresco». */
export const DURACION_FRESCO_MS = 10 * 60_000;

interface Frescos {
  /** Ref → cuándo se capturó (ms). */
  capturados: Record<string, number>;
  anadir(refs: readonly string[], ahora?: number): void;
  /** Abrirlo lo deja de marcar. */
  abierto(ref: string): void;
}

export const useFrescos = create<Frescos>((set) => ({
  capturados: {},
  anadir: (refs, ahora = Date.now()) =>
    set((s) => ({ capturados: { ...s.capturados, ...Object.fromEntries(refs.map((r) => [r, ahora])) } })),
  abierto: (ref) =>
    set((s) => {
      if (!(ref in s.capturados)) return s;
      const { [ref]: _, ...resto } = s.capturados;
      return { capturados: resto };
    }),
}));

export const esFresco = (capturados: Readonly<Record<string, number>>, ref: string, ahora = Date.now()) => {
  const cuando = capturados[ref];
  return cuando !== undefined && ahora - cuando < DURACION_FRESCO_MS;
};
