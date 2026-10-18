/**
 * Almacén sobre OPFS (F0-1): corre dentro de un Worker dedicado, donde `createSyncAccessHandle` es síncrono
 * y rápido. Si el navegador no lo tiene, usa `createWritable()`.
 *
 * Escritura atómica:
 * - con `move()`: se escribe `nombre.rimor-tmp` y se renombra sobre el destino (sustitución de una vez);
 * - sin `move()`: diario de dos fases. Se escribe el temporal, se crea la marca `nombre.rimor-ok` (el temporal
 *   está completo), se copia sobre el destino y se borran marca y temporal. Al abrir, `limpiarHuerfanos`
 *   rehace la copia si hay marca (el destino pudo quedar a medias) o borra el temporal si no la hay (el
 *   destino no se llegó a tocar).
 * Todas las operaciones van de una en una: OPFS no admite dos accesos síncronos al mismo archivo.
 */
import { type Almacen, type EntradaAlmacen, validarRuta } from '../contrato';

export const SUFIJO_TEMPORAL = '.rimor-tmp';
export const SUFIJO_MARCA = '.rimor-ok';

type Directorio = FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> };

/** Lo que se usa de `FileSystemSyncAccessHandle` (solo existe en Workers). */
interface AccesoSincrono {
  getSize(): number;
  read(buffer: Uint8Array, opciones: { at: number }): number;
  write(buffer: Uint8Array, opciones: { at: number }): number;
  truncate(tam: number): void;
  flush(): void;
  close(): void;
}

/** Un archivo de OPFS con lo que puede faltar según el navegador. */
type Archivo = FileSystemFileHandle & {
  createSyncAccessHandle?: () => Promise<AccesoSincrono>;
  createWritable?: () => Promise<FileSystemWritableFileStream>;
  move?: (nombre: string) => Promise<void>;
};

const esAuxiliar = (nombre: string) => nombre.endsWith(SUFIJO_TEMPORAL) || nombre.endsWith(SUFIJO_MARCA);

export class AlmacenOpfs implements Almacen {
  private turno: Promise<unknown> = Promise.resolve();

  constructor(private readonly raiz: FileSystemDirectoryHandle) {}

  /** Ejecuta las operaciones públicas de una en una. */
  private exclusivo<T>(op: () => Promise<T>): Promise<T> {
    const resultado = this.turno.then(op, op);
    this.turno = resultado.catch(() => undefined);
    return resultado;
  }

  /** Directorio que contiene la ruta (creándolo si hace falta) y el nombre del archivo. */
  private async carpeta(ruta: string, crear: boolean): Promise<[Directorio, string] | null> {
    const partes = validarRuta(ruta).split('/');
    const nombre = partes.pop() as string;
    let dir = this.raiz as Directorio;
    for (const p of partes) {
      try {
        dir = (await dir.getDirectoryHandle(p, { create: crear })) as Directorio;
      } catch (e) {
        if (!crear && (esNoEncontrado(e) || esTipoErroneo(e))) return null;
        throw e;
      }
    }
    return [dir, nombre];
  }

  private async archivoEn(dir: Directorio, nombre: string): Promise<Archivo | null> {
    try {
      return await dir.getFileHandle(nombre);
    } catch (e) {
      if (esNoEncontrado(e) || esTipoErroneo(e)) return null;
      throw e;
    }
  }

  private async archivo(ruta: string): Promise<Archivo | null> {
    const c = await this.carpeta(ruta, false);
    return c ? this.archivoEn(c[0], c[1]) : null;
  }

  /**
   * Lee con `getFile()`, que no toma el cerrojo exclusivo de `createSyncAccessHandle`: así una pestaña lectora
   * no hace fallar las escrituras de la otra (IN-007). Si el archivo se está escribiendo, la lectura falla y
   * quien lee lo reintenta.
   */
  private async leerArchivo(f: Archivo): Promise<Uint8Array> {
    return new Uint8Array(await (await f.getFile()).arrayBuffer());
  }

  private async volcar(f: Archivo, datos: Uint8Array): Promise<void> {
    if (f.createSyncAccessHandle) {
      const h = await f.createSyncAccessHandle();
      try {
        h.truncate(0);
        h.write(datos, { at: 0 });
        h.flush();
      } finally {
        h.close();
      }
      return;
    }
    if (!f.createWritable) throw new Error('Este navegador no permite escribir en OPFS');
    const w = await f.createWritable();
    await w.write(new Uint8Array(datos));
    await w.close();
  }

  private async borrarEn(dir: Directorio, nombre: string): Promise<void> {
    try {
      await dir.removeEntry(nombre);
    } catch (e) {
      if (!esNoEncontrado(e)) throw e;
    }
  }

  private async escribirSinTurno(ruta: string, datos: Uint8Array): Promise<void> {
    const c = await this.carpeta(ruta, true);
    if (!c) throw new Error(`No se pudo crear la carpeta de «${ruta}»`);
    const [dir, nombre] = c;
    const temporal: Archivo = await dir.getFileHandle(nombre + SUFIJO_TEMPORAL, { create: true });
    await this.volcar(temporal, datos);
    if (typeof temporal.move === 'function') {
      await temporal.move(nombre);
      return;
    }
    await dir.getFileHandle(nombre + SUFIJO_MARCA, { create: true });
    await this.volcar(await dir.getFileHandle(nombre, { create: true }), datos);
    await this.borrarEn(dir, nombre + SUFIJO_MARCA);
    await this.borrarEn(dir, nombre + SUFIJO_TEMPORAL);
  }

  private async borrarSinTurno(ruta: string): Promise<void> {
    const c = await this.carpeta(ruta, false);
    if (c) await this.borrarEn(c[0], c[1]);
  }

  leer(ruta: string): Promise<Uint8Array | null> {
    return this.exclusivo(async () => {
      const f = await this.archivo(ruta);
      return f ? this.leerArchivo(f) : null;
    });
  }

  escribir(ruta: string, datos: Uint8Array): Promise<void> {
    return this.exclusivo(() => this.escribirSinTurno(ruta, datos));
  }

  /** Copia (atómica) y borra el origen. Un corte entre los dos pasos deja dos copias: el repositorio lo resuelve. */
  mover(de: string, a: string): Promise<void> {
    return this.exclusivo(async () => {
      if (de === a) return;
      const f = await this.archivo(de);
      if (!f) throw new Error(`No existe «${de}»`);
      await this.escribirSinTurno(a, await this.leerArchivo(f));
      await this.borrarSinTurno(de);
    });
  }

  borrar(ruta: string): Promise<void> {
    return this.exclusivo(() => this.borrarSinTurno(ruta));
  }

  async *listar(prefijo: string): AsyncIterable<EntradaAlmacen> {
    const entradas = await this.exclusivo(async () => {
      const salida: EntradaAlmacen[] = [];
      for await (const e of this.recorrer(this.raiz as Directorio, '', prefijo)) salida.push(e);
      return salida;
    });
    yield* entradas;
  }

  private async *recorrer(dir: Directorio, base: string, prefijo: string): AsyncIterable<EntradaAlmacen> {
    for await (const [nombre, h] of dir.entries()) {
      const ruta = base ? `${base}/${nombre}` : nombre;
      // Solo baja por carpetas que pueden contener el prefijo.
      if (!(ruta.startsWith(prefijo) || prefijo.startsWith(`${ruta}/`))) continue;
      if (h.kind === 'directory') yield* this.recorrer(h as Directorio, ruta, prefijo);
      else if (!esAuxiliar(nombre)) {
        const f = await (h as FileSystemFileHandle).getFile();
        yield { ruta, tam: f.size, modificado: f.lastModified };
      }
    }
  }

  existe(ruta: string): Promise<boolean> {
    return this.exclusivo(async () => (await this.archivo(ruta)) !== null);
  }

  /**
   * Termina o deshace las escrituras que se cortaron. Solo debe llamarlo la pestaña que escribe (IN-007).
   * Devuelve cuántas había.
   */
  limpiarHuerfanos(): Promise<number> {
    return this.exclusivo(() => this.limpiarEn(this.raiz as Directorio));
  }

  private async limpiarEn(dir: Directorio): Promise<number> {
    let n = 0;
    const nombres: string[] = [];
    for await (const [nombre, h] of dir.entries()) {
      if (h.kind === 'directory') n += await this.limpiarEn(h as Directorio);
      else nombres.push(nombre);
    }
    for (const nombre of nombres.filter((x) => x.endsWith(SUFIJO_TEMPORAL))) {
      const destino = nombre.slice(0, -SUFIJO_TEMPORAL.length);
      if (nombres.includes(destino + SUFIJO_MARCA)) {
        // El temporal estaba completo: se rehace la copia que pudo quedar a medias.
        const temporal = await this.archivoEn(dir, nombre);
        if (temporal)
          await this.volcar(await dir.getFileHandle(destino, { create: true }), await this.leerArchivo(temporal));
        await this.borrarEn(dir, destino + SUFIJO_MARCA);
      }
      await this.borrarEn(dir, nombre);
      n++;
    }
    for (const nombre of nombres.filter((x) => x.endsWith(SUFIJO_MARCA)))
      if (!nombres.includes(nombre.slice(0, -SUFIJO_MARCA.length) + SUFIJO_TEMPORAL)) await this.borrarEn(dir, nombre);
    return n;
  }
}

const esNoEncontrado = (e: unknown) => e instanceof Error && (e.name === 'NotFoundError' || e.name === 'NotFound');
const esTipoErroneo = (e: unknown) => e instanceof Error && e.name === 'TypeMismatchError';
