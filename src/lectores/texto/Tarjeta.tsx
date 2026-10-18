/** Tarjeta del lector Texto: las tres primeras líneas. */
import type { PropsTarjeta } from '../contrato';

export default function TarjetaTexto({ el }: PropsTarjeta) {
  const inicio = (el.original ?? '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 3)
    .join('\n');
  return <p className="sm muted tarjeta-texto">{inicio}</p>;
}
