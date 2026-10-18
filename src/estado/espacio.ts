/**
 * Estado del espacio abierto que pinta la carcasa: nombre, recuento de «Sin clasificar», colecciones y estado
 * de la copia. Lo llena la apertura del espacio (IN-007) y lo actualizan captura, colecciones y copias.
 */
import { create } from 'zustand';

export interface ColeccionRail {
  id: string;
  nombre: string;
  recuento: number;
}

export interface EstadoEspacio {
  nombre: string;
  sinClasificar: number;
  colecciones: ColeccionRail[];
  /** Fecha ISO de la última copia completa, o null si nunca se hizo. */
  ultimaCopia: string | null;
  /** La copia está al día (piloto verde) o toca hacerla (ámbar). */
  copiaAlDia: boolean;
  /** Otra pestaña tiene el espacio abierto: esta solo lee (IN-005). */
  soloLectura: boolean;
}

export const useEspacio = create<EstadoEspacio>(() => ({
  nombre: '',
  sinClasificar: 0,
  colecciones: [],
  ultimaCopia: null,
  copiaAlDia: false,
  soloLectura: false,
}));
