/** Tarjeta del lector Diff: archivos y líneas añadidas y quitadas. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorDiff } from './lector';

export default function TarjetaDiff({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted mono">{lectorDiff.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
