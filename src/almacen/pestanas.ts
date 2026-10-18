/**
 * Varias pestañas con el mismo espacio: solo una escribe (Web Locks); las demás quedan en solo lectura,
 * esperan el cerrojo para pasar a escribir y reciben avisos de cambios por BroadcastChannel.
 */

export type ModoPestana = 'escritor' | 'lector';

/** Lo mínimo de `navigator.locks` que se usa (inyectable para probar). */
export interface Cerrojos {
  request(
    nombre: string,
    opciones: { ifAvailable?: boolean; signal?: AbortSignal },
    fn: (l: unknown) => Promise<unknown>,
  ): Promise<unknown>;
}

/** Lo mínimo de `BroadcastChannel`. */
export interface Canal {
  postMessage(m: unknown): void;
  addEventListener(tipo: 'message', fn: (e: { data: unknown }) => void): void;
  close(): void;
}

export interface Coordinacion {
  modo(): ModoPestana;
  /** Se llama al pasar a escritor (cuando la otra pestaña se cierra). */
  alCambiarModo(fn: (m: ModoPestana) => void): void;
  /** Avisa a las demás pestañas de que algo cambió. */
  avisarCambio(rutas: string[]): void;
  alCambiarEnOtra(fn: (rutas: string[]) => void): void;
  cerrar(): void;
}

export async function coordinarPestanas(espacioId: string, cerrojos: Cerrojos, canal: Canal): Promise<Coordinacion> {
  const nombre = `rimor:${espacioId}`;
  let modo: ModoPestana = 'lector';
  const alModo = new Set<(m: ModoPestana) => void>();
  const alCambio = new Set<(rutas: string[]) => void>();
  const parar = new AbortController();
  let liberar: () => void = () => undefined;

  /** Pasa a escribir y retiene el cerrojo hasta `cerrar()`: el cerrojo dura lo que dure esta promesa. */
  const tomar = () =>
    new Promise<void>((resolve) => {
      liberar = resolve;
      modo = 'escritor';
      for (const fn of alModo) fn(modo);
    });

  const obtenido = await new Promise<boolean>((decidir) => {
    cerrojos
      .request(nombre, { ifAvailable: true }, (cerrojo) => {
        decidir(cerrojo !== null);
        return cerrojo === null ? Promise.resolve() : tomar();
      })
      .catch(() => decidir(false));
  });

  if (!obtenido) {
    // Solo lectura; en cuanto la otra pestaña suelte el cerrojo, esta pasa a escribir.
    cerrojos.request(nombre, { signal: parar.signal }, () => tomar()).catch(() => undefined);
  }

  canal.addEventListener('message', (e) => {
    const datos = e.data as { tipo?: string; rutas?: string[] } | null;
    if (datos?.tipo === 'cambio' && Array.isArray(datos.rutas)) for (const fn of alCambio) fn(datos.rutas);
  });

  return {
    modo: () => modo,
    alCambiarModo: (fn) => void alModo.add(fn),
    avisarCambio: (rutas) => canal.postMessage({ tipo: 'cambio', rutas }),
    alCambiarEnOtra: (fn) => void alCambio.add(fn),
    cerrar: () => {
      // Tras cerrar, esta pestaña ya no escribe aunque siga viva.
      modo = 'lector';
      parar.abort();
      liberar();
      canal.close();
    },
  };
}
