/**
 * El original de un elemento para pintarlo: el del `.md` o, si va como adjunto de texto (más de 2 MB), el que se
 * lee del espacio. `null` mientras se carga o si no es texto.
 */
import type { Elemento } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { cargarTextoAdjunto } from './adjuntos';

export function useOriginal(el: Elemento): string | null {
  const espacio = useEspacioOpcional();
  const [cargado, setCargado] = useState<string | null>(null);
  useEffect(() => {
    if (el.original !== null || !espacio) return undefined;
    let vigente = true;
    void cargarTextoAdjunto(espacio.repositorio, el)
      .then((t) => vigente && setCargado(t))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [el, espacio]);
  return el.original ?? cargado;
}
