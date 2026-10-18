/** Tarjeta del lector Documento Markdown: secciones, palabras y tareas. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorMarkdown } from './lector';

export default function TarjetaMarkdown({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorMarkdown.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
