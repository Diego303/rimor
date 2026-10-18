/** Tarjeta del lector Log: líneas y errores. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorLog } from './lector';

export default function TarjetaLog({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorLog.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
