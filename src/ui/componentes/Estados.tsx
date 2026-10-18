/** Estados de una zona: vacío, cargando y error (guía §7.12), y la rejilla del raíl (§7.13). */
import type { ReactNode } from 'react';
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

/** Espera que solo se ve si pasa de 400 ms y, entonces, al menos 600 ms (guía §11.1). */
export function Espera({ texto }: { texto: string }) {
  const visible = useEsperaVisible(true);
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
