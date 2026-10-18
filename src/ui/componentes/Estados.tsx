/** Estados de una zona: vacío, cargando y error (guía §7.12), y la rejilla del raíl (§7.13). */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MINIMO_VISIBLE_MS } from '../marca/estadosSenal';
import { Senal } from '../marca/Senal';
import { useEsperaVisible } from '../marca/useEsperaVisible';

/** Qué aparecerá aquí y cómo empezar. */
export function Vacio({ titulo, children }: { titulo: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{titulo}</b>
      {children && <span className="sm">{children}</span>}
    </div>
  );
}

interface PropsCargando {
  /** Qué se carga: «DuckDB, solo la primera vez». */
  texto: string;
  /** Progreso determinado entre 0 y 1; sin él, la espera es indeterminada. */
  progreso?: number;
}

/**
 * Espera con texto. Indeterminada: la animación «cargando» del símbolo (IN-090). Determinada: barra fina de
 * 6 px con el avance y el texto encima.
 */
export function Cargando({ texto, progreso }: PropsCargando) {
  if (progreso === undefined) return <Senal estado="cargando" etiqueta={texto} />;
  return (
    <div className="cargando" role="status" aria-live="polite">
      <p className="xs muted">{texto}</p>
      <div className="loading" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(1, progreso)) * 100}%` }} />
      </div>
    </div>
  );
}

/** Avisa al contenedor de cuándo empezó a verse una espera que va a desmontarse (fallback de Suspense). */
const ContextoEsperas = createContext<((texto: string, desde: number) => void) | null>(null);

/**
 * Para esperas que desaparecen solas al terminar (el fallback de un `Suspense`): si una llegó a verse, la
 * mantiene encima hasta cumplir los 600 ms, para que no parpadee.
 */
export function ProveedorEsperas({ children }: { children: ReactNode }) {
  const [resto, setResto] = useState<{ texto: string; hasta: number } | null>(null);
  const soltar = useCallback((texto: string, desde: number) => {
    const hasta = desde + MINIMO_VISIBLE_MS;
    if (hasta > Date.now()) setResto({ texto, hasta });
  }, []);
  useEffect(() => {
    if (!resto) return undefined;
    const t = setTimeout(() => setResto(null), Math.max(0, resto.hasta - Date.now()));
    return () => clearTimeout(t);
  }, [resto]);
  return (
    <ContextoEsperas.Provider value={soltar}>
      {children}
      {resto && (
        <div className="espera-residual">
          <Cargando texto={resto.texto} />
        </div>
      )}
    </ContextoEsperas.Provider>
  );
}

/**
 * Espera que solo se ve si pasa de 400 ms y, entonces, al menos 600 ms (guía §11.1). Dentro de un
 * `ProveedorEsperas` cumple el mínimo aunque se desmonte antes.
 */
export function Espera({ texto }: { texto: string }) {
  const visible = useEsperaVisible(true);
  const soltar = useContext(ContextoEsperas);
  const desde = useRef<number | null>(null);
  if (visible && desde.current === null) desde.current = Date.now();
  useEffect(
    () => () => {
      if (desde.current !== null) soltar?.(texto, desde.current);
    },
    [soltar, texto],
  );
  return visible ? <Cargando texto={texto} /> : null;
}

/** Qué pasó y qué hacer, sin disculpas. */
export function ErrorTarjeta({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <section className="card error" role="alert">
      <div className="row">
        {/* La señal se aplana una vez y el punto queda en rojo; el título es su texto (decorativa). */}
        <Senal estado="error" veces={1} decorativa tamano={20} etiqueta="" />
        <b className="sm titulo-error">{titulo}</b>
      </div>
      <p className="sm">{children}</p>
    </section>
  );
}

/** Rejilla de altavoz: el único adorno, solo en el pie del raíl. */
export function Rejilla() {
  return <span className="rejilla" aria-hidden="true" />;
}
