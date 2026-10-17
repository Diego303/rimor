import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clases } from '../clases';
import { Icono, type NombreIcono } from '../iconos/Icono';

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma' | 'senal' | 'icono';

const CLASE: Record<VarianteBoton, string> = {
  primario: 'btn pri',
  secundario: 'btn',
  fantasma: 'btn gh',
  senal: 'btn key',
  icono: 'ibtn',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Primario: la acción de un bloque. Señal (naranja): como mucho una por pantalla (guía §3.3). */
  variante?: VarianteBoton;
  pequeno?: boolean;
  peligro?: boolean;
  icono?: NombreIcono;
  children?: ReactNode;
}

/** Botón de Rimor. El texto es siempre un verbo que dice lo que pasa (guía §7.1). */
export function Boton({
  variante = 'secundario',
  pequeno,
  peligro,
  icono,
  className,
  type = 'button',
  children,
  ...resto
}: Props) {
  return (
    <button
      type={type}
      className={clases(CLASE[variante], pequeno && variante !== 'icono' && 'sm', peligro && 'dan', className)}
      {...resto}
    >
      {icono && <Icono nombre={icono} />}
      {children}
    </button>
  );
}
