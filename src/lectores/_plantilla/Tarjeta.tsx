/** Tarjeta de la plantilla en mosaico: solo recibe el elemento (sin derivados). Export por defecto. */
import type { PropsTarjeta } from '../contrato';

export default function TarjetaPlantilla({ el }: PropsTarjeta) {
  const inicio = (el.original ?? '').split(/\r?\n/).slice(0, 3).join('\n');
  return <pre className="code">{inicio}</pre>;
}
