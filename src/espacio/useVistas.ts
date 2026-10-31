/** Las vistas guardadas (IN-054) en la interfaz: ligero, porque lo usa el raíl (carga inicial). */
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from './Espacio';
import { type DatosVistas, VISTAS_INICIALES } from './vistas';

/** Las vistas guardadas, al día con cada cambio (también las de la otra pestaña). */
export function useVistas(): DatosVistas {
  const espacio = useEspacioOpcional();
  const [vistas, setVistas] = useState<DatosVistas>(() => espacio?.vistas() ?? VISTAS_INICIALES);
  useEffect(() => {
    if (!espacio) return undefined;
    setVistas(espacio.vistas());
    return espacio.alCambiar(() => setVistas(espacio.vistas()));
  }, [espacio]);
  return vistas;
}
