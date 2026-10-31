/**
 * Registro del service worker (IN-050) y aviso de versión nueva: una versión que se instala con la app ya controlada
 * por otra se queda esperando y `useActualizacion` lo dice; `actualizar()` le pide que entre y recarga cuando entra.
 * Sin `workbox-window` (unas líneas propias pesan menos en la carga inicial). El contenedor va inyectado para probarlo.
 */
import { create } from 'zustand';

/** Lo que se usa de un `ServiceWorker`. */
interface Trabajador {
  readonly state: string;
  postMessage(mensaje: unknown): void;
  addEventListener(tipo: 'statechange', oyente: () => void): void;
}

/** Lo que se usa de un `ServiceWorkerRegistration`. */
interface Registro {
  readonly waiting: Trabajador | null;
  readonly installing: Trabajador | null;
  addEventListener(tipo: 'updatefound', oyente: () => void): void;
}

/** Lo que se usa de `navigator.serviceWorker`. */
export interface Contenedor {
  readonly controller: unknown;
  register(url: string, opciones: { scope: string }): Promise<Registro>;
  addEventListener(tipo: 'controllerchange', oyente: () => void): void;
}

export const useActualizacion = create<{ esperando: Trabajador | null }>(() => ({ esperando: null }));

let pedida = false;

/**
 * Registra `sw.js` bajo la `BASE`. Avisa si ya hay una versión esperando o cuando termina de instalarse una nueva (solo
 * si la app ya estaba controlada: la primera instalación no es una versión nueva).
 */
export async function registrar(
  contenedor: Contenedor | undefined,
  base: string,
  recargar: () => void = () => location.reload(),
): Promise<boolean> {
  if (!contenedor) return false;
  let registro: Registro;
  try {
    registro = await contenedor.register(`${base}sw.js`, { scope: base });
  } catch {
    return false; // Sin service worker la app funciona igual (con red).
  }
  const avisar = (t: Trabajador | null) => {
    if (t && contenedor.controller) useActualizacion.setState({ esperando: t });
  };
  avisar(registro.waiting);
  registro.addEventListener('updatefound', () => {
    const nuevo = registro.installing;
    nuevo?.addEventListener('statechange', () => {
      if (nuevo.state === 'installed') avisar(nuevo);
    });
  });
  // Entra la versión nueva que se pidió: se recarga con ella (una vez).
  contenedor.addEventListener('controllerchange', () => {
    if (!pedida) return;
    pedida = false;
    recargar();
  });
  return true;
}

/** Que entre la versión que espera (la app se recarga al entrar). */
export function actualizar(): void {
  const { esperando } = useActualizacion.getState();
  if (!esperando) return;
  pedida = true;
  useActualizacion.setState({ esperando: null });
  esperando.postMessage({ tipo: 'SALTAR_ESPERA' });
}

/** En producción, con service workers: el de la app. */
export function registrarServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  void registrar(navigator.serviceWorker as unknown as Contenedor, base);
}
