/** Columna de lectura (hasta 780 px) o ancha, con la cabecera común de una pantalla (guía §8.2). */
import type { ReactNode } from 'react';

interface Props {
  titulo?: ReactNode;
  meta?: ReactNode;
  /** Como mucho un control a la derecha de la cabecera. */
  control?: ReactNode;
  /** Encima del título: chip de tipo y estado. */
  marcas?: ReactNode;
  ancha?: boolean;
  children?: ReactNode;
}

export function Pantalla({ titulo, meta, control, marcas, ancha, children }: Props) {
  return (
    <div className={ancha ? 'col wide' : 'col'}>
      {(titulo || control) && (
        <div className="ah">
          <div className="tl">
            {marcas && <div className="row">{marcas}</div>}
            {titulo && <h2>{titulo}</h2>}
            {meta && <p className="meta">{meta}</p>}
          </div>
          {control}
        </div>
      )}
      {children}
    </div>
  );
}
