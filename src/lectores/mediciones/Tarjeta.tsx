/** Tarjeta del lector Mediciones: cuántas y su mediana. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorMediciones } from './lector';

export default function TarjetaMediciones({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorMediciones.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
