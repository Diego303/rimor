/**
 * Cola de escrituras: las operaciones que cambian archivos se ejecutan de una en una y en orden de llegada,
 * así que nunca se adelantan entre sí (tampoco un `mover` con una escritura de su destino). Si llega una
 * escritura de un archivo cuya última operación en la cola es otra escritura del mismo archivo que aún no ha
 * empezado, se agrupan: solo se escribe la última y las dos terminan con ella.
 * Las lecturas esperan a que acaben las operaciones pendientes que tocan esa ruta.
 */
import type { Almacen, EntradaAlmacen } from './contrato';

type Operacion =
  | { tipo: 'escribir'; ruta: string; datos: Uint8Array }
  | { tipo: 'borrar'; ruta: string }
  | { tipo: 'mover'; de: string; a: string };

interface Encolada {
  op: Operacion;
  esperan: { ok: () => void; ko: (e: unknown) => void }[];
  hecha: Promise<void>;
}

const tocaA = (op: Operacion, ruta: string) =>
  op.tipo === 'mover' ? op.de === ruta || op.a === ruta : op.ruta === ruta;

export class ColaEscrituras implements Almacen {
  private readonly pendientes: Encolada[] = [];
  private enCurso: Encolada | null = null;

  constructor(private readonly base: Almacen) {}

  private encolar(op: Operacion): Promise<void> {
    if (op.tipo === 'escribir') {
      const ultima = [...this.pendientes].reverse().find((e) => tocaA(e.op, op.ruta));
      if (ultima && ultima.op.tipo === 'escribir') {
        ultima.op.datos = op.datos;
        return new Promise((ok, ko) => ultima.esperan.push({ ok, ko }));
      }
    }
    let resolver!: () => void;
    const hecha = new Promise<void>((r) => {
      resolver = r;
    });
    const encolada: Encolada = { op, esperan: [], hecha };
    const promesa = new Promise<void>((ok, ko) => encolada.esperan.push({ ok, ko }));
    void promesa.finally(resolver).catch(() => undefined);
    this.pendientes.push(encolada);
    if (!this.enCurso) void this.procesar();
    return promesa;
  }

  private async procesar(): Promise<void> {
    while (this.pendientes.length) {
      const e = this.pendientes.shift() as Encolada;
      this.enCurso = e;
      try {
        const { op } = e;
        if (op.tipo === 'escribir') await this.base.escribir(op.ruta, op.datos);
        else if (op.tipo === 'borrar') await this.base.borrar(op.ruta);
        else await this.base.mover(op.de, op.a);
        for (const x of e.esperan) x.ok();
      } catch (error) {
        for (const x of e.esperan) x.ko(error);
      }
    }
    this.enCurso = null;
  }

  /** Espera a que terminen las operaciones encoladas que tocan una ruta (todas, si no se da ninguna). */
  async esperar(ruta?: string): Promise<void> {
    const todas = [...(this.enCurso ? [this.enCurso] : []), ...this.pendientes];
    await Promise.all(todas.filter((e) => ruta === undefined || tocaA(e.op, ruta)).map((e) => e.hecha));
  }

  escribir(ruta: string, datos: Uint8Array): Promise<void> {
    return this.encolar({ tipo: 'escribir', ruta, datos });
  }

  borrar(ruta: string): Promise<void> {
    return this.encolar({ tipo: 'borrar', ruta });
  }

  mover(de: string, a: string): Promise<void> {
    return this.encolar({ tipo: 'mover', de, a });
  }

  async leer(ruta: string): Promise<Uint8Array | null> {
    await this.esperar(ruta);
    return this.base.leer(ruta);
  }

  async existe(ruta: string): Promise<boolean> {
    await this.esperar(ruta);
    return this.base.existe(ruta);
  }

  async *listar(prefijo: string): AsyncIterable<EntradaAlmacen> {
    await this.esperar();
    yield* this.base.listar(prefijo);
  }
}
