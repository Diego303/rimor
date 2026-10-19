/**
 * Comparación de dos logs (CMP-01, pantalla «Comparación de logs»): dónde se separa la ejecución que se investiga
 * («la mala») de la de referencia («la buena») y qué mensajes aparecen, faltan o cambian de frecuencia, ignorando
 * fechas, IDs y números (por plantilla). Sale de los derivados del lector Log: la plantilla de cada línea y los
 * recuentos. TS puro y lineal en líneas.
 */
import type { DatosLog } from '../lectores/log/analisis';

/** Cambia de frecuencia si una aparece al menos el doble (o la mitad) de veces que en la otra. */
export const FACTOR_FRECUENCIA = 2;

export interface CambioFrecuencia {
  plantilla: string;
  a: number;
  b: number;
}

export interface ComparacionLogs {
  /**
   * Índice (desde 0) de la primera línea cuya plantilla difiere, o en la que una de las dos se acaba; `null` si
   * siguen el mismo camino de principio a fin.
   */
  divergencia: number | null;
  /** Plantillas que solo están en B (la mala), en el orden en que aparecen. */
  nuevos: string[];
  /** Plantillas de A (la buena) que faltan en B, en el orden en que aparecen. */
  ausentes: string[];
  /** Plantillas de las dos cuya frecuencia cambia al doble o a la mitad, en el orden en que aparecen en B. */
  cambian: CambioFrecuencia[];
  lineas: { a: number; b: number };
}

/** La plantilla de cada línea ('' en las vacías), sin las líneas vacías del final. */
function secuencia(d: DatosLog): string[] {
  const s = d.lineaPlantilla.map((k) => (k >= 0 ? (d.plantillas[k]?.plantilla ?? '') : ''));
  let fin = s.length;
  while (fin > 0 && s[fin - 1] === '') fin--;
  return s.slice(0, fin);
}

/** Recuento por plantilla, en el orden en que aparece cada una. */
function recuentos(sec: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of sec) if (p) m.set(p, (m.get(p) ?? 0) + 1);
  return m;
}

export function compararLogs(a: DatosLog, b: DatosLog): ComparacionLogs {
  const sa = secuencia(a);
  const sb = secuencia(b);
  let i = 0;
  const comun = Math.min(sa.length, sb.length);
  while (i < comun && sa[i] === sb[i]) i++;
  const ca = recuentos(sa);
  const cb = recuentos(sb);
  const cambian: CambioFrecuencia[] = [];
  for (const [plantilla, nb] of cb) {
    const na = ca.get(plantilla);
    if (na && (nb / na >= FACTOR_FRECUENCIA || nb / na <= 1 / FACTOR_FRECUENCIA))
      cambian.push({ plantilla, a: na, b: nb });
  }
  return {
    divergencia: i === sa.length && i === sb.length ? null : i,
    nuevos: [...cb.keys()].filter((p) => !ca.has(p)),
    ausentes: [...ca.keys()].filter((p) => !cb.has(p)),
    cambian,
    lineas: { a: sa.length, b: sb.length },
  };
}
