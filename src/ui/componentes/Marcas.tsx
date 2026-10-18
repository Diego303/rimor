/** Chips, marcas y piezas pequeñas (guía §7.3). */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useT } from '../../i18n/useT';
import { clases } from '../clases';
import { Icono } from '../iconos/Icono';
import { ASPECTO_TIPO, type TipoVisual } from '../iconos/tipos';

/** Píldora pulsable con borde para filtrar. */
export function Filtro({
  activo,
  className,
  children,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { activo?: boolean }) {
  return (
    <button type="button" className={clases('pill', className)} aria-pressed={activo} {...resto}>
      {children}
    </button>
  );
}

/** Chip de tipo: icono y nombre en neutro; solo Error lleva color (E7). */
export function ChipTipo({ tipo }: { tipo: TipoVisual }) {
  const { t } = useT();
  const a = ASPECTO_TIPO[tipo];
  return (
    <span className={clases('kchip', a.clase)}>
      <Icono nombre={a.icono} tamano={13} />
      {t(`tipos.${tipo}`)}
    </span>
  );
}

/** Icono de tipo en un círculo (30 px; 24 px en listas densas). */
export function IconoTipo({ tipo, denso }: { tipo: TipoVisual; denso?: boolean }) {
  const { t } = useT();
  const a = ASPECTO_TIPO[tipo];
  const nombre = t(`tipos.${tipo}`);
  return (
    <span className={clases('ti', a.clase, denso && 'denso')} title={nombre}>
      <Icono nombre={a.icono} tamano={denso ? 14 : 16} />
      <span className="solo-lector">{nombre}</span>
    </span>
  );
}

export type TonoEstado = 'neutro' | 'acc' | 'ok' | 'warn' | 'bad';

/** Estado en píldora pequeña; el texto dice el estado, el color solo lo refuerza. */
export function Estado({ tono = 'neutro', children }: { tono?: TonoEstado; children: ReactNode }) {
  return <span className={clases('st', tono !== 'neutro' && tono)}>{children}</span>;
}

/** Referencia pulsable a un elemento (`LOG-0047`). Solo aparece donde se puede pulsar (guía §7.3). */
export function Ref({ refe, alPulsar }: { refe: string; alPulsar: (refe: string) => void }) {
  return (
    <button type="button" className="ref" onClick={() => alPulsar(refe)}>
      {refe}
    </button>
  );
}

/** Piloto de 7 px: correcto o pendiente. Nunca parpadea. */
export function Piloto({ tono, etiqueta }: { tono: 'ok' | 'warn'; etiqueta: string }) {
  return <span className={clases('piloto', tono === 'warn' && 'warn')} role="img" aria-label={etiqueta} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Cifra viva de un documento: al día, desfasada o rota. */
export function Cifra({ tono = 'viva', children }: { tono?: 'viva' | 'desfasada' | 'rota'; children: ReactNode }) {
  return <span className={clases('cifra', tono === 'desfasada' && 'old', tono === 'rota' && 'bad')}>{children}</span>;
}
