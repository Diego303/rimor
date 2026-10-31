/** ¿Hay red? (`navigator.onLine` y sus eventos, IN-050): sin red, el pie del raíl lo dice. */
import { useSyncExternalStore } from 'react';

function suscribir(avisar: () => void) {
  window.addEventListener('online', avisar);
  window.addEventListener('offline', avisar);
  return () => {
    window.removeEventListener('online', avisar);
    window.removeEventListener('offline', avisar);
  };
}

const enLinea = () => navigator.onLine;

export const useEnLinea = (): boolean => useSyncExternalStore(suscribir, enLinea, () => true);
