/** Estados de una zona: vacío, cargando y error (guía §7.12), y la rejilla del raíl (§7.13). */
import type { ReactNode } from 'react';

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
  texto: ReactNode;
  /** Progreso determinado entre 0 y 1; sin él, la espera es indeterminada. */
  progreso?: number;
}

/**
 * Espera con texto. La barra fina queda para el progreso determinado;
 * IN-090 sustituye el indicador indeterminado por la animación «cargando» del símbolo.
 */
export function Cargando({ texto, progreso }: PropsCargando) {
  const determinado = progreso !== undefined;
  return (
    <div className="cargando" role="status" aria-live="polite">
      <p className="xs muted">{texto}</p>
      <div className={determinado ? 'loading determinado' : 'loading'} aria-hidden="true">
        <i style={determinado ? { width: `${Math.max(0, Math.min(1, progreso)) * 100}%` } : undefined} />
      </div>
    </div>
  );
}

/** Qué pasó y qué hacer, sin disculpas. */
export function ErrorTarjeta({ titulo, children }: { titulo: ReactNode; children: ReactNode }) {
  return (
    <section className="card error" role="alert">
      <b className="sm titulo-error">{titulo}</b>
      <p className="sm">{children}</p>
    </section>
  );
}

/** Rejilla de altavoz: el único adorno, solo en el pie del raíl. */
export function Rejilla() {
  return <span className="rejilla" aria-hidden="true" />;
}
