/**
 * Tarjeta del lector Comando: los comandos de verdad (del original, no del título, que el usuario puede cambiar y que
 * va recortado), con sus huecos resaltados.
 */
import type { PropsTarjeta } from '../contrato';
import { analizarComando, trozosComando } from './analisis';

export default function TarjetaComando({ el }: PropsTarjeta) {
  const d = analizarComando(el.original ?? '');
  return (
    <p className="mono xs comando-tarjeta">
      {d.comandos.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: los comandos son fijos y en su orden.
        <span key={i} className="linea">
          {trozosComando(c, d.huecos).map((tr, j) =>
            tr.t === 'hueco' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: los trozos de un comando son fijos y en su orden.
              <span key={j} className="var">
                {tr.v}
              </span>
            ) : (
              tr.v
            ),
          )}
          {'\n'}
        </span>
      ))}
    </p>
  );
}
