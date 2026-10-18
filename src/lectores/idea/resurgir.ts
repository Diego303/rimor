/**
 * Resurgimiento mínimo de ideas (ORG-13 parcial, incoherencia 1): una idea en semilla vuelve al feed a los 7
 * días y, si se pospone, a los 30. Días de calendario en la zona del usuario: vuelve al empezar ese día (un
 * cambio de hora no la adelanta ni la retrasa). Puro: el reloj y los frontmatters llegan de fuera.
 */
import { type FrontmatterComun, isoConZona } from '@rimor/formato';

export const DIAS_PRIMERA_VUELTA = 7;
export const DIAS_AL_POSPONER = 30;

/** El comienzo (00:00, hora local) del día que cae `dias` días de calendario después de `fecha`. */
export function inicioDelDia(fecha: Date, dias = 0): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias);
}

/** Días de calendario entre dos fechas (hora local). */
export function diasEntre(desde: Date, hasta: Date): number {
  // Por fechas locales a mediodía: ni los cambios de hora ni la hora del día cuentan.
  const a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / 86_400_000);
}

/** Una idea sin estado (importada, editada a mano) se trata como semilla, igual que la pinta su vista. */
export const estadoDe = (fm: FrontmatterComun): string => fm.estado ?? 'semilla';

/** Cuándo vuelve: lo que diga `vuelve` (si se pospuso) o el séptimo día de calendario tras guardarla. */
export function cuandoVuelve(fm: FrontmatterComun): number {
  const pospuesta = typeof fm.vuelve === 'string' ? Date.parse(fm.vuelve) : Number.NaN;
  if (Number.isFinite(pospuesta)) return pospuesta;
  const creado = new Date(fm.creado);
  return Number.isNaN(creado.getTime()) ? Number.NaN : inicioDelDia(creado, DIAS_PRIMERA_VUELTA).getTime();
}

/** Ideas en semilla cuya vuelta ya llegó, de la más antigua a la más nueva. */
export function vuelven(elementos: readonly FrontmatterComun[], ahora: Date): FrontmatterComun[] {
  return elementos
    .filter((fm) => fm.tipo === 'idea' && estadoDe(fm) === 'semilla' && cuandoVuelve(fm) <= ahora.getTime())
    .sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
}

/** Cuándo vuelve la próxima idea que aún no ha vuelto (para despertar a esa hora), o `null`. */
export function proximaVuelta(elementos: readonly FrontmatterComun[], ahora: Date): number | null {
  let proxima: number | null = null;
  for (const fm of elementos) {
    if (fm.tipo !== 'idea' || estadoDe(fm) !== 'semilla') continue;
    const t = cuandoVuelve(fm);
    if (t > ahora.getTime() && (proxima === null || t < proxima)) proxima = t;
  }
  return proxima;
}

/** «Más adelante»: vuelve el trigésimo día de calendario a partir de hoy. */
export const posponer = (fm: FrontmatterComun, ahora: Date): FrontmatterComun => ({
  ...fm,
  vuelve: isoConZona(inicioDelDia(ahora, DIAS_AL_POSPONER)),
  modificado: isoConZona(ahora),
});

/** «Descartar»: deja de volver. */
export function descartar(fm: FrontmatterComun, ahora: Date): FrontmatterComun {
  const { vuelve: _vuelve, ...resto } = fm;
  return { ...resto, estado: 'descartada', modificado: isoConZona(ahora) } as FrontmatterComun;
}

/** Días de calendario desde que se guardó. */
export const diasDesde = (fm: FrontmatterComun, ahora: Date): number =>
  Math.max(0, diasEntre(new Date(fm.creado), ahora));
