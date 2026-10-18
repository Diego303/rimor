/**
 * Detector de tipo (CAP-04, IN-013): atajos del Anexo D para binarios y enlaces y, si no, cada lector puntúa y
 * gana el mayor por encima del umbral; si el segundo queda cerca, se duda entre los dos; si nadie convence, Texto.
 * TS puro: no conoce ningún lector concreto, solo el registro.
 */
import type { TipoElemento } from '@rimor/formato';
import type { Entrada } from '../lectores/contrato';
import type { Registro } from '../lectores/registro';
import { BYTES_CABECERA, decodificarTexto, esImagen, firmaDe, pareceTexto } from './firmas';

/** Cabecera de un archivo que no es texto aunque su principio lo parezca (un byte nulo la marca como binaria). */
const NO_TEXTO = new Uint8Array([0, 0xff, 0]);

/** Confianza que hay que superar para ganar (plan §14.5). */
export const UMBRAL_DETECCION = 0.6;
/** Distancia al ganador por debajo de la cual se ofrecen los dos (el «umbral de duda» de Ajustes). */
export const MARGEN_DUDA = 0.15;

export interface Candidato {
  tipo: TipoElemento;
  /** Lector que lo leerá; `null` si ese tipo aún no tiene lector registrado. */
  lector: string | null;
  confianza: number;
}

export interface Deteccion extends Candidato {
  via: 'atajo' | 'arbitraje' | 'por-defecto';
  /** Segundo candidato cuando la diferencia es pequeña: la captura ofrece los dos. */
  alternativa?: Candidato;
  /** Todas las puntuaciones, de mayor a menor. */
  puntuaciones: Candidato[];
}

export interface OpcionesDeteccion {
  umbral?: number;
  margen?: number;
  /** Primeros bytes del archivo (`BYTES_CABECERA`): su firma y si es texto. */
  cabecera?: Uint8Array;
}

const URL_SOLA = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const DOI_SOLO = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i;

/** ¿Es el texto entero una URL o un DOI? */
export function esEnlaceCompleto(texto: string): boolean {
  const t = texto.trim();
  return t !== '' && (URL_SOLA.test(t) || DOI_SOLO.test(t));
}

const MIME_TEXTO = /^text\/|json|xml|yaml|toml|csv|javascript|typescript|x-sh|sql|markdown/;
const EXTENSION_TEXTO =
  /\.(txt|log|md|markdown|csv|tsv|json|jsonl|ya?ml|toml|xml|html?|css|m?[jt]sx?|cjs|py|rs|go|java|kt|c|h|cpp|hpp|cs|rb|php|sh|bash|zsh|sql|ini|cfg|conf|env|diff|patch|tex|bib|r|swift|lua|pl)$/i;

/**
 * Tipo binario de la entrada (`imagen`, `pdf` o `archivo`), o `null` si es texto. Manda la firma; después, el
 * MIME de imagen o PDF; un archivo cualquiera lo decide su contenido (la cabecera) y, sin ella, su MIME o su
 * extensión. Lo pegado como texto nunca es binario.
 */
function tipoBinario(entrada: Entrada, cabecera: Uint8Array | undefined): TipoElemento | null {
  const firma = cabecera ? firmaDe(cabecera) : null;
  if (esImagen(firma)) return 'imagen';
  if (firma === 'pdf') return 'pdf';
  if (firma) return 'archivo';
  const archivo = entrada.archivos?.[0];
  const mime = (entrada.mime || archivo?.type || '').toLowerCase();
  if (mime.startsWith('image/')) return 'imagen';
  if (mime === 'application/pdf') return 'pdf';
  if (!archivo && !cabecera) return null;
  if (cabecera) return pareceTexto(cabecera) ? null : 'archivo';
  const nombre = entrada.nombre || archivo?.name || '';
  return MIME_TEXTO.test(mime) || EXTENSION_TEXTO.test(nombre) ? null : 'archivo';
}

/**
 * Entrada de un archivo soltado, como la arma la captura (IN-014) y el arnés: el archivo, su cabecera y, si
 * es texto, también su texto.
 */
export function entradaDeArchivo(
  nombre: string,
  mime: string,
  bytes: Uint8Array,
): { entrada: Entrada; cabecera: Uint8Array } {
  const cabecera = bytes.subarray(0, BYTES_CABECERA);
  const archivo = new File([bytes as Uint8Array<ArrayBuffer>], nombre, { type: mime });
  const decodificado = firmaDe(cabecera) === null ? decodificarTexto(bytes) : null;
  const entrada: Entrada = { archivos: [archivo], nombre, ...(mime ? { mime } : {}) };
  if (decodificado) entrada.texto = decodificado.texto;
  // Si todo el archivo resultó no ser texto, la cabecera tampoco debe hacerlo pasar por texto.
  return { entrada, cabecera: decodificado || !pareceTexto(cabecera) ? cabecera : NO_TEXTO };
}

/** Confianza válida: un número finito entre 0 y 1; lo demás (o un lector que lanza) cuenta 0. */
function puntuar(fn: () => number): number {
  try {
    const x = fn();
    return Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0;
  } catch {
    return 0;
  }
}

export function detectar(entrada: Entrada, registro: Registro, opciones: OpcionesDeteccion = {}): Deteccion {
  const { umbral = UMBRAL_DETECCION, margen = MARGEN_DUDA, cabecera } = opciones;
  const lectorDe = (tipo: TipoElemento) => registro.lectores.find((l) => l.tipo === tipo)?.nombre ?? null;

  const puntuaciones: Candidato[] = registro.lectores
    .map((l) => ({ tipo: l.tipo, lector: l.nombre, confianza: puntuar(() => l.detectar(entrada)) }))
    // `sort` es estable: a igual confianza queda el orden del registro (Anexo D).
    .sort((a, b) => b.confianza - a.confianza);

  // Un binario nunca va al arbitraje (ni a Texto): a su lector, al genérico de archivo si no lo hay (v0.1 no
  // tiene lectores de imagen ni PDF) o, sin ninguno, sin lector.
  const binario = tipoBinario(entrada, cabecera);
  if (binario) {
    const propio = lectorDe(binario);
    const generico = propio ? null : lectorDe('archivo');
    const tipo = propio || !generico ? binario : 'archivo';
    return { tipo, lector: propio ?? generico, confianza: 1, via: 'atajo', puntuaciones };
  }
  // URL o DOI completos: solo si hay lector de enlaces; si no, decide el arbitraje.
  const enlace = entrada.texto !== undefined && esEnlaceCompleto(entrada.texto) ? lectorDe('enlace') : null;
  if (enlace) return { tipo: 'enlace', lector: enlace, confianza: 1, via: 'atajo', puntuaciones };

  const [primero, segundo] = puntuaciones;
  if (primero && primero.confianza > umbral) {
    // Redondeada para que 0,70 − 0,55 cuente como 0,15 y no como 0,1499…
    const distancia = segundo ? Math.round((primero.confianza - segundo.confianza) * 1e9) / 1e9 : 1;
    const duda = segundo && segundo.confianza > 0 && distancia < margen;
    return { ...primero, via: 'arbitraje', ...(duda ? { alternativa: segundo } : {}), puntuaciones };
  }
  return { tipo: 'texto', lector: lectorDe('texto'), confianza: 0, via: 'por-defecto', puntuaciones };
}
