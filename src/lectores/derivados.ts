/**
 * Cola de derivados (IN-012): calcula lo que cada lector deriva de un elemento, de uno en uno (el Worker es uno),
 * primero lo visible, sin repetir trabajo (caché de IN-006 y trabajos compartidos) y con cancelación. TS puro.
 */
import type { Elemento } from '@rimor/formato';
import type { Lector } from './contrato';
import type { Registro } from './registro';

export type Prioridad = 'visible' | 'fondo';

/** Quien hace el cálculo: el Worker de derivados o, sin él, el hilo principal. */
export type Ejecutor = (nombre: string, el: Elemento) => Promise<unknown>;

/** Lo que la cola usa de `CacheEspacio`. */
export interface CacheDerivados {
  derivado<D>(id: string, lector: string, version: number, hash: string): Promise<D | undefined>;
  guardarDerivado(id: string, lector: string, version: number, hash: string, datos: unknown): Promise<void>;
}

export interface OpcionesCola {
  registro: Registro;
  ejecutar: Ejecutor;
  cache?: CacheDerivados;
  /**
   * Con los datos de cada trabajo, calculados o sacados de la caché: para poner al día el resumen del frontmatter
   * (otra pestaña pudo calcularlos, o la escritura anterior pudo fallar).
   */
  alDerivar?: (el: Elemento, lector: Lector, datos: unknown) => void;
  /** Plazo de un cálculo; al agotarse, quien espera recibe `derivados.tiempoAgotado` y la cola sigue. */
  plazoMs?: number;
  /** Se llama al agotarse un plazo: el ejecutor puede terminar el Worker atascado. */
  alAgotarPlazo?: () => void;
}

/** Plazo por defecto de un cálculo: un log de 50.000 líneas debe tardar menos de 2 s (plan §14.7). */
export const PLAZO_DERIVAR_MS = 60_000;

export interface OpcionesPedir {
  prioridad?: Prioridad;
  senal?: AbortSignal;
}

interface Peticion {
  prioridad: Prioridad;
  resolver(d: unknown): void;
  rechazar(e: unknown): void;
}

interface Trabajo {
  clave: string;
  el: Elemento;
  lector: Lector;
  prioridad: Prioridad;
  fase: 'consultando' | 'en-cola' | 'en-marcha';
  esperando: Set<Peticion>;
}

/** Error de una petición cancelada (como el de `fetch`). */
export function errorCancelado(): Error {
  return new DOMException('Cancelado', 'AbortError');
}

export const esCancelado = (e: unknown): boolean => e instanceof Error && e.name === 'AbortError';

export class ColaDerivados {
  private readonly trabajos = new Map<string, Trabajo>();
  private readonly cola: Trabajo[] = [];
  private ocupada = false;

  constructor(private readonly opciones: OpcionesCola) {}

  /** Trabajos pendientes o en marcha (para pruebas y diagnósticos). */
  get pendientes(): number {
    return this.trabajos.size;
  }

  /**
   * Derivados de `el` con la versión vigente de su lector. Si una petición visible llega a un trabajo de fondo,
   * lo adelanta. Cancelar (`senal`) solo rechaza esta petición; el trabajo sale de la cola si ya nadie lo espera.
   */
  pedir<D>(el: Elemento, { prioridad = 'fondo', senal }: OpcionesPedir = {}): Promise<D> {
    const lector = this.opciones.registro.paraElemento(el);
    if (!lector) return Promise.reject(new Error(`lector.desconocido: ${el.frontmatter.lector.nombre}`));
    if (senal?.aborted) return Promise.reject(errorCancelado());
    const fm = el.frontmatter;
    const clave = `${fm.id}|${lector.nombre}|${lector.version}|${fm.hash}`;

    return new Promise<D>((resolver, rechazar) => {
      const peticion: Peticion = { prioridad, resolver: resolver as (d: unknown) => void, rechazar };
      let trabajo = this.trabajos.get(clave);
      if (!trabajo) {
        trabajo = { clave, el, lector, prioridad, fase: 'consultando', esperando: new Set() };
        this.trabajos.set(clave, trabajo);
        void this.consultar(trabajo);
      } else if (prioridad === 'visible') trabajo.prioridad = 'visible';
      trabajo.esperando.add(peticion);

      const t = trabajo;
      senal?.addEventListener(
        'abort',
        () => {
          if (!t.esperando.delete(peticion)) return;
          rechazar(errorCancelado());
          if (t.esperando.size === 0 && t.fase !== 'en-marcha') this.descartar(t);
          // Si ya nadie lo quiere ver, vuelve a ser de fondo.
          else if (![...t.esperando].some((p) => p.prioridad === 'visible')) t.prioridad = 'fondo';
        },
        { once: true },
      );
    });
  }

  /** Primero la caché; si no está, a la cola. */
  private async consultar(t: Trabajo): Promise<void> {
    const fm = t.el.frontmatter;
    let guardado: unknown;
    try {
      guardado = await this.opciones.cache?.derivado(fm.id, t.lector.nombre, t.lector.version, fm.hash);
    } catch {
      guardado = undefined; // Una caché que falla equivale a no tenerlo: se calcula.
    }
    if (this.trabajos.get(t.clave) !== t) return; // Cancelado mientras se consultaba.
    if (guardado !== undefined) {
      this.avisarDerivado(t, guardado);
      return this.terminar(t, (p) => p.resolver(guardado));
    }
    t.fase = 'en-cola';
    this.cola.push(t);
    this.siguiente();
  }

  private siguiente(): void {
    if (this.ocupada || !this.cola.length) return;
    const i = Math.max(
      0,
      this.cola.findIndex((t) => t.prioridad === 'visible'),
    );
    const [t] = this.cola.splice(i, 1);
    if (t) void this.ejecutar(t);
  }

  private async ejecutar(t: Trabajo): Promise<void> {
    this.ocupada = true;
    t.fase = 'en-marcha';
    const fm = t.el.frontmatter;
    let tiempo: ReturnType<typeof setTimeout> | undefined;
    try {
      // Un cálculo que no termina (bucle, Worker atascado) no puede dejar la cola parada para siempre.
      const plazo = new Promise<never>((_, ko) => {
        tiempo = setTimeout(() => {
          this.opciones.alAgotarPlazo?.();
          ko(new Error('derivados.tiempoAgotado'));
        }, this.opciones.plazoMs ?? PLAZO_DERIVAR_MS);
      });
      const datos = await Promise.race([this.opciones.ejecutar(t.lector.nombre, t.el), plazo]);
      // Aunque ya nadie lo espere, el resultado vale para la próxima vez.
      await this.opciones.cache
        ?.guardarDerivado(fm.id, t.lector.nombre, t.lector.version, fm.hash, datos)
        .catch(() => undefined);
      this.avisarDerivado(t, datos);
      this.terminar(t, (p) => p.resolver(datos));
    } catch (e) {
      this.terminar(t, (p) => p.rechazar(e));
    } finally {
      clearTimeout(tiempo);
      this.ocupada = false;
      this.siguiente();
    }
  }

  private avisarDerivado(t: Trabajo, datos: unknown): void {
    try {
      this.opciones.alDerivar?.(t.el, t.lector, datos);
    } catch {
      // Un fallo al poner al día el frontmatter no invalida los datos.
    }
  }

  private terminar(t: Trabajo, avisar: (p: Peticion) => void): void {
    if (this.trabajos.get(t.clave) === t) this.trabajos.delete(t.clave);
    for (const p of t.esperando) avisar(p);
    t.esperando.clear();
  }

  private descartar(t: Trabajo): void {
    this.trabajos.delete(t.clave);
    const i = this.cola.indexOf(t);
    if (i >= 0) this.cola.splice(i, 1);
  }
}
