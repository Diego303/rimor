/** Almacén en memoria: para las pruebas y para el espacio de ejemplo. Mismo contrato que el de OPFS. */
import { type Almacen, type EntradaAlmacen, validarRuta } from './contrato';

export class AlmacenMemoria implements Almacen {
  private readonly archivos = new Map<string, { datos: Uint8Array; modificado: number }>();

  constructor(private readonly reloj: () => number = Date.now) {}

  async leer(ruta: string): Promise<Uint8Array | null> {
    const a = this.archivos.get(validarRuta(ruta));
    return a ? a.datos.slice() : null;
  }

  async escribir(ruta: string, datos: Uint8Array): Promise<void> {
    this.archivos.set(validarRuta(ruta), { datos: datos.slice(), modificado: this.reloj() });
  }

  async mover(de: string, a: string): Promise<void> {
    const origen = this.archivos.get(validarRuta(de));
    if (!origen) throw new Error(`No existe «${de}»`);
    validarRuta(a);
    if (de === a) return;
    this.archivos.set(a, origen);
    this.archivos.delete(de);
  }

  async borrar(ruta: string): Promise<void> {
    this.archivos.delete(validarRuta(ruta));
  }

  async *listar(prefijo: string): AsyncIterable<EntradaAlmacen> {
    for (const [ruta, a] of [...this.archivos]) {
      if (ruta.startsWith(prefijo)) yield { ruta, tam: a.datos.length, modificado: a.modificado };
    }
  }

  async existe(ruta: string): Promise<boolean> {
    return this.archivos.has(validarRuta(ruta));
  }
}
