/** Tipos e índice del lector Documento Markdown (LEC-08), sin el parser: los usan el lector y la vista. TS puro. */

export interface Tareas {
  hechas: number;
  total: number;
}

export interface Seccion {
  nivel: number;
  titulo: string;
  ancla: string;
  tareas: Tareas;
  palabras: number;
}

export interface DatosMarkdown {
  /** Todos los encabezados, en orden. */
  secciones: Seccion[];
  /** Nivel de los encabezados que forman el índice: el más alto presente (sin el título del documento). */
  nivelIndice: number;
  /** El primer encabezado es el título del documento (el único de su nivel): no es una sección del índice. */
  conTitulo: boolean;
  palabras: number;
  tareas: Tareas;
  /** URL distintas, en orden, hasta `MAX_ENLACES`. */
  enlaces: string[];
  totalEnlaces: number;
  /** Refs de Rimor mencionadas (`[[LOG-0042]]`, `DOC-MD-0004`). */
  menciones: string[];
  bloques: { total: number; lenguajes: Record<string, number> };
}

/** Una entrada del índice con lo de sus subsecciones sumado. */
export type EntradaIndice = Seccion;

/**
 * El índice: los encabezados de `nivelIndice` (o más altos); las tareas y palabras de los más profundos suman en la
 * entrada que los contiene.
 */
export function indiceDe(d: Pick<DatosMarkdown, 'secciones' | 'nivelIndice' | 'conTitulo'>): EntradaIndice[] {
  const indice: EntradaIndice[] = [];
  for (const s of d.conTitulo ? d.secciones.slice(1) : d.secciones) {
    const ultima = indice.at(-1);
    if (s.nivel <= d.nivelIndice || !ultima) indice.push({ ...s, tareas: { ...s.tareas } });
    else {
      ultima.tareas.hechas += s.tareas.hechas;
      ultima.tareas.total += s.tareas.total;
      ultima.palabras += s.palabras;
    }
  }
  return indice;
}
