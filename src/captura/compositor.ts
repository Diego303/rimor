/**
 * Borrador del compositor (IN-014): lo pegado fuera de un campo de texto llega aquí, no se guarda directamente.
 * El compositor de Inicio (IN-015) lo pinta, lo edita y lo guarda con el capturador.
 */
import { create } from 'zustand';

export interface Borrador {
  texto: string;
  archivos: File[];
  /** Sube cada vez que algo llega de fuera: el compositor se enfoca. */
  llegadas: number;
  /** Añade lo pegado: el texto va tras lo que ya hubiera, en otra línea; los archivos, al final. */
  recibir(texto: string, archivos?: readonly File[]): void;
  setTexto(texto: string): void;
  quitarArchivo(i: number): void;
  vaciar(): void;
}

export const useCompositor = create<Borrador>((set) => ({
  texto: '',
  archivos: [],
  llegadas: 0,
  recibir: (texto, archivos = []) =>
    set((s) => ({
      texto: texto ? (s.texto.trim() ? `${s.texto.replace(/\s+$/, '')}\n${texto}` : texto) : s.texto,
      archivos: [...s.archivos, ...archivos],
      llegadas: s.llegadas + 1,
    })),
  setTexto: (texto) => set({ texto }),
  quitarArchivo: (i) => set((s) => ({ archivos: s.archivos.filter((_, j) => j !== i) })),
  vaciar: () => set({ texto: '', archivos: [] }),
}));
