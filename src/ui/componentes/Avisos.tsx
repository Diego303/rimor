/**
 * Aviso efímero global (guía §7.12): píldora de tinta abajo en el centro, 2,6 s, en participio («Exportado»).
 * Los avisos se encolan y se muestran de uno en uno. Uno con acción («Guardado. Deshacer») dura 10 s.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const DURACION_AVISO_MS = 2600;
/** Lo que dura un aviso con acción: el tiempo para deshacer (IN-014). */
export const DURACION_AVISO_CON_ACCION_MS = 10_000;

export interface AccionAviso {
  etiqueta: string;
  alPulsar: () => void;
}

export interface OpcionesAviso {
  accion?: AccionAviso;
  duracionMs?: number;
}

export interface Aviso {
  id: number;
  texto: ReactNode;
  accion?: AccionAviso;
  duracionMs: number;
}

interface ContextoAvisos {
  avisar: (texto: ReactNode, opciones?: OpcionesAviso) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [cola, setCola] = useState<Aviso[]>([]);
  const actual = cola[0];

  useEffect(() => {
    if (!actual) return;
    const t = setTimeout(() => setCola((c) => c.slice(1)), actual.duracionMs);
    return () => clearTimeout(t);
  }, [actual]);

  const avisar = useCallback((texto: ReactNode, { accion, duracionMs }: OpcionesAviso = {}) => {
    const duracion = duracionMs ?? (accion ? DURACION_AVISO_CON_ACCION_MS : DURACION_AVISO_MS);
    setCola((c) => [
      ...c,
      { id: Date.now() + Math.random(), texto, duracionMs: duracion, ...(accion ? { accion } : {}) },
    ]);
  }, []);
  const valor = useMemo(() => ({ avisar }), [avisar]);

  return (
    <Contexto.Provider value={valor}>
      {children}
      {/* La región viva existe siempre, para que el lector de pantalla anuncie también el primer aviso. */}
      <div className="solo-lector" role="status" aria-live="polite">
        {actual?.texto}
      </div>
      {actual && (
        <div className="toast">
          {/* El texto ya lo anuncia la región viva; el botón sí tiene que poder alcanzarse. */}
          <span aria-hidden="true">{actual.texto}</span>
          {actual.accion && (
            <button
              type="button"
              className="toast-accion"
              onClick={() => {
                actual.accion?.alPulsar();
                setCola((c) => c.slice(1));
              }}
            >
              {actual.accion.etiqueta}
            </button>
          )}
        </div>
      )}
    </Contexto.Provider>
  );
}

/** Acceso a la cola de avisos. Requiere `ProveedorAvisos`. */
export function useAvisos(): ContextoAvisos {
  const c = useContext(Contexto);
  if (!c) throw new Error('useAvisos necesita un ProveedorAvisos');
  return c;
}
