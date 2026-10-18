import { createContext, useContext, useEffect } from 'react';
import { type Atajo, GestorAtajos } from './atajos';

export const ContextoAtajos = createContext<GestorAtajos>(new GestorAtajos());

export const useGestorAtajos = () => useContext(ContextoAtajos);

/** Registra los atajos de una pantalla mientras está montada. */
export function useAtajos(ambito: string, atajos: Atajo[]): void {
  const gestor = useGestorAtajos();
  useEffect(() => gestor.registrar(ambito, atajos), [gestor, ambito, atajos]);
}
