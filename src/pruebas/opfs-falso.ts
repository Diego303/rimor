/**
 * OPFS en memoria, fiel a lo que usa AlmacenOpfs: directorios, archivos, `createSyncAccessHandle`,
 * `getFile`, `move` y `removeEntry`. Permite simular cortes a mitad de escritura. Solo para pruebas.
 */

function error(nombre: string, mensaje: string): Error {
  const e = new Error(mensaje);
  e.name = nombre;
  return e;
}

export interface OpcionesFalso {
  /** Sin `move()`, como un navegador antiguo. */
  sinMove?: boolean;
  /** Si se define, la escritura que la cumpla escribe la mitad de los bytes y lanza. */
  cortarSi?: (nombre: string) => boolean;
}

export class ArchivoFalso {
  readonly kind = 'file';
  datos = new Uint8Array(0);
  modificado = 0;
  move?: (nombre: string) => Promise<void>;

  constructor(
    public name: string,
    private padre: DirectorioFalso,
    private readonly opciones: OpcionesFalso,
  ) {
    if (!opciones.sinMove) {
      this.move = async (nombre: string) => {
        this.padre.hijos.delete(this.name);
        this.name = nombre;
        this.padre.hijos.set(nombre, this);
      };
    }
  }

  async getFile() {
    const datos = this.datos.slice();
    return { size: datos.length, lastModified: this.modificado, arrayBuffer: async () => datos.buffer };
  }

  async createSyncAccessHandle() {
    const archivo = this;
    let abierto = true;
    const vivo = () => {
      if (!abierto) throw error('InvalidStateError', 'handle cerrado');
    };
    return {
      getSize: () => {
        vivo();
        return archivo.datos.length;
      },
      read(buf: Uint8Array, { at = 0 } = {}) {
        vivo();
        const trozo = archivo.datos.subarray(at, at + buf.length);
        buf.set(trozo);
        return trozo.length;
      },
      write(buf: Uint8Array, { at = 0 } = {}) {
        vivo();
        const cortar = archivo.opciones.cortarSi?.(archivo.name) ?? false;
        const escribir = cortar ? buf.subarray(0, Math.floor(buf.length / 2)) : buf;
        const nuevo = new Uint8Array(Math.max(archivo.datos.length, at + escribir.length));
        nuevo.set(archivo.datos);
        nuevo.set(escribir, at);
        archivo.datos = nuevo;
        archivo.modificado = Date.now();
        if (cortar) throw error('AbortError', 'corte simulado');
        return escribir.length;
      },
      truncate(n: number) {
        vivo();
        archivo.datos = archivo.datos.slice(0, n);
      },
      flush: () => vivo(),
      close: () => {
        abierto = false;
      },
    };
  }
}

export class DirectorioFalso {
  readonly kind = 'directory';
  readonly hijos = new Map<string, DirectorioFalso | ArchivoFalso>();

  constructor(
    readonly name = '',
    private readonly opciones: OpcionesFalso = {},
  ) {}

  async getDirectoryHandle(nombre: string, { create = false } = {}) {
    const h = this.hijos.get(nombre);
    if (h instanceof DirectorioFalso) return h;
    if (h) throw error('TypeMismatchError', `${nombre} es un archivo`);
    if (!create) throw error('NotFoundError', `no existe ${nombre}`);
    const d = new DirectorioFalso(nombre, this.opciones);
    this.hijos.set(nombre, d);
    return d;
  }

  async getFileHandle(nombre: string, { create = false } = {}) {
    const h = this.hijos.get(nombre);
    if (h instanceof ArchivoFalso) return h;
    if (h) throw error('TypeMismatchError', `${nombre} es un directorio`);
    if (!create) throw error('NotFoundError', `no existe ${nombre}`);
    const f = new ArchivoFalso(nombre, this, this.opciones);
    this.hijos.set(nombre, f);
    return f;
  }

  async removeEntry(nombre: string, { recursive = false } = {}) {
    const h = this.hijos.get(nombre);
    if (!h) throw error('NotFoundError', `no existe ${nombre}`);
    if (h instanceof DirectorioFalso && h.hijos.size && !recursive) throw error('InvalidModificationError', 'no vacío');
    this.hijos.delete(nombre);
  }

  async *entries(): AsyncIterable<[string, DirectorioFalso | ArchivoFalso]> {
    for (const par of [...this.hijos]) yield par;
  }
}

/** Raíz de un OPFS falso, con el tipo que espera AlmacenOpfs. */
export function crearOpfsFalso(opciones: OpcionesFalso = {}) {
  const raiz = new DirectorioFalso('', opciones);
  return { raiz, comoHandle: raiz as unknown as FileSystemDirectoryHandle };
}
