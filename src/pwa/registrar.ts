/**
 * Registro del service worker (IN-050) y aviso de versión nueva. Una versión que se instala con la app ya controlada
 * por otra se queda esperando y `useActualizacion` lo dice; `actualizar()` le pide que entre y recarga cuando entra.
 * Si entra porque la pidió otra pestaña, esta se queda con el código viejo bajo el service worker nuevo (que ya borró
 * los trozos viejos): también lo dice, y «Actualizar» solo recarga. Se buscan versiones al volver a la pestaña y cada
 * hora (con el enrutado por hash, la app abierta no navega nunca). Sin `workbox-window`; el contenedor va inyectado.
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
  update(): Promise<unknown>;
}

/** Lo que se usa de `navigator.serviceWorker`. */
export interface Contenedor {
  readonly controller: unknown;
  register(url: string, opciones: { scope: string }): Promise<Registro>;
  addEventListener(tipo: 'controllerchange', oyente: () => void): void;
}

interface EstadoActualizacion {
  /** La versión nueva que espera a que se pida. */
  esperando: Trabajador | null;
  /** Ya entró otra versión (la pidió otra pestaña): solo falta recargar. */
  cambiada: boolean;
  /** Se pidió desde esta pestaña: al entrar, se recarga. */
  pedida: boolean;
}

export const ESTADO_INICIAL: EstadoActualizacion = { esperando: null, cambiada: false, pedida: false };
export const useActualizacion = create<EstadoActualizacion>(() => ESTADO_INICIAL);

/** Cada cuánto se pregunta si hay una versión nueva. */
export const CADA_MS = 60 * 60 * 1000;

let recargarAhora: () => void = () => location.reload();

export interface OpcionesRegistro {
  recargar?: () => void;
  /** Para buscar versiones nuevas: al volver a la pestaña y cada `CADA_MS`. */
  documento?: Pick<Document, 'addEventListener' | 'visibilityState'>;
  cada?: (fn: () => void, ms: number) => unknown;
}

/**
 * Registra `sw.js` bajo la `BASE`. Avisa si ya hay una versión esperando, si hay una instalándose o cuando termina de
 * instalarse una nueva (solo si la app ya estaba controlada: la primera instalación no es una versión nueva).
 */
export async function registrar(
  contenedor: Contenedor | undefined,
  base: string,
  { recargar = () => location.reload(), documento, cada }: OpcionesRegistro = {},
): Promise<boolean> {
  if (!contenedor) return false;
  recargarAhora = recargar;
  let registro: Registro;
  try {
    registro = await contenedor.register(`${base}sw.js`, { scope: base });
  } catch {
    return false; // Sin service worker la app funciona igual (con red).
  }
  const controladaAlEmpezar = Boolean(contenedor.controller);
  const vigilar = (t: Trabajador | null) => {
    if (!t) return;
    const ver = () => {
      if (t.state === 'installed' && contenedor.controller) useActualizacion.setState({ esperando: t });
    };
    ver();
    t.addEventListener('statechange', ver);
  };
  vigilar(registro.waiting);
  // Una que ya se estaba instalando al registrar: su `updatefound` ya pasó.
  vigilar(registro.installing);
  registro.addEventListener('updatefound', () => vigilar(registro.installing));
  contenedor.addEventListener('controllerchange', () => {
    const { pedida } = useActualizacion.getState();
    if (pedida) {
      useActualizacion.setState(ESTADO_INICIAL);
      recargar();
    } else if (controladaAlEmpezar) {
      // La pidió otra pestaña: el código de esta es el viejo.
      useActualizacion.setState({ esperando: null, cambiada: true });
    }
  });
  const buscar = () => void registro.update().catch(() => undefined);
  documento?.addEventListener('visibilitychange', () => {
    if (documento.visibilityState === 'visible') buscar();
  });
  cada?.(buscar, CADA_MS);
  return true;
}

/** Que entre la versión que espera (la app se recarga al entrar); si ya entró otra, recargar y ya. */
export function actualizar(): void {
  const { esperando, cambiada } = useActualizacion.getState();
  if (cambiada || (esperando && (esperando.state === 'activated' || esperando.state === 'redundant'))) {
    useActualizacion.setState(ESTADO_INICIAL);
    recargarAhora();
    return;
  }
  if (!esperando) return;
  useActualizacion.setState({ esperando: null, pedida: true });
  esperando.postMessage({ tipo: 'SALTAR_ESPERA' });
}

/** En producción, con service workers: el de la app. Devuelve si lo intentó. */
export function registrarServiceWorker(produccion: boolean = import.meta.env.PROD): boolean {
  if (!produccion || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  void registrar(navigator.serviceWorker as unknown as Contenedor, base, {
    documento: document,
    cada: (fn, ms) => setInterval(fn, ms),
  });
  return true;
}
