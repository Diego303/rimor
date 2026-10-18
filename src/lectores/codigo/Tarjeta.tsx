/** Tarjeta del lector Código: lenguaje y líneas. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorCodigo } from './lector';

export default function TarjetaCodigo({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorCodigo.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
