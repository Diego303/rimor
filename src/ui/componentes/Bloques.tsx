/** Contenedores: tarjeta, detalles plegables, banner y hueco (guía §7.4, §7.9 y §7.10). */
import type { ReactNode } from 'react';
import { clases } from '../clases';

interface PropsTarjeta {
  titulo?: ReactNode;
  /** Etiqueta en mayúsculas encima del título. */
  etiqueta?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** Superficie elevada sin borde. Una tarjeta, una idea. */
export function Tarjeta({ titulo, etiqueta, className, children }: PropsTarjeta) {
  return (
    <section className={clases('card', className)}>
      {etiqueta && <span className="lbl">{etiqueta}</span>}
      {titulo && <h3>{titulo}</h3>}
      {children}
    </section>
  );
}

interface PropsDetalles {
  resumen: ReactNode;
  recuento?: number;
  abierto?: boolean;
  children: ReactNode;
}

/** Plegable con línea superior; el resumen lleva el recuento cuando lo hay: «Avisos de método (4)». */
export function Detalles({ resumen, recuento, abierto, children }: PropsDetalles) {
  return (
    <details className="more" open={abierto}>
      <summary>
        {resumen}
        {recuento !== undefined && ` (${recuento})`}
      </summary>
      <div>{children}</div>
    </details>
  );
}

/** Aviso destacado de la pantalla: el recuento en negrita y una frase. Uno por pantalla como mucho. */
export function Banner({ tono = 'aviso', children }: { tono?: 'aviso' | 'ok'; children: ReactNode }) {
  return (
    <div className={clases('banner', tono === 'ok' && 'ok')} role="status">
      {children}
    </div>
  );
}

const CLASE_HUECO = { grave: 'hi', normal: '', resuelto: 'okk', neutro: 'acc' } as const;

interface PropsHueco {
  gravedad?: keyof typeof CLASE_HUECO;
  accion?: ReactNode;
  children: ReactNode;
}

/** Fila hundida con un punto de color, una frase y una acción fantasma a la derecha. */
export function Hueco({ gravedad = 'normal', accion, children }: PropsHueco) {
  return (
    <div className={clases('gap', CLASE_HUECO[gravedad])}>
      <span className="dot" aria-hidden="true" />
      <span className="gbody">{children}</span>
      {accion}
    </div>
  );
}

export function Huecos({ children }: { children: ReactNode }) {
  return <div className="gaps">{children}</div>;
}
