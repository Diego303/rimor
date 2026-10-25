/**
 * Enriquecer un enlace del espacio (IN-041): con los dominios activados en sus ajustes y el token de este navegador,
 * consulta su proveedor y guarda la ficha en el elemento (la anterior queda como `fichaAnterior`). También activa
 * los dominios que pide «Activar y consultar».
 */
import { isoConZona } from '@rimor/formato';
import type { Repositorio } from '../../../almacen/repositorio';
import { type Ajustes, dominiosActivos } from '../../../espacio/ajustes';
import { analizar } from '../lector';
import { type CodigoFallo, FalloConsulta, type Ficha } from './contrato';
import { leerTokenGithub } from './dominios';
import { consultarFicha, dominiosDe, sePuedeConsultar } from './enriquecer';
import { conFicha } from './ficha';

export interface EspacioEnriquecible {
  repositorio: Pick<Repositorio, 'leerElemento' | 'actualizarElemento'>;
  ajustes(): Ajustes;
  guardarAjustes(cambio: (a: Ajustes) => Ajustes): Promise<void>;
}

export type ResultadoEnriquecer =
  | { estado: 'hecho'; ficha: Ficha }
  /** Faltan por activar estos dominios (o hay modo sin red). */
  | { estado: 'inactivo'; dominios: string[] }
  | { estado: 'sin-proveedor' }
  | { estado: 'fallo'; codigo: CodigoFallo; hasta?: string };

export interface OpcionesEnriquecer {
  pedir?: (url: string, init?: RequestInit) => Promise<Response>;
  ahora?: () => string;
  senal?: AbortSignal;
}

export async function enriquecerElemento(
  espacio: EspacioEnriquecible,
  refOId: string,
  o: OpcionesEnriquecer = {},
): Promise<ResultadoEnriquecer> {
  const leido = await espacio.repositorio.leerElemento(refOId);
  if (!leido.ok) return { estado: 'fallo', codigo: 'fallo' };
  const d = analizar(leido.valor.original ?? '');
  if (!d || !dominiosDe(d).length) return { estado: 'sin-proveedor' };
  const activos = dominiosActivos(espacio.ajustes());
  if (!sePuedeConsultar(d, activos)) return { estado: 'inactivo', dominios: dominiosDe(d) };
  const ahora = o.ahora ?? (() => isoConZona(new Date()));
  const token = leerTokenGithub();
  try {
    const ficha = await consultarFicha(
      d,
      {
        pedir: o.pedir ?? ((url, init) => fetch(url, init)),
        activos,
        ...(token ? { token } : {}),
        ...(o.senal ? { senal: o.senal } : {}),
      },
      ahora,
    );
    if (!ficha) return { estado: 'inactivo', dominios: dominiosDe(d) };
    const guardado = await espacio.repositorio.actualizarElemento(refOId, (el) => conFicha(el, ficha, ahora()));
    return guardado.ok ? { estado: 'hecho', ficha } : { estado: 'fallo', codigo: 'fallo' };
  } catch (e) {
    if (e instanceof FalloConsulta)
      return { estado: 'fallo', codigo: e.codigo, ...(e.hasta ? { hasta: e.hasta } : {}) };
    throw e;
  }
}

/** Activa estos dominios en los ajustes del espacio (los que ya estaban, se quedan). */
export function activarDominios(espacio: EspacioEnriquecible, dominios: readonly string[]): Promise<void> {
  return espacio.guardarAjustes((a) => ({
    ...a,
    red: { ...a.red, dominios: [...new Set([...a.red.dominios, ...dominios])] },
  }));
}
