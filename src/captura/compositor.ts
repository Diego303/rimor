/**
 * Borrador del compositor (IN-014, IN-015): lo pegado fuera de un campo de texto llega aquí, no se guarda
 * directamente. El compositor de Inicio lo pinta, lo edita y lo guarda con el capturador. El texto sobrevive a
 * una recarga en `sessionStorage`.
 */
import { create } from 'zustand';
import type { VersionCapturada } from './flujo';

export const CLAVE_BORRADOR = 'rimor:borrador';

/** Una búsqueda `?texto` hecha desde el compositor, que el feed pinta como mensaje (IN-026, IN-032). */
export interface BusquedaPendiente {
  texto: string;
  en: string;
}

/** Una captura que se guardó como versión nueva (IN-029), que el feed pinta como mensaje en su momento. */
export interface VersionEnFeed extends VersionCapturada {
  en: string;
}

export interface Borrador {
  texto: string;
  archivos: File[];
  /** Ref del elemento al que se responde (modo respuesta, IN-030). */
  respondiendoA: string | null;
  busquedas: BusquedaPendiente[];
  versiones: VersionEnFeed[];
  /** Sube cada vez que algo llega de fuera o se pide el foco: el compositor se enfoca. */
  llegadas: number;
  /** Las llegadas que el compositor ya atendió (al montarse, solo enfoca si hay alguna nueva). */
  atendidas: number;
  atender(): void;
  /** Añade lo pegado: el texto va tras lo que ya hubiera, en otra línea; los archivos, al final. */
  recibir(texto: string, archivos?: readonly File[]): void;
  adjuntar(archivos: readonly File[]): void;
  setTexto(texto: string): void;
  quitarArchivo(i: number): void;
  responderA(ref: string | null): void;
  anotarBusqueda(texto: string, en: string): void;
  anotarVersion(v: VersionEnFeed): void;
  /** Quita del feed la versión de esa copia (se deshizo o se guardó aparte). */
  quitarVersion(copia: string): void;
  enfocar(): void;
  /** Tras guardar: sin texto, sin archivos y sin respuesta. */
  vaciar(): void;
  /**
   * Tras guardar, quita solo lo que se guardó: el texto si no ha cambiado desde entonces (lo escrito mientras
   * se guardaba se conserva), esos archivos y la respuesta si sigue siendo la misma.
   */
  quitarGuardado(guardado: { texto?: string; archivos: readonly File[]; respondiendoA: string | null }): void;
}

function leerGuardado(): string {
  try {
    return globalThis.sessionStorage?.getItem(CLAVE_BORRADOR) ?? '';
  } catch {
    return '';
  }
}

function guardar(texto: string): void {
  try {
    if (texto) globalThis.sessionStorage?.setItem(CLAVE_BORRADOR, texto);
    else globalThis.sessionStorage?.removeItem(CLAVE_BORRADOR);
  } catch {
    // Sin sessionStorage (privado, bloqueado) o sin cuota: que no quede un borrador viejo que restaurar.
    try {
      globalThis.sessionStorage?.removeItem(CLAVE_BORRADOR);
    } catch {
      // El borrador vive solo en memoria.
    }
  }
}

export const useCompositor = create<Borrador>((set) => ({
  texto: leerGuardado(),
  archivos: [],
  respondiendoA: null,
  busquedas: [],
  versiones: [],
  llegadas: 0,
  atendidas: 0,
  atender: () => set((s) => ({ atendidas: s.llegadas })),
  recibir: (texto, archivos = []) =>
    set((s) => ({
      texto: texto ? (s.texto.trim() ? `${s.texto.replace(/\s+$/, '')}\n${texto}` : texto) : s.texto,
      archivos: [...s.archivos, ...archivos],
      llegadas: s.llegadas + 1,
    })),
  adjuntar: (archivos) => set((s) => ({ archivos: [...s.archivos, ...archivos] })),
  setTexto: (texto) => set({ texto }),
  quitarArchivo: (i) => set((s) => ({ archivos: s.archivos.filter((_, j) => j !== i) })),
  responderA: (ref) => set((s) => ({ respondiendoA: ref, llegadas: ref ? s.llegadas + 1 : s.llegadas })),
  anotarBusqueda: (texto, en) => set((s) => ({ busquedas: [...s.busquedas, { texto, en }] })),
  anotarVersion: (v) => set((s) => ({ versiones: [...s.versiones, v] })),
  quitarVersion: (copia) => set((s) => ({ versiones: s.versiones.filter((v) => v.copia !== copia) })),
  enfocar: () => set((s) => ({ llegadas: s.llegadas + 1 })),
  vaciar: () => set({ texto: '', archivos: [], respondiendoA: null }),
  quitarGuardado: (g) =>
    set((s) => ({
      texto: g.texto !== undefined && s.texto === g.texto ? '' : s.texto,
      archivos: s.archivos.filter((a) => !g.archivos.includes(a)),
      respondiendoA: s.respondiendoA === g.respondiendoA ? null : s.respondiendoA,
    })),
}));

useCompositor.subscribe((s, previo) => {
  if (s.texto !== previo.texto) guardar(s.texto);
});
