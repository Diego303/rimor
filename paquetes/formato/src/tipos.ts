/** Tipos de elemento y de entidad, sus prefijos de ref (plan §13.3) y el lenguaje del bloque original. */

export const TIPOS_ELEMENTO = [
  'texto',
  'idea',
  'enlace',
  'log',
  'error',
  'mediciones',
  'prompt',
  'markdown',
  'codigo',
  'comando',
  'datos',
  'json',
  'http',
  'imagen',
  'pdf',
  'formula',
  'diagrama',
  'calculo',
  'archivo',
] as const;
export type TipoElemento = (typeof TIPOS_ELEMENTO)[number];

export const TIPOS_ENTIDAD = ['comparacion', 'investigacion', 'documento', 'hilo'] as const;
export type TipoEntidad = (typeof TIPOS_ENTIDAD)[number];

export type Tipo = TipoElemento | TipoEntidad;

export const PREFIJOS: Record<Tipo, string> = {
  texto: 'TXT',
  idea: 'IDE',
  enlace: 'URL',
  log: 'LOG',
  error: 'ERR',
  mediciones: 'MED',
  prompt: 'PRM',
  markdown: 'DOC-MD',
  codigo: 'COD',
  comando: 'CMD',
  datos: 'DAT',
  json: 'JSN',
  http: 'HTP',
  imagen: 'IMG',
  pdf: 'PDF',
  formula: 'FOR',
  diagrama: 'DIA',
  calculo: 'CAL',
  archivo: 'ARC',
  comparacion: 'CMP',
  investigacion: 'INV',
  documento: 'DOC',
  hilo: 'HIL',
};

/** Carpeta raíz de cada entidad en el espacio (plan §13.2). */
export const CARPETAS: Record<TipoEntidad | 'elemento', string> = {
  elemento: 'elementos',
  comparacion: 'comparaciones',
  investigacion: 'investigaciones',
  documento: 'documentos',
  hilo: 'hilos',
};

/** Lenguaje del bloque de código que guarda el original dentro del `.md`. */
export const LENGUAJE_ORIGINAL: Record<TipoElemento, string> = {
  texto: 'text',
  idea: 'text',
  enlace: 'url',
  log: 'log',
  error: 'text',
  mediciones: 'text',
  prompt: 'prompt',
  markdown: 'markdown',
  codigo: 'text',
  comando: 'sh',
  datos: 'csv',
  json: 'json',
  http: 'http',
  imagen: 'text',
  pdf: 'text',
  formula: 'latex',
  diagrama: 'text',
  calculo: 'text',
  archivo: 'text',
};

export const esTipoElemento = (x: unknown): x is TipoElemento => TIPOS_ELEMENTO.includes(x as TipoElemento);
