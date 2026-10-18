/**
 * Aviso efímero global (guía §7.12): píldora de tinta abajo en el centro, 2,6 s, en participio («Exportado»).
 * Los avisos se encolan y se muestran de uno en uno.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export const DURACION_AVISO_MS = 2600;

export interface Aviso {
  id: number;
  texto: ReactNode;
}

interface ContextoAvisos {
  avisar: (texto: ReactNode) => void;
}

const Contexto = createContext<ContextoAvisos | null>(null);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [cola, setCola] = useState<Aviso[]>([]);
  const actual = cola[0];

  useEffect(() => {
    if (!actual) return;
    const t = setTimeout(() => setCola((c) => c.slice(1)), DURACION_AVISO_MS);
    return () => clearTimeout(t);
  }, [actual]);

  const avisar = useCallback((texto: ReactNode) => {
    setCola((c) => [...c, { id: Date.now() + Math.random(), texto }]);
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
        <div className="toast" aria-hidden="true">
          {actual.texto}
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
