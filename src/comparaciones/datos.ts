/**
 * Comparación antes y después de dos conjuntos de datos (IN-044, plan §8.7): filas, columnas añadidas y quitadas,
 * columnas que cambian de tipo y cambios de distribución en las comunes (nulos, media, mínimo, máximo y únicos), lo
 * más llamativo primero. Sale de los dos perfiles (sus derivados), sin volver a leer los archivos. TS puro.
 */
import type { Valor } from '../lectores/datos/motor';
import type { DatosTabla, PerfilColumna } from '../lectores/datos/perfil';

export interface CambioColumna {
  nombre: string;
  nulos: [number, number];
  unicos: [number, number];
  media?: [number | undefined, number | undefined];
  min?: [Valor | undefined, Valor | undefined];
  max?: [Valor | undefined, Valor | undefined];
  /** Cuánto cambia (para ordenar): la suma de los cambios relativos de cada medida. */
  peso: number;
}

export interface ComparacionDatos {
  filas: [number, number];
  anadidas: string[];
  quitadas: string[];
  cambianTipo: { nombre: string; antes: string; despues: string }[];
  /** Las comunes que cambian, de la que más a la que menos. */
  cambios: CambioColumna[];
}

/** Cambio relativo entre dos números (0 si son iguales; 1 si uno es 0 y el otro no). */
function relativo(a: number | undefined, b: number | undefined): number {
  if (a === undefined || b === undefined || a === b) return 0;
  const escala = Math.max(Math.abs(a), Math.abs(b));
  return escala === 0 ? 0 : Math.abs(b - a) / escala;
}

const filasDe = (d: DatosTabla) => d.muestra?.aproximadas ?? d.filas;
const proporcion = (n: number, total: number) => (total > 0 ? n / total : 0);

function cambioDe(a: PerfilColumna, b: PerfilColumna, filas: [number, number]): CambioColumna | null {
  const numero = (x: Valor | undefined) => (typeof x === 'number' ? x : undefined);
  const peso =
    Math.abs(proporcion(b.nulos, filas[1]) - proporcion(a.nulos, filas[0])) +
    relativo(a.media, b.media) +
    relativo(a.unicos, b.unicos) +
    relativo(numero(a.min), numero(b.min)) +
    relativo(numero(a.max), numero(b.max)) +
    (a.min !== b.min && numero(a.min) === undefined ? 0.1 : 0) +
    (a.max !== b.max && numero(a.max) === undefined ? 0.1 : 0);
  if (peso === 0) return null;
  return {
    nombre: a.nombre,
    nulos: [a.nulos, b.nulos],
    unicos: [a.unicos, b.unicos],
    ...(a.media !== undefined || b.media !== undefined ? { media: [a.media, b.media] } : {}),
    ...(a.min !== b.min ? { min: [a.min, b.min] } : {}),
    ...(a.max !== b.max ? { max: [a.max, b.max] } : {}),
    peso,
  };
}

export function compararDatos(a: DatosTabla, b: DatosTabla): ComparacionDatos {
  const enB = new Map(b.columnas.map((c) => [c.nombre, c]));
  const enA = new Set(a.columnas.map((c) => c.nombre));
  const filas: [number, number] = [filasDe(a), filasDe(b)];
  const cambianTipo: ComparacionDatos['cambianTipo'] = [];
  const cambios: CambioColumna[] = [];
  for (const ca of a.columnas) {
    const cb = enB.get(ca.nombre);
    if (!cb) continue;
    if (ca.tipo !== cb.tipo) cambianTipo.push({ nombre: ca.nombre, antes: ca.tipo, despues: cb.tipo });
    const c = cambioDe(ca, cb, filas);
    if (c) cambios.push(c);
  }
  return {
    filas,
    anadidas: b.columnas.map((c) => c.nombre).filter((n) => !enA.has(n)),
    quitadas: a.columnas.map((c) => c.nombre).filter((n) => !enB.has(n)),
    cambianTipo,
    cambios: cambios.sort((x, y) => y.peso - x.peso),
  };
}
