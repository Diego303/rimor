/** Pinta una plantilla de log: la usan la vista de Log y la comparación de logs. */
import type { ReactNode } from 'react';

/** Una plantilla con sus marcadores (`<N>`, `<ID>`…) y su nivel resaltados, como en la pantalla de referencia. */
export function PlantillaPintada({ plantilla }: { plantilla: string }) {
  const piezas: ReactNode[] = [];
  let resto = plantilla;
  let k = 0;
  // Como en la pantalla de referencia: todos los marcadores y solo el primer nivel.
  let nivelPintado = false;
  const patron = /<(N|ID|IP|HEX)>|\b(ERROR|WARN)\b/;
  for (let m = patron.exec(resto); m; m = patron.exec(resto)) {
    if (m[2] && nivelPintado) {
      piezas.push(resto.slice(0, m.index + m[0].length));
      resto = resto.slice(m.index + m[0].length);
      continue;
    }
    if (m[2]) nivelPintado = true;
    if (m.index) piezas.push(resto.slice(0, m.index));
    piezas.push(
      m[1] ? (
        <span key={k++} className="ph">
          {m[1]}
        </span>
      ) : (
        <span key={k++} className={`lv-${m[2]}`}>
          {m[2]}
        </span>
      ),
    );
    resto = resto.slice(m.index + m[0].length);
  }
  if (resto) piezas.push(resto);
  return <>{piezas}</>;
}
