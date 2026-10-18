/**
 * Detector de tipo (CAP-04, IN-013): atajos del Anexo D para binarios y enlaces y, si no, cada lector puntúa y
 * gana el mayor por encima del umbral; si el segundo queda cerca, se duda entre los dos; si nadie convence, Texto.
 * TS puro: no conoce ningún lector concreto, solo el registro.
 */
import type { TipoElemento } from '@rimor/formato';
import type { Entrada } from '../lectores/contrato';
import type { Registro } from '../lectores/registro';
import { esImagen, firmaDe } from './firmas';

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
  /** Primeros bytes del archivo (ver `BYTES_FIRMA`), para reconocer binarios por su firma. */
  cabecera?: Uint8Array;
}

const URL_SOLA = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const DOI_SOLO = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i;

/** ¿Es el texto entero una URL o un DOI? */
export function esEnlaceCompleto(texto: string): boolean {
  const t = texto.trim();
  return t !== '' && (URL_SOLA.test(t) || DOI_SOLO.test(t));
}

/** Tipo binario por firma (que manda) o por MIME; `null` si no es un binario reconocible como tal. */
function tipoBinario(entrada: Entrada, cabecera: Uint8Array | undefined): TipoElemento | null {
  const firma = cabecera ? firmaDe(cabecera) : null;
  if (esImagen(firma)) return 'imagen';
  if (firma === 'pdf') return 'pdf';
  if (firma) return 'archivo';
  const mime = (entrada.mime ?? entrada.archivos?.[0]?.type ?? '').toLowerCase();
  if (mime.startsWith('image/')) return 'imagen';
  if (mime === 'application/pdf') return 'pdf';
  // Un archivo que no es texto (ni por MIME ni por su nombre) va al lector genérico.
  if (entrada.archivos?.length && mime && !mime.startsWith('text/') && !/(json|xml|yaml|csv|javascript)/.test(mime))
    return 'archivo';
  return null;
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

  // Atajos: solo si el lector de ese tipo existe; si no, decide el arbitraje.
  const binario = tipoBinario(entrada, cabecera);
  const atajo = binario ?? (entrada.texto !== undefined && esEnlaceCompleto(entrada.texto) ? 'enlace' : null);
  const lectorAtajo = atajo ? lectorDe(atajo) : null;
  if (atajo && lectorAtajo) return { tipo: atajo, lector: lectorAtajo, confianza: 1, via: 'atajo', puntuaciones };

  const [primero, segundo] = puntuaciones;
  if (primero && primero.confianza > umbral) {
    // Redondeada para que 0,70 − 0,55 cuente como 0,15 y no como 0,1499…
    const distancia = segundo ? Math.round((primero.confianza - segundo.confianza) * 1e9) / 1e9 : 1;
    const duda = segundo && segundo.confianza > 0 && distancia < margen;
    return { ...primero, via: 'arbitraje', ...(duda ? { alternativa: segundo } : {}), puntuaciones };
  }
  return { tipo: 'texto', lector: lectorDe('texto'), confianza: 0, via: 'por-defecto', puntuaciones };
}
