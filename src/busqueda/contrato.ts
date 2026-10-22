/**
 * Lo que comparten el índice de búsqueda (en el Worker) y quien lo usa (IN-032): los documentos, los aciertos, la
 * interfaz asíncrona y la clave de lo indexado. Sin MiniSearch: esto sí va en la carga inicial.
 */

/** Sin acentos ni mayúsculas, para comparar. */
export const normalizarBusqueda = (s: string): string => s.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase();

/** Lo que se indexa del cuerpo y de lo derivado (F0-8). */
export const MAX_INDEXADO = 4096;

export interface DocumentoBusqueda {
  id: string;
  titulo: string;
  ref: string;
  etiquetas: string;
  notas: string;
  cuerpo: string;
  indexable: string;
}

/** Un documento con la clave de lo que se indexó (ver `claveIndice`). */
export interface Indexado {
  doc: DocumentoBusqueda;
  clave: string;
}

export interface Acierto {
  id: string;
  puntuacion: number;
  /** Las palabras del índice que casan (para resaltar). */
  terminos: string[];
  /** Casa solo dentro del contenido (cuerpo, notas o lo derivado), no en el título, la ref ni las etiquetas. */
  enContenido: boolean;
}

/** Recorta lo indexado de un campo largo. */
export const recortar = (s: string): string => (s.length > MAX_INDEXADO ? s.slice(0, MAX_INDEXADO) : s);

/** Lo que se usa del índice, igual en el Worker que en el hilo principal (todo asíncrono). */
export interface ApiIndice {
  /** Carga uno guardado; `false` si no valía (queda vacío). */
  cargar(json: string): Promise<boolean>;
  claves(): Promise<[string, string][]>;
  poner(lista: Indexado[]): Promise<void>;
  quitar(ids: string[]): Promise<void>;
  buscar(palabras: string[], sin?: string[]): Promise<Acierto[]>;
  conPalabras(palabras: string[]): Promise<string[]>;
  exportar(): Promise<string>;
}

/** Hash corto (FNV-1a de 32 bits) para la clave. */
function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * La clave de lo que se indexa de un elemento: cambia si cambia el original (`hash`), una edición (`modificado`),
 * el lector que lo deriva o lo que se indexa del frontmatter (título, ref, etiquetas). No cambia por moverlo de
 * colección (los filtros van sobre el frontmatter del momento). `lector` es el vigente en el registro
 * (`nombre@version`): un lector nuevo cambia lo derivado aunque el frontmatter aún diga la versión anterior.
 */
export function claveIndice(
  fm: {
    modificado: string;
    hash: string;
    ref: string;
    titulo: string;
    etiquetas?: readonly string[] | undefined;
    lector: { nombre: string; version: number };
  },
  lector = `${fm.lector.nombre}@${fm.lector.version}`,
): string {
  return fnv([fm.modificado, fm.hash, lector, fm.ref, fm.titulo, ...(fm.etiquetas ?? [])].join('\u0000'));
}
