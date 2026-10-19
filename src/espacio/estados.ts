/**
 * Estados ligeros de un elemento (ORG-04): sin estado es «nuevo»; los comunes valen para cualquier tipo y cada
 * lector puede declarar los suyos (`Lector.estados`, como los de las ideas). TS puro.
 */
import type { TonoEstado } from '../ui/componentes/Marcas';

export const ESTADOS_COMUNES = ['en-uso', 'resuelto', 'archivado'] as const;
export type EstadoComun = (typeof ESTADOS_COMUNES)[number];
/** El de un elemento sin estado (y sin estados propios de su tipo). */
export const ESTADO_NUEVO = 'nuevo';

export const esEstadoComun = (estado: string | undefined): estado is EstadoComun =>
  !!estado && (ESTADOS_COMUNES as readonly string[]).includes(estado);

/** Lo que el lector declara de los estados de su tipo. */
interface EstadosDelLector {
  estados?: readonly string[];
  estadosElegibles?: readonly string[];
}

/** El estado que se enseña: el guardado o, sin él, el primero propio del tipo o «nuevo». */
export const estadoVisible = (estado: string | undefined, lector?: EstadosDelLector | null): string =>
  estado ?? lector?.estados?.[0] ?? ESTADO_NUEVO;

/**
 * Los estados que se pueden elegir para un elemento, en orden: el de sin estado («nuevo» o el primero propio),
 * los propios elegibles y los comunes. El actual siempre está, aunque no se pueda elegir a mano.
 */
export function estadosPosibles(lector: EstadosDelLector | null | undefined, actual?: string): string[] {
  const propios = lector?.estadosElegibles ?? lector?.estados ?? [];
  const lista = [...(lector?.estados?.length ? [] : [ESTADO_NUEVO]), ...propios, ...ESTADOS_COMUNES];
  const visible = estadoVisible(actual, lector);
  return [...new Set(lista.includes(visible) ? lista : [visible, ...lista])];
}

/** Tono del chip de estado (como la referencia): lo nuevo destaca, lo resuelto en verde, lo abierto en ámbar. */
const TONOS: Readonly<Record<string, TonoEstado>> = {
  nuevo: 'acc',
  'en-uso': 'warn',
  resuelto: 'ok',
  semilla: 'warn',
  explorando: 'acc',
  convertida: 'ok',
};

export const tonoDeEstado = (estado: string): TonoEstado => TONOS[estado] ?? 'neutro';
