import { NOMBRE_APP } from './geometria';
import { SimboloRimor } from './SimboloRimor';

/** Símbolo y «Rimor» en Archivo 700, con texto vivo (hallazgo M4): en el raíl, a 18 px. */
export function Logotipo({ tamano = 18 }: { tamano?: number }) {
  return (
    <span className="logotipo">
      <SimboloRimor tamano={Math.round(tamano * 1.22)} />
      <b style={{ fontSize: `${tamano / 16}rem` }}>{NOMBRE_APP}</b>
    </span>
  );
}
