/**
 * Umbral de las esperas (guía §11.1): una espera no se muestra hasta pasar 400 ms y, una vez visible, se ve
 * al menos 600 ms, para que no parpadee.
 */
import { useEffect, useRef, useState } from 'react';
import { MINIMO_VISIBLE_MS, UMBRAL_ESPERA_MS } from './estadosSenal';

export function useEsperaVisible(activo: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const desde = useRef(0);

  useEffect(() => {
    if (activo && !visible) {
      const t = setTimeout(() => {
        desde.current = Date.now();
        setVisible(true);
      }, UMBRAL_ESPERA_MS);
      return () => clearTimeout(t);
    }
    if (!activo && visible) {
      const resta = MINIMO_VISIBLE_MS - (Date.now() - desde.current);
      if (resta <= 0) {
        setVisible(false);
        return undefined;
      }
      const t = setTimeout(() => setVisible(false), resta);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activo, visible]);

  return visible;
}
