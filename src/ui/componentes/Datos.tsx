/** Piezas de datos: tabla, barra horizontal, medidor y veredicto (guía §7.8 y §7.11). */
import type { ReactNode } from 'react';
import { clases } from '../clases';

export interface Columna<F> {
  id: string;
  titulo: ReactNode;
  celda: (fila: F) => ReactNode;
  /** Cifras comparables: mono tabular y alineadas a la derecha. */
  numerica?: boolean;
}

interface PropsTabla<F> {
  columnas: readonly Columna<F>[];
  filas: readonly F[];
  clave: (fila: F) => string;
  alPulsarFila?: (fila: F) => void;
  activa?: (fila: F) => boolean;
  /** Descripción para el lector de pantalla. */
  titulo?: string;
}

export function Tabla<F>({ columnas, filas, clave, alPulsarFila, activa, titulo }: PropsTabla<F>) {
  return (
    <div className="tbl-wrap">
      <table>
        {titulo && <caption className="solo-lector">{titulo}</caption>}
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c.id} scope="col" className={c.numerica ? 'n' : undefined}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr
              key={clave(f)}
              className={clases(alPulsarFila && 'click', activa?.(f) && 'on') || undefined}
              onClick={alPulsarFila ? () => alPulsarFila(f) : undefined}
              onKeyDown={
                alPulsarFila
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        alPulsarFila(f);
                      }
                    }
                  : undefined
              }
              tabIndex={alPulsarFila ? 0 : undefined}
              aria-current={activa?.(f) ? true : undefined}
            >
              {columnas.map((c) => (
                <td key={c.id} className={c.numerica ? 'n' : undefined}>
                  {c.celda(f)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PropsBarraH {
  etiqueta: ReactNode;
  valor: number;
  maximo: number;
  /** Valor ya formateado que se muestra a la derecha. */
  texto: string;
}

/** Barra horizontal con su valor. */
export function BarraH({ etiqueta, valor, maximo, texto }: PropsBarraH) {
  const ancho = maximo > 0 ? Math.max(0, Math.min(100, (valor / maximo) * 100)) : 0;
  return (
    <div className="hb">
      <span>{etiqueta}</span>
      <span className="tr" aria-hidden="true">
        <i className="fi" style={{ width: `${ancho}%` }} />
      </span>
      <span className="v">{texto}</span>
    </div>
  );
}

/** Medidor fino (progreso de tareas, espacio usado). */
export function Medidor({ fraccion, etiqueta }: { fraccion: number; etiqueta: string }) {
  const f = Number.isFinite(fraccion) ? Math.max(0, Math.min(1, fraccion)) : 0;
  return (
    // biome-ignore lint/a11y/useSemanticElements: <meter> no admite el aspecto de la guía en todos los navegadores.
    <div
      className="meter"
      role="meter"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(f * 100)}
    >
      <i style={{ width: `${f * 100}%` }} />
    </div>
  );
}

interface PropsVeredicto {
  /** La cifra de la pantalla, ya formateada (`−4,5 %`), o `≈` si no hay diferencia clara. */
  cifra: string;
  frase: ReactNode;
  explicacion?: ReactNode;
  /** La explicación en gris (la comparación) o con el color del texto (lo que escribiste, en el error). */
  explicacionAtenuada?: boolean;
  tono: 'ok' | 'warn' | 'bad';
}

/** Un veredicto por pantalla: cifra grande y frase (E3). */
export function Veredicto({ cifra, frase, explicacion, explicacionAtenuada = true, tono }: PropsVeredicto) {
  return (
    <div className={clases('verdict', tono)}>
      <span className="big">{cifra}</span>
      <div className="txt">
        <b>{frase}</b>
        {explicacion && <p className={clases('sm', explicacionAtenuada && 'muted')}>{explicacion}</p>}
      </div>
    </div>
  );
}
