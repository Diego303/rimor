/**
 * El índice de texto de la búsqueda (BUS-01, F0-8): MiniSearch con el título y la ref (×3), las etiquetas (×2), las
 * notas, el principio del cuerpo y lo que el lector deriva para buscar (`textoIndexable`); sin acentos ni
 * mayúsculas, difuso en las palabras de más de 3 letras y prefijo en la última. Guarda la clave de lo indexado de
 * cada elemento: al abrir, solo se reindexa lo que cambió. TS puro: corre en el Worker o, sin él, aquí.
 */
import MiniSearch, { type SearchResult } from 'minisearch';
import {
  type Acierto,
  type ApiIndice,
  type DocumentoBusqueda,
  type Indexado,
  normalizarBusqueda,
  recortar,
} from './contrato';

/** Versión del formato guardado: uno de otra versión se descarta y se rehace. */
export const VERSION_INDICE = 1;

const CAMPOS = ['titulo', 'ref', 'etiquetas', 'notas', 'cuerpo', 'indexable'] as const;
const DE_CONTENIDO: ReadonlySet<string> = new Set(['notas', 'cuerpo', 'indexable']);

const OPCIONES = {
  fields: [...CAMPOS],
  idField: 'id',
  processTerm: (termino: string) => normalizarBusqueda(termino) || null,
  searchOptions: {
    boost: { titulo: 3, ref: 3, etiquetas: 2 },
    combineWith: 'AND' as const,
    fuzzy: (termino: string) => (termino.length > 3 ? 0.2 : false),
    prefix: (termino: string, i: number, todos: string[]) => i === todos.length - 1 && termino.length >= 2,
  },
};

interface Guardado {
  version: number;
  claves: Record<string, string>;
  indice: unknown;
}

export class IndiceBusqueda {
  private ms = new MiniSearch<DocumentoBusqueda>(OPCIONES);
  private readonly claves = new Map<string, string>();

  /**
   * Un índice guardado con `exportar`; `null` si no se entiende o es de otra versión. Se carga por partes
   * (`loadJSAsync`): con 10.000 elementos tarda segundos, y así no bloquea el hilo en el que corre.
   */
  static async cargar(json: string): Promise<IndiceBusqueda | null> {
    try {
      const g = JSON.parse(json) as Guardado;
      if (g?.version !== VERSION_INDICE || typeof g.claves !== 'object' || !g.claves) return null;
      const indice = new IndiceBusqueda();
      indice.ms = await MiniSearch.loadJSAsync(g.indice as Parameters<typeof MiniSearch.loadJS>[0], OPCIONES);
      for (const [id, clave] of Object.entries(g.claves))
        if (typeof clave === 'string' && indice.ms.has(id)) indice.claves.set(id, clave);
      // Un documento sin clave no se sabe de cuándo es: fuera (se reindexa).
      if (indice.ms.documentCount !== indice.claves.size) return null;
      return indice;
    } catch {
      return null;
    }
  }

  exportar(): string {
    const g: Guardado = { version: VERSION_INDICE, claves: Object.fromEntries(this.claves), indice: this.ms.toJSON() };
    return JSON.stringify(g);
  }

  get tamano(): number {
    return this.claves.size;
  }

  /** La clave de lo indexado de cada elemento. */
  todasLasClaves(): [string, string][] {
    return [...this.claves];
  }

  /** Añade o reemplaza. */
  poner(lista: readonly Indexado[]): void {
    for (const { doc, clave } of lista) {
      const listo = {
        ...doc,
        cuerpo: recortar(doc.cuerpo),
        indexable: recortar(doc.indexable),
      };
      if (this.ms.has(doc.id)) this.ms.replace(listo);
      else this.ms.add(listo);
      this.claves.set(doc.id, clave);
    }
  }

  quitar(ids: readonly string[]): void {
    for (const id of ids) {
      if (!this.ms.has(id)) continue;
      this.ms.discard(id);
      this.claves.delete(id);
    }
  }

  /**
   * Todas las palabras (con difuso y prefijo), de más a menos relevante, sin los que tienen alguna de `sin` (tal
   * cual, en la misma pasada).
   */
  buscar(palabras: readonly string[], sin: readonly string[] = []): Acierto[] {
    const consulta = palabras.join(' ').trim();
    if (!consulta) return [];
    const quitar = sin.join(' ').trim();
    if (!quitar) return this.ms.search(consulta).map(acierto);
    return this.ms
      .search({
        combineWith: 'AND_NOT',
        queries: [
          { queries: [consulta], combineWith: 'AND' },
          { queries: [quitar], combineWith: 'OR', fuzzy: false, prefix: false },
        ],
      })
      .map(acierto);
  }

  /** Los que tienen todas estas palabras tal cual (sin difuso ni prefijo): para `-excluir` y las frases. */
  conPalabras(palabras: readonly string[]): string[] {
    const consulta = palabras.join(' ').trim();
    if (!consulta) return [];
    return this.ms.search(consulta, { fuzzy: false, prefix: false }).map((r) => String(r.id));
  }
}

function acierto(r: SearchResult): Acierto {
  let enContenido = false;
  fuera: for (const campos of Object.values(r.match))
    for (const c of campos) {
      enContenido = DE_CONTENIDO.has(c);
      if (!enContenido) break fuera;
    }
  return { id: String(r.id), puntuacion: r.score, terminos: r.terms, enContenido };
}

/** El índice con su interfaz asíncrona (la del Worker). */
export function apiIndice(): ApiIndice {
  let indice = new IndiceBusqueda();
  return {
    cargar: async (json) => {
      const cargado = await IndiceBusqueda.cargar(json);
      indice = cargado ?? new IndiceBusqueda();
      return cargado !== null;
    },
    claves: async () => indice.todasLasClaves(),
    poner: async (lista) => indice.poner(lista),
    quitar: async (ids) => indice.quitar(ids),
    buscar: async (palabras, sin) => indice.buscar(palabras, sin),
    conPalabras: async (palabras) => indice.conPalabras(palabras),
    exportar: async () => indice.exportar(),
  };
}
