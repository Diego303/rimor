/** Tarjeta del lector genérico de archivo: tamaño y tipo. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorArchivo } from './lector';

export default function TarjetaArchivo({ el }: PropsTarjeta) {
  const { idioma } = useT();
  const a = el.frontmatter.adjunto;
  return (
    <p className="sm muted">{lectorArchivo.resumenLegible?.({ tam: a?.tam ?? 0, mime: a?.mime ?? '' }, idioma)}</p>
  );
}
