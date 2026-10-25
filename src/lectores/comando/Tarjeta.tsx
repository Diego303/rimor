/** Tarjeta del lector Comando: el comando en mono, con sus huecos resaltados. */
import type { PropsTarjeta } from '../contrato';
import { trozosComando } from './analisis';

export default function TarjetaComando({ el }: PropsTarjeta) {
  const comando = el.frontmatter.titulo;
  return (
    <p className="mono xs comando-tarjeta">
      {trozosComando(comando).map((tr, i) =>
        tr.t === 'hueco' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: los trozos de un comando son fijos y en su orden.
          <span key={i} className="var">
            {tr.v}
          </span>
        ) : (
          tr.v
        ),
      )}
    </p>
  );
}
