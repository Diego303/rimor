/** Tarjeta del lector Texto: las tres primeras líneas (o el resumen, si el texto va aparte por su tamaño). */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorTexto } from './lector';

export default function TarjetaTexto({ el }: PropsTarjeta) {
  const { idioma } = useT();
  if (el.original === null)
    return <p className="sm muted">{lectorTexto.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
  const inicio = el.original
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 3)
    .join('\n');
  return <p className="sm muted tarjeta-texto">{inicio}</p>;
}
