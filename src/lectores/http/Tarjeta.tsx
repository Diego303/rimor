/** Tarjeta del lector Petición HTTP: el método, el servidor y cuántas cabeceras lleva. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorHttp } from './lector';

export default function TarjetaHttp({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorHttp.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
