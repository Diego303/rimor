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
  const titulo = d.conTitulo ? d.secciones[0] : undefined;
  // Las tareas entre el título y la primera sección también cuentan: el título entra en el índice si las tiene,
  // para que las filas sumen lo mismo que el medidor.
  if (titulo?.tareas.total) indice.push({ ...titulo, tareas: { ...titulo.tareas } });
  for (const s of d.conTitulo ? d.secciones.slice(1) : d.secciones) {
    const ultima = indice.at(-1);
    // Un encabezado vacío (`##`) no es una entrada: lo suyo suma en la anterior.
    if ((s.nivel <= d.nivelIndice && s.titulo) || !ultima) indice.push({ ...s, tareas: { ...s.tareas } });
    else {
      ultima.tareas.hechas += s.tareas.hechas;
      ultima.tareas.total += s.tareas.total;
      ultima.palabras += s.palabras;
    }
  }
  return indice;
}
