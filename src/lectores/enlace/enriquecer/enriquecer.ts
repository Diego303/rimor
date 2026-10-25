/**
 * La ficha de un enlace (IN-041): qué proveedor le toca, qué dominios consultaría, la consulta y los cambios entre
 * dos fichas. TS puro; se carga al consultar (no pesa en la carga inicial).
 */
import type { DatosEnlace } from '../lector';
import type { CamposFicha, Consulta, Enriquecedor, Ficha } from './contrato';
import { github, gitlab } from './forjas';
import { arxiv, crossref } from './papers';
import { paquete } from './paquetes';

export const ENRIQUECEDORES: readonly Enriquecedor[] = [github, gitlab, paquete, crossref, arxiv];

export const enriquecedorDe = (d: DatosEnlace): Enriquecedor | undefined => ENRIQUECEDORES.find((e) => e.acepta(d));

/** Los dominios que se consultarían para este enlace (vacío si no se puede enriquecer). */
export const dominiosDe = (d: DatosEnlace): string[] => enriquecedorDe(d)?.dominios(d) ?? [];

/** Se puede consultar si su dominio imprescindible (el primero) está activado. */
export function sePuedeConsultar(d: DatosEnlace, activos: ReadonlySet<string>): boolean {
  const principal = dominiosDe(d)[0];
  return principal !== undefined && activos.has(principal);
}

/** Consulta su proveedor y devuelve la ficha (o lanza `FalloConsulta`). `null` si no hay proveedor o no se puede. */
export async function consultarFicha(d: DatosEnlace, c: Consulta, ahora: () => string): Promise<Ficha | null> {
  const e = enriquecedorDe(d);
  if (!e || !sePuedeConsultar(d, c.activos)) return null;
  const campos = await e.consultar(d, c);
  return { fuente: e.id, consultada: ahora(), campos };
}

export interface CambioFicha {
  campo: string;
  antes?: CamposFicha[string];
  despues?: CamposFicha[string];
}

/** Lo que cambió de una ficha a la siguiente, en el orden de la nueva (y lo que desapareció, al final). */
export function cambiosDeFicha(anterior: CamposFicha, nueva: CamposFicha): CambioFicha[] {
  const claves = [...new Set([...Object.keys(nueva), ...Object.keys(anterior)])];
  return claves
    .filter((campo) => anterior[campo] !== nueva[campo])
    .map((campo) => ({
      campo,
      ...(campo in anterior ? { antes: anterior[campo] } : {}),
      ...(campo in nueva ? { despues: nueva[campo] } : {}),
    }));
}
