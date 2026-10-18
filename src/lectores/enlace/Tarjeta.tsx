/** Tarjeta del lector Enlace: sitio y qué es. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorEnlace } from './lector';

export default function TarjetaEnlace({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorEnlace.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
