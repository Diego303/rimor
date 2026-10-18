/**
 * Caché del espacio en IndexedDB (DAT-02): frontmatter de cada elemento, derivados de los lectores e índice
 * de búsqueda. Todo es regenerable desde los archivos; si la versión de la caché cambia, se vacía entera.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { type DBSchema, type IDBPDatabase, wrap } from 'idb';

export const VERSION_CACHE = 1;

export interface EntradaFrontmatter {
  id: string;
  ref: string;
  ruta: string;
  tam: number;
  modificado: number;
  frontmatter: FrontmatterComun;
}

interface EntradaDerivado {
  id: string;
  lector: string;
  version: number;
  hash: string;
  datos: unknown;
}

interface Esquema extends DBSchema {
  frontmatter: { key: string; value: EntradaFrontmatter; indexes: { porRuta: string } };
  derivados: { key: [string, string, number, string]; value: EntradaDerivado; indexes: { porId: string } };
  indice: { key: string; value: Uint8Array };
  meta: { key: string; value: number };
}

const CLAVE_INDICE = 'busqueda';

export class CacheEspacio {
  private constructor(private readonly db: IDBPDatabase<Esquema>) {}

  /** Abre la caché de un espacio; si su versión no es la actual, la vacía. `fabrica` permite otra IndexedDB (pruebas). */
  static async abrir(espacio: string, fabrica: IDBFactory = globalThis.indexedDB): Promise<CacheEspacio> {
    const peticion = fabrica.open(`rimor-cache-${espacio}`, 1);
    peticion.onupgradeneeded = () => {
      const base = peticion.result;
      base.createObjectStore('frontmatter', { keyPath: 'id' }).createIndex('porRuta', 'ruta');
      base.createObjectStore('derivados', { keyPath: ['id', 'lector', 'version', 'hash'] }).createIndex('porId', 'id');
      base.createObjectStore('indice');
      base.createObjectStore('meta');
    };
    const crudo = await new Promise<IDBDatabase>((ok, ko) => {
      peticion.onsuccess = () => ok(peticion.result);
      peticion.onerror = () => ko(peticion.error);
    });
    const db = wrap(crudo) as IDBPDatabase<Esquema>;
    const cache = new CacheEspacio(db);
    if ((await db.get('meta', 'version')) !== VERSION_CACHE) {
      await cache.vaciar();
      await db.put('meta', VERSION_CACHE, 'version');
    }
    return cache;
  }

  /** Borra la base de la caché de un espacio (para rehacerla si no se puede abrir). */
  static borrar(espacio: string, fabrica: IDBFactory = globalThis.indexedDB): Promise<void> {
    return new Promise((ok, ko) => {
      const peticion = fabrica.deleteDatabase(`rimor-cache-${espacio}`);
      peticion.onsuccess = () => ok();
      peticion.onerror = () => ko(peticion.error);
      // Otra pestaña la tiene abierta: abrirla después quedaría esperando a que la suelte.
      peticion.onblocked = () => ko(new Error('cache.bloqueada'));
    });
  }

  frontmatters(): Promise<EntradaFrontmatter[]> {
    return this.db.getAll('frontmatter');
  }

  async guardarFrontmatters(entradas: readonly EntradaFrontmatter[]): Promise<void> {
    if (!entradas.length) return;
    const tx = this.db.transaction('frontmatter', 'readwrite');
    await Promise.all([...entradas.map((e) => tx.store.put(e)), tx.done]);
  }

  /** Borra elementos de la caché, con sus derivados. */
  async borrarElementos(ids: readonly string[]): Promise<void> {
    if (!ids.length) return;
    const tx = this.db.transaction(['frontmatter', 'derivados'], 'readwrite');
    const derivados = tx.objectStore('derivados');
    for (const id of ids) {
      await tx.objectStore('frontmatter').delete(id);
      for (const clave of await derivados.index('porId').getAllKeys(id)) await derivados.delete(clave);
    }
    await tx.done;
  }

  /** Derivado de un elemento para esa versión del lector y ese original; `undefined` si no está o caducó. */
  async derivado<D>(id: string, lector: string, version: number, hash: string): Promise<D | undefined> {
    return (await this.db.get('derivados', [id, lector, version, hash]))?.datos as D | undefined;
  }

  /** Guarda un derivado y borra los anteriores del mismo elemento y lector (otra versión u otro original). */
  async guardarDerivado(id: string, lector: string, version: number, hash: string, datos: unknown): Promise<void> {
    const tx = this.db.transaction('derivados', 'readwrite');
    for (const clave of await tx.store.index('porId').getAllKeys(id)) {
      const [, l, v, h] = clave;
      if (l === lector && (v !== version || h !== hash)) await tx.store.delete(clave);
    }
    await tx.store.put({ id, lector, version, hash, datos });
    await tx.done;
  }

  /** Borra los derivados de un elemento hechos sobre otro original (el archivo cambió). */
  async podarDerivados(id: string, hashVigente: string): Promise<void> {
    const tx = this.db.transaction('derivados', 'readwrite');
    for (const clave of await tx.store.index('porId').getAllKeys(id))
      if (clave[3] !== hashVigente) await tx.store.delete(clave);
    await tx.done;
  }

  async indice(): Promise<Uint8Array | undefined> {
    return this.db.get('indice', CLAVE_INDICE);
  }

  async guardarIndice(datos: Uint8Array): Promise<void> {
    await this.db.put('indice', datos, CLAVE_INDICE);
  }

  async vaciar(): Promise<void> {
    const tx = this.db.transaction(['frontmatter', 'derivados', 'indice'], 'readwrite');
    await Promise.all([
      tx.objectStore('frontmatter').clear(),
      tx.objectStore('derivados').clear(),
      tx.objectStore('indice').clear(),
      tx.done,
    ]);
  }

  cerrar(): void {
    this.db.close();
  }
}
