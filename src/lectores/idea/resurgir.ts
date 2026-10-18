/**
 * Resurgimiento mínimo de ideas (ORG-13 parcial, incoherencia 1): una idea en semilla vuelve al feed a los 7
 * días y, si se pospone, a los 30. Puro: el reloj y los frontmatters llegan de fuera.
 */
import { type FrontmatterComun, isoConZona } from '@rimor/formato';

export const DIAS_PRIMERA_VUELTA = 7;
export const DIAS_AL_POSPONER = 30;
const DIA = 86_400_000;

/** `ahora` más `dias` días, con la zona del usuario. */
export const dentroDe = (ahora: Date, dias: number): string => isoConZona(new Date(ahora.getTime() + dias * DIA));

/** Cuándo vuelve una idea: lo que diga `vuelve` (si se pospuso) o 7 días después de guardarla. */
export function cuandoVuelve(fm: FrontmatterComun): number {
  const pospuesta = typeof fm.vuelve === 'string' ? Date.parse(fm.vuelve) : Number.NaN;
  return Number.isFinite(pospuesta) ? pospuesta : Date.parse(fm.creado) + DIAS_PRIMERA_VUELTA * DIA;
}

/** Ideas en semilla cuya vuelta ya llegó, de la más antigua a la más nueva. */
export function vuelven(elementos: readonly FrontmatterComun[], ahora: Date): FrontmatterComun[] {
  return elementos
    .filter((fm) => fm.tipo === 'idea' && fm.estado === 'semilla' && cuandoVuelve(fm) <= ahora.getTime())
    .sort((a, b) => a.creado.localeCompare(b.creado));
}

/** «Más adelante»: vuelve dentro de 30 días. */
export const posponer = (fm: FrontmatterComun, ahora: Date): FrontmatterComun => ({
  ...fm,
  vuelve: dentroDe(ahora, DIAS_AL_POSPONER),
});

/** «Descartar»: deja de volver. */
export function descartar(fm: FrontmatterComun): FrontmatterComun {
  const { vuelve: _vuelve, ...resto } = fm;
  return { ...resto, estado: 'descartada' } as FrontmatterComun;
}

/** Días enteros desde que se guardó. */
export const diasDesde = (fm: FrontmatterComun, ahora: Date): number =>
  Math.max(0, Math.floor((ahora.getTime() - Date.parse(fm.creado)) / DIA));
