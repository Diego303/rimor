/**
 * La lógica de la paleta de comandos (BUS-03): cómo casa lo escrito con cada entrada, en qué orden salen (las
 * recientes primero) y las recientes de este navegador. TS puro.
 */
import type { TipoElemento } from '@rimor/formato';
import { normalizarBusqueda } from '../../busqueda/contrato';

export type GrupoEntrada = 'accion' | 'coleccion' | 'elemento' | 'buscar';

export interface Entrada {
  /** Estable entre aperturas (`accion:atajos.irInicio`, `coleccion:gateway`): con él se recuerdan las recientes. */
  id: string;
  grupo: GrupoEntrada;
  titulo: string;
  /** La línea de debajo: la ref y el tipo de un elemento, la pantalla de una acción. */
  detalle?: string;
  /** Las teclas del atajo, si lo tiene. */
  teclas?: string;
  /** El tipo de un elemento, para su icono. */
  tipo?: TipoElemento;
  ejecutar: () => void;
}

/**
 * Cuánto casa lo escrito con un texto, sin acentos ni mayúsculas: 4 si empieza igual, 3 si empieza una palabra,
 * 2 si lo contiene, 1 si tiene sus letras en orden («gb» en «Ir a Buscar» no: «iab» sí); 0, nada. Varias palabras
 * casan si todas están.
 */
export function puntuar(consulta: string, texto: string): number {
  const q = normalizarBusqueda(consulta).trim().replace(/\s+/g, ' ');
  if (!q) return 1;
  const t = normalizarBusqueda(texto);
  if (t.startsWith(q)) return 4;
  if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapar(q)}`, 'u').test(t)) return 3;
  if (t.includes(q)) return 2;
  const palabras = q.split(' ');
  if (palabras.length > 1) return palabras.every((p) => t.includes(p)) ? 1.5 : 0;
  return q.length >= 2 && enOrden(q, t) ? 1 : 0;
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Las letras de `q`, en orden, dentro de `t`. */
function enOrden(q: string, t: string): boolean {
  let i = 0;
  for (const c of t) if (c === q[i] && ++i === q.length) return true;
  return false;
}

const ORDEN_GRUPO: Record<GrupoEntrada, number> = { accion: 0, coleccion: 1, elemento: 2, buscar: 3 };

export interface EntradaOrdenada extends Entrada {
  /** Sale en «Recientes» (sin texto, las últimas usadas van arriba). */
  reciente: boolean;
  /** Lo bien que casa con lo escrito (`puntuar`); sin texto, 1. */
  puntuacion: number;
}

/** Desde aquí, casa de verdad (lo contiene); por debajo, solo tiene sus letras en orden. */
export const COINCIDE_BIEN = 2;

/**
 * Las entradas en el orden de la paleta. Sin texto: las recientes (en el orden en que se usaron) y después el
 * resto en su orden (lo de la pantalla antes que lo global). Con texto: las que casan, por grupo y, dentro, por lo
 * bien que casan por el título (a igualdad, la más reciente). El detalle no cuenta: «En esta pantalla» haría que
 * «pan» casara con todas las acciones.
 */
export function ordenar(
  consulta: string,
  entradas: readonly Entrada[],
  recientes: readonly string[],
): EntradaOrdenada[] {
  const puesto = new Map(recientes.map((id, i) => [id, i]));
  const rango = (e: Entrada) => puesto.get(e.id) ?? Number.POSITIVE_INFINITY;
  if (!consulta.trim()) {
    const arriba = entradas.filter((e) => puesto.has(e.id)).sort((a, b) => rango(a) - rango(b));
    const resto = entradas.filter((e) => !puesto.has(e.id));
    return [
      ...arriba.map((e) => ({ ...e, reciente: true, puntuacion: 1 })),
      ...resto.map((e) => ({ ...e, reciente: false, puntuacion: 1 })),
    ];
  }
  return entradas
    .map((e, i) => ({ e, i, p: puntuar(consulta, e.titulo) }))
    .filter((x) => x.p > 0)
    .sort(
      (a, b) => ORDEN_GRUPO[a.e.grupo] - ORDEN_GRUPO[b.e.grupo] || b.p - a.p || rango(a.e) - rango(b.e) || a.i - b.i,
    )
    .map(({ e, p }) => ({ ...e, reciente: false, puntuacion: p }));
}

/** Las recientes que se recuerdan. */
export const MAX_RECIENTES = 5;
const CLAVE_RECIENTES = 'rimor.paleta.recientes';

type Almacen = Pick<Storage, 'getItem' | 'setItem'>;

/** El `localStorage` del navegador, si se deja usar (en una ventana privada o con los datos bloqueados, no). */
function almacenLocal(): Almacen | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Las últimas entradas usadas, la más reciente primero. */
export function leerRecientes(almacen: Almacen | null = almacenLocal()): string[] {
  try {
    const lista: unknown = JSON.parse(almacen?.getItem(CLAVE_RECIENTES) ?? '[]');
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECIENTES) : [];
  } catch {
    return [];
  }
}

/** Apunta una entrada como la más reciente; devuelve la lista nueva (aunque no se haya podido guardar). */
export function apuntarReciente(id: string, almacen: Almacen | null = almacenLocal()): string[] {
  const lista = [id, ...leerRecientes(almacen).filter((x) => x !== id)].slice(0, MAX_RECIENTES);
  try {
    almacen?.setItem(CLAVE_RECIENTES, JSON.stringify(lista));
  } catch {
    // Es una comodidad: sin poder guardarla, la paleta funciona igual.
  }
  return lista;
}
