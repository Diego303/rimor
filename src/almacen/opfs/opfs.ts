/**
 * Almacén sobre OPFS (F0-1): corre dentro de un Worker dedicado, donde `createSyncAccessHandle` es síncrono
 * y rápido. Si el navegador no lo tiene, usa `createWritable()`. Escritura atómica: temporal y renombrado.
 */
import { type Almacen, type EntradaAlmacen, validarRuta } from '../contrato';

export const SUFIJO_TEMPORAL = '.tmp';

type Directorio = FileSystemDirectoryHandle;

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

export class AlmacenOpfs implements Almacen {
  constructor(private readonly raiz: Directorio) {}

  /** Directorio que contiene la ruta (creándolo si hace falta) y el nombre del archivo. */
  private async carpeta(ruta: string, crear: boolean): Promise<[Directorio, string] | null> {
    const partes = validarRuta(ruta).split('/');
    const nombre = partes.pop() as string;
    let dir = this.raiz;
    for (const p of partes) {
      try {
        dir = await dir.getDirectoryHandle(p, { create: crear });
      } catch (e) {
        if (!crear && esNoEncontrado(e)) return null;
        throw e;
      }
    }
    return [dir, nombre];
  }

  private async archivo(ruta: string): Promise<Archivo | null> {
    const c = await this.carpeta(ruta, false);
    if (!c) return null;
    try {
      return await c[0].getFileHandle(c[1]);
    } catch (e) {
      if (esNoEncontrado(e) || esTipoErroneo(e)) return null;
      throw e;
    }
  }

  async leer(ruta: string): Promise<Uint8Array | null> {
    const f = await this.archivo(ruta);
    if (!f) return null;
    if (f.createSyncAccessHandle) {
      const h = await f.createSyncAccessHandle();
      try {
        const datos = new Uint8Array(h.getSize());
        h.read(datos, { at: 0 });
        return datos;
      } finally {
        h.close();
      }
    }
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

  async escribir(ruta: string, datos: Uint8Array): Promise<void> {
    const c = await this.carpeta(ruta, true);
    if (!c) throw new Error(`No se pudo crear la carpeta de «${ruta}»`);
    const [dir, nombre] = c;
    const temporal: Archivo = await dir.getFileHandle(nombre + SUFIJO_TEMPORAL, { create: true });
    await this.volcar(temporal, datos);
    if (typeof temporal.move === 'function') {
      // Renombrar sustituye al destino de una vez: no hay estado intermedio.
      await temporal.move(nombre);
      return;
    }
    // Sin move(): copia y borra. Si se corta aquí, el destino puede quedar a medias y limpiarHuerfanos lo deja.
    await this.volcar(await dir.getFileHandle(nombre, { create: true }), datos);
    await dir.removeEntry(nombre + SUFIJO_TEMPORAL);
  }

  async mover(de: string, a: string): Promise<void> {
    if (de === a) return;
    const datos = await this.leer(de);
    if (!datos) throw new Error(`No existe «${de}»`);
    await this.escribir(a, datos);
    await this.borrar(de);
  }

  async borrar(ruta: string): Promise<void> {
    const c = await this.carpeta(ruta, false);
    if (!c) return;
    try {
      await c[0].removeEntry(c[1]);
    } catch (e) {
      if (!esNoEncontrado(e)) throw e;
    }
  }

  async *listar(prefijo: string): AsyncIterable<EntradaAlmacen> {
    yield* this.recorrer(this.raiz, '', prefijo);
  }

  private async *recorrer(dir: Directorio, base: string, prefijo: string): AsyncIterable<EntradaAlmacen> {
    for await (const [nombre, h] of (
      dir as Directorio & { entries(): AsyncIterable<[string, FileSystemHandle]> }
    ).entries()) {
      const ruta = base ? `${base}/${nombre}` : nombre;
      // Solo baja por carpetas que pueden contener el prefijo.
      if (!(ruta.startsWith(prefijo) || prefijo.startsWith(`${ruta}/`))) continue;
      if (h.kind === 'directory') yield* this.recorrer(h as Directorio, ruta, prefijo);
      else if (!nombre.endsWith(SUFIJO_TEMPORAL)) {
        const f = await (h as FileSystemFileHandle).getFile();
        yield { ruta, tam: f.size, modificado: f.lastModified };
      }
    }
  }

  async existe(ruta: string): Promise<boolean> {
    return (await this.archivo(ruta)) !== null;
  }

  /** Borra los temporales que dejó una escritura interrumpida. Se llama al abrir el espacio. */
  async limpiarHuerfanos(dir: Directorio = this.raiz): Promise<number> {
    let n = 0;
    const borrar: string[] = [];
    for await (const [nombre, h] of (
      dir as Directorio & { entries(): AsyncIterable<[string, FileSystemHandle]> }
    ).entries()) {
      if (h.kind === 'directory') n += await this.limpiarHuerfanos(h as Directorio);
      else if (nombre.endsWith(SUFIJO_TEMPORAL)) borrar.push(nombre);
    }
    for (const nombre of borrar) await dir.removeEntry(nombre);
    return n + borrar.length;
  }
}

const esNoEncontrado = (e: unknown) => e instanceof Error && (e.name === 'NotFoundError' || e.name === 'NotFound');
const esTipoErroneo = (e: unknown) => e instanceof Error && e.name === 'TypeMismatchError';
