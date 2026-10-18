/** Tarjeta del lector Error: lenguaje y tipo. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorError } from './lector';

export default function TarjetaError({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorError.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
