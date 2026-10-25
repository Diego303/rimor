/** Tarjeta del lector JSON, YAML y TOML: el formato y cuántas claves tiene. */
import { useT } from '../../i18n/useT';
import type { PropsTarjeta } from '../contrato';
import { lectorJson } from './lector';

export default function TarjetaJson({ el }: PropsTarjeta) {
  const { idioma } = useT();
  return <p className="sm muted">{lectorJson.resumenLegible?.(el.frontmatter.lector.resumen, idioma)}</p>;
}
