/**
 * Cola de escrituras: serializa las operaciones de cada ruta y agrupa escrituras seguidas del mismo archivo
 * (si llegan varias mientras una está en curso, solo se escribe la última y todas terminan con ella).
 */
import type { Almacen, EntradaAlmacen } from './contrato';

interface Pendiente {
  datos: Uint8Array;
  esperan: { ok: () => void; ko: (e: unknown) => void }[];
}

export class ColaEscrituras implements Almacen {
  /** Última operación encadenada de cada ruta. */
  private readonly colas = new Map<string, Promise<void>>();
  /** Escritura que aún no ha empezado, por ruta: la siguiente que llegue la sustituye. */
  private readonly pendientes = new Map<string, Pendiente>();

  constructor(private readonly base: Almacen) {}

  private encadenar(ruta: string, op: () => Promise<void>): Promise<void> {
    const anterior = this.colas.get(ruta) ?? Promise.resolve();
    const siguiente = anterior.catch(() => undefined).then(op);
    const guardada = siguiente.catch(() => undefined);
    this.colas.set(ruta, guardada);
    void guardada.then(() => {
      if (this.colas.get(ruta) === guardada) this.colas.delete(ruta);
    });
    return siguiente;
  }

  /** Espera a que terminen las operaciones en curso de unas rutas. */
  async esperar(...rutas: string[]): Promise<void> {
    await Promise.all(rutas.map((r) => this.colas.get(r)));
  }

  escribir(ruta: string, datos: Uint8Array): Promise<void> {
    const pendiente = this.pendientes.get(ruta);
    if (pendiente) {
      pendiente.datos = datos;
      return new Promise((ok, ko) => pendiente.esperan.push({ ok, ko }));
    }
    const nueva: Pendiente = { datos, esperan: [] };
    this.pendientes.set(ruta, nueva);
    return new Promise((ok, ko) => {
      nueva.esperan.push({ ok, ko });
      this.encadenar(ruta, async () => {
        this.pendientes.delete(ruta);
        try {
          await this.base.escribir(ruta, nueva.datos);
          for (const e of nueva.esperan) e.ok();
        } catch (error) {
          for (const e of nueva.esperan) e.ko(error);
          throw error;
        }
      }).catch(() => undefined);
    });
  }

  async leer(ruta: string): Promise<Uint8Array | null> {
    const pendiente = this.pendientes.get(ruta);
    if (pendiente) return pendiente.datos.slice();
    await this.colas.get(ruta);
    return this.base.leer(ruta);
  }

  mover(de: string, a: string): Promise<void> {
    return this.encadenar(de, async () => {
      await this.esperar(a);
      await this.base.mover(de, a);
    });
  }

  borrar(ruta: string): Promise<void> {
    return this.encadenar(ruta, () => this.base.borrar(ruta));
  }

  async *listar(prefijo: string): AsyncIterable<EntradaAlmacen> {
    await Promise.all(this.colas.values());
    yield* this.base.listar(prefijo);
  }

  async existe(ruta: string): Promise<boolean> {
    if (this.pendientes.has(ruta)) return true;
    await this.colas.get(ruta);
    return this.base.existe(ruta);
  }
}
