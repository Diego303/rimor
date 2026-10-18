/** Tarjeta del lector Prompt: forma, variables y destino. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorPrompt } from './lector';

export default function TarjetaPrompt({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorPrompt.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
