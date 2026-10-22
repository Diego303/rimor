/**
 * Lo puro de las vistas de un grupo (VIS-02, VIS-03): las vistas que hay, el orden de la lista densa por cada
 * columna y los grupos del mosaico. TS puro.
 */
import type { FrontmatterComun } from '@rimor/formato';

export const VISTAS = ['lista', 'mosaico', 'densa'] as const;
export type Vista = (typeof VISTAS)[number];

/** La vista de la dirección (`?vista=`), o la lista si no es ninguna. */
export const vistaDe = (v: unknown): Vista => ((VISTAS as readonly unknown[]).includes(v) ? (v as Vista) : 'lista');

export const COLUMNAS_DENSA = ['tipo', 'titulo', 'fecha', 'colecciones', 'estado'] as const;
export type ColumnaDensa = (typeof COLUMNAS_DENSA)[number];
export type Sentido = 'asc' | 'desc';

export interface OrdenDensa {
  columna: ColumnaDensa;
  sentido: Sentido;
}

/** Lo más reciente arriba. */
export const ORDEN_INICIAL: OrdenDensa = { columna: 'fecha', sentido: 'desc' };

/** Pulsar una cabecera: la misma columna cambia de sentido; otra empieza por el suyo (la fecha, lo reciente). */
export function siguienteOrden(actual: OrdenDensa, columna: ColumnaDensa): OrdenDensa {
  if (actual.columna === columna) return { columna, sentido: actual.sentido === 'asc' ? 'desc' : 'asc' };
  return { columna, sentido: columna === 'fecha' ? 'desc' : 'asc' };
}

export interface NombresDensa {
  /** El nombre del tipo en el idioma de la interfaz (se ordena por lo que se lee). */
  tipo(fm: FrontmatterComun): string;
  /** El estado visible, con su nombre. */
  estado(fm: FrontmatterComun): string;
  idioma: string;
}

const instante = (fm: FrontmatterComun) => {
  const ms = Date.parse(fm.creado);
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Los elementos en el orden de una columna. Se compara lo que se lee, sin acentos ni mayúsculas y con los números
 * como números («v2» antes que «v10»); lo vacío (sin colecciones) va siempre al final. A igualdad, lo más reciente.
 */
export function ordenarDensa(
  elementos: readonly FrontmatterComun[],
  orden: OrdenDensa,
  nombres: NombresDensa,
): FrontmatterComun[] {
  const cotejo = new Intl.Collator(nombres.idioma, { sensitivity: 'base', numeric: true });
  const texto = (fm: FrontmatterComun): string => {
    switch (orden.columna) {
      case 'tipo':
        return nombres.tipo(fm);
      case 'titulo':
        return fm.titulo;
      case 'colecciones':
        return (fm.colecciones ?? []).join(', ');
      case 'estado':
        return nombres.estado(fm);
      default:
        return '';
    }
  };
  const signo = orden.sentido === 'asc' ? 1 : -1;
  const conClave = elementos.map((fm) => ({ fm, t: texto(fm), ms: instante(fm) }));
  conClave.sort((a, b) => {
    if (orden.columna === 'fecha') return signo * (a.ms - b.ms) || cotejo.compare(a.fm.ref, b.fm.ref);
    if (!a.t !== !b.t) return a.t ? -1 : 1;
    return signo * cotejo.compare(a.t, b.t) || b.ms - a.ms;
  });
  return conClave.map((x) => x.fm);
}

export type AgruparPor = 'tipo' | 'fecha';

/**
 * Los grupos del mosaico, de lo más reciente a lo más antiguo: por tipo (en el orden de su elemento más
 * reciente) o por día. `dia` da la clave del día de un elemento.
 */
export function agruparMosaico(
  elementos: readonly FrontmatterComun[],
  por: AgruparPor,
  dia: (fm: FrontmatterComun) => string,
): [string, FrontmatterComun[]][] {
  const ordenados = [...elementos].sort((a, b) => instante(b) - instante(a));
  const grupos = new Map<string, FrontmatterComun[]>();
  for (const fm of ordenados) {
    const clave = por === 'tipo' ? fm.tipo : dia(fm);
    const grupo = grupos.get(clave);
    if (grupo) grupo.push(fm);
    else grupos.set(clave, [fm]);
  }
  return [...grupos];
}
