/**
 * Piezas comunes de los repositorios (elementos y entidades): las escrituras de una misma clave van de una en una,
 * y las operaciones de varios pasos (mover, renombrar) se anotan antes en un diario para terminarlas si se cortan.
 */
import { type Almacen, leerTexto } from './contrato';

/** Cola por clave: lo pedido para una clave se ejecuta en orden, después de lo anterior (aunque eso falle). */
export class Turnos {
  private readonly colas = new Map<string, Promise<unknown>>();

  en<T>(clave: string, fn: () => Promise<T>): Promise<T> {
    const previo = this.colas.get(clave) ?? Promise.resolve();
    const actual = previo.catch(() => undefined).then(fn);
    const fin = actual.catch(() => undefined);
    this.colas.set(clave, fin);
    void fin.then(() => {
      if (this.colas.get(clave) === fin) this.colas.delete(clave);
    });
    return actual;
  }
}

const codificador = new TextEncoder();

/**
 * Hace `paso` (que deja `a` escrito y borra `de`) anotándolo antes en el diario `ruta`: un corte en medio dejaría
 * dos copias, y `recuperarOperacion` la termina al cargar.
 */
export async function conDiario(
  almacen: Almacen,
  ruta: string,
  de: string,
  a: string,
  paso: () => Promise<void>,
): Promise<void> {
  await almacen.escribir(ruta, codificador.encode(JSON.stringify({ de, a })));
  await paso();
  await almacen.borrar(ruta);
}

/** Termina la operación que quedó a medias según el diario `ruta`: si el destino ya existe, sobra el origen. */
export async function terminarDiario(almacen: Almacen, ruta: string): Promise<void> {
  const texto = await leerTexto(almacen, ruta);
  if (texto === null) return;
  try {
    const { de, a } = JSON.parse(texto) as { de?: unknown; a?: unknown };
    if (typeof de === 'string' && typeof a === 'string' && de !== a && (await almacen.existe(a)))
      await almacen.borrar(de);
  } catch {
    // Diario ilegible: la operación no llegó a empezar.
  }
  await almacen.borrar(ruta);
}
