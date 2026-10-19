/**
 * Contrato de un lector (plan §14.4, IN-012). El núcleo es TS puro, para poder derivar en un Worker; la vista
 * completa y la tarjeta van aparte, en `Vista.tsx` y `Tarjeta.tsx` de la carpeta del lector (ver `vistas.ts`).
 */
import type { Elemento, FrontmatterComun, TipoElemento } from '@rimor/formato';
import type { Idioma } from '../i18n/formatos';
import type { Respuesta } from '../respuestas/tipos';
import type { TextosLector } from './textos';

/** Lo que llega al capturar: texto pegado, archivos soltados o compartidos. */
export interface Entrada {
  texto?: string;
  archivos?: File[];
  mime?: string;
  nombre?: string;
}

/** Lo pequeño que el lector deja en el frontmatter (`lector.resumen`). */
export type ResumenLector = Record<string, unknown>;

/** Lo que `leer` saca de la entrada: lo justo para guardar el elemento al instante. */
export interface Borrador {
  titulo: string;
  /** El original en texto, o `null` si va como adjunto (`archivo`). */
  original: string | null;
  /** Resumen provisional hasta que termine `derivar`. */
  resumen?: ResumenLector;
  /** Claves propias del lector para el frontmatter (p. ej. la URL de un enlace). */
  metadatos?: Record<string, unknown>;
  /** El archivo que se guarda como adjunto por su hash. */
  archivo?: File;
}

/** Una cifra que se puede citar en un documento con `{{REF.nombre}}`. */
export interface Cifra {
  /** Cómo se escribe: «38,5 ms». */
  texto: string;
  valor?: number;
  unidad?: string;
}

/** Acción propia del lector (comparar, copiar con valores…). `etiqueta` es una clave de sus textos. */
export interface AccionLector<D> {
  id: string;
  etiqueta: string;
  disponible?(d: D): boolean;
}

/** Lo que un lector ofrece para incrustar en documentos (v0.3): un gráfico, una tabla… */
export interface Incrustacion<D> {
  etiqueta: string;
  datos(d: D, parametros: Record<string, string>): unknown;
}

export interface Nota {
  ref: string;
  texto: string;
  fecha: string;
}

/** Lo que rodea a un elemento al componer su respuesta (lo rellena IN-016). */
export interface Contexto {
  idioma: Idioma;
  /** Otros elementos con la misma huella (errores repetidos). */
  mismaHuella: FrontmatterComun[];
  /** Versiones anteriores del mismo elemento. */
  versiones: FrontmatterComun[];
  /** Notas de solución relacionadas. */
  notas: Nota[];
  /** Colecciones candidatas. */
  colecciones: string[];
  /** Elemento al que responde esta captura, si es una respuesta en un hilo. */
  respondeA?: FrontmatterComun;
  /** Lo guardado en las 24 h de antes y de después (para «a la vez que ERR-0015»), del más cercano al más lejano. */
  cercanos?: FrontmatterComun[];
}

/**
 * Una cifra citable. Casi todas salen de los datos; algunas dependen de los demás elementos (las ocurrencias de
 * un error) y reciben el contexto y el propio elemento.
 */
export type FuncionCifra<D> = { metodo(d: D, ctx?: Contexto, el?: Elemento): Cifra }['metodo'];

export interface OpcionesDerivar {
  /** Cuánto lleva hecho de cuánto (en la unidad del lector: líneas, filas…). */
  alProgreso?: (hechas: number, total: number) => void;
}

export interface Lector<D = unknown> {
  /** Igual que el nombre de su carpeta y que `frontmatter.lector.nombre`. */
  nombre: string;
  /** Tipo del elemento; el prefijo de la ref sale de `PREFIJOS[tipo]`. */
  tipo: TipoElemento;
  /** Si cambia, se recalculan los derivados. */
  version: number;
  textos: TextosLector;
  /** Confianza entre 0 y 1; barata y síncrona. */
  detectar(e: Entrada): number;
  leer(e: Entrada): Promise<Borrador>;
  /**
   * Se ejecuta en el Worker de derivados: `D` debe poder copiarse con structured clone. Regenerable. Con mucho
   * trabajo (un log enorme), avisa del progreso con `alProgreso`.
   */
  derivar(el: Elemento, opciones?: OpcionesDerivar): Promise<D>;
  /** Si `derivar` avisa del progreso: solo a estos se les pasa el aviso (cruza al Worker como proxy). */
  informaProgreso?: boolean;
  resumen(d: D): ResumenLector;
  /** Una línea con el resumen del frontmatter, para enseñar mientras se deriva o en la tarjeta. */
  resumenLegible?(r: ResumenLector, idioma: Idioma): string;
  /** La frase de Rimor en Inicio (CAP-14). */
  respuesta(el: Elemento, d: D, ctx: Contexto): Respuesta;
  acciones?: AccionLector<D>[];
  cifras?: Record<string, FuncionCifra<D>>;
  incrustaciones?: Record<string, Incrustacion<D>>;
  /** Estados propios del tipo, además de los comunes (`espacio/estados.ts`): los de una idea, por ejemplo. */
  estados?: readonly string[];
  /** Contenido derivado que entra en la búsqueda. */
  textoIndexable?(d: D): string;
}

/** Props de `Vista.tsx` (export por defecto) de un lector. */
export interface PropsVista<D = unknown> {
  el: Elemento;
  datos: D;
}

/** Props de `Tarjeta.tsx` (export por defecto) de un lector. */
export interface PropsTarjeta {
  el: Elemento;
}
