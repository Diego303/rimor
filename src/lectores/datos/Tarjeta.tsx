/** Tarjeta del lector Datos tabulares: filas y columnas. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorDatos } from './lector';

export default function TarjetaDatos({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorDatos.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
