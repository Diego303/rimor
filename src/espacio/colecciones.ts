/**
 * Colecciones del espacio (ORG-02): el registro `colecciones.json` (orden y fecha de cada una) junto a lo que dicen
 * los elementos, que mandan: el `id` de una colección es el nombre que llevan en su frontmatter. Las operaciones
 * puras devuelven el registro nuevo; `GestorColecciones` lo lee, lo escribe (solo la pestaña que escribe y si el
 * archivo se entendía) y reescribe los elementos al renombrar o borrar, cada uno en su turno.
 */
import { type Colecciones, type FrontmatterComun, isoConZona, leerColecciones } from '@rimor/formato';
import { type Almacen, escribirTexto, leerTexto } from '../almacen/contrato';
import type { Repositorio } from '../almacen/repositorio';
import { limpiarColeccion } from './ediciones';

export const RUTA_COLECCIONES = 'colecciones.json';

export type Coleccion = Colecciones['colecciones'][number];

export const registroVacio = (): Colecciones => ({ esquema: 1, colecciones: [] });

/** El registro de un texto: `null` si el archivo existe pero no se entiende (no se pisa). */
export function leerRegistro(texto: string | null): Colecciones | null {
  if (texto === null) return registroVacio();
  return leerColecciones(texto);
}

/** Las colecciones en su orden. */
export const ordenadas = (r: Colecciones): Coleccion[] =>
  [...r.colecciones].sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));

const siguienteOrden = (r: Colecciones) => r.colecciones.reduce((m, c) => Math.max(m, c.orden), -1) + 1;

/** Añade al final las que usan los elementos y no están en el registro; `null` si no falta ninguna. */
export function sincronizar(r: Colecciones, usadas: Iterable<string>, ahora: string): Colecciones | null {
  const ya = new Set(r.colecciones.map((c) => c.id));
  const nuevas = [...new Set(usadas)].filter((id) => id && !ya.has(id)).sort((a, b) => a.localeCompare(b));
  if (!nuevas.length) return null;
  let orden = siguienteOrden(r);
  return {
    ...r,
    colecciones: [...r.colecciones, ...nuevas.map((id) => ({ id, nombre: id, orden: orden++, creado: ahora }))],
  };
}

/** Una colección nueva (vacía) al final; `null` si el nombre no vale o ya existe. */
export function crear(r: Colecciones, nombre: string, ahora: string): Colecciones | null {
  const id = limpiarColeccion(nombre);
  if (!id || r.colecciones.some((c) => c.id === id)) return null;
  return { ...r, colecciones: [...r.colecciones, { id, nombre: id, orden: siguienteOrden(r), creado: ahora }] };
}

/** Le cambia el nombre (si ya existe otra con ese nombre, se juntan en ella); `null` si no cambia nada. */
export function renombrar(r: Colecciones, id: string, nombre: string): Colecciones | null {
  const nuevo = limpiarColeccion(nombre);
  if (!nuevo || nuevo === id || !r.colecciones.some((c) => c.id === id)) return null;
  const existe = r.colecciones.some((c) => c.id === nuevo);
  return {
    ...r,
    colecciones: existe
      ? r.colecciones.filter((c) => c.id !== id)
      : r.colecciones.map((c) => (c.id === id ? { ...c, id: nuevo, nombre: nuevo } : c)),
  };
}

export function borrar(r: Colecciones, id: string): Colecciones | null {
  return r.colecciones.some((c) => c.id === id)
    ? { ...r, colecciones: r.colecciones.filter((c) => c.id !== id) }
    : null;
}

/** La sube (`-1`) o la baja (`+1`) un puesto; `null` si ya está en el extremo. */
export function mover(r: Colecciones, id: string, paso: -1 | 1): Colecciones | null {
  const lista = ordenadas(r);
  const i = lista.findIndex((c) => c.id === id);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= lista.length) return null;
  const [a, b] = [lista[i], lista[j]];
  if (!a || !b) return null;
  lista[i] = b;
  lista[j] = a;
  return { ...r, colecciones: lista.map((c, orden) => ({ ...c, orden })) };
}

/** Las colecciones que usan los elementos. */
export const usadasPor = (elementos: readonly FrontmatterComun[]): string[] =>
  elementos.flatMap((fm) => fm.colecciones ?? []);

export interface OpcionesGestor {
  puedeEscribir: () => boolean;
  alCambiar?: () => void;
  reloj?: () => Date;
}

/** El registro del espacio, al día con su archivo y con los elementos. */
export class GestorColecciones {
  private registro: Colecciones = registroVacio();
  /** El archivo se entendía (o no existía): si no, no se escribe encima. */
  private legible = true;
  private pendiente: Promise<void> = Promise.resolve();
  /**
   * Las que se están renombrando o borrando: mientras se reescriben sus elementos, alguno aún la lleva, y no debe
   * volver al registro.
   */
  private readonly enCurso = new Set<string>();

  /** Lo que usan los elementos, sin lo que se está renombrando o borrando. */
  private usadas(): string[] {
    return usadasPor(this.repositorio.elementos()).filter((id) => !this.enCurso.has(id));
  }

  constructor(
    private readonly almacen: Almacen,
    private readonly repositorio: Repositorio,
    private readonly opciones: OpcionesGestor,
  ) {}

  private ahora(): string {
    return isoConZona((this.opciones.reloj ?? (() => new Date()))());
  }

  /** Lee el archivo (al abrir y al releer lo de otra pestaña). */
  async cargar(): Promise<void> {
    const r = leerRegistro(await leerTexto(this.almacen, RUTA_COLECCIONES));
    this.legible = r !== null;
    this.registro = r ?? registroVacio();
  }

  lista(): Coleccion[] {
    // Lo que usan los elementos y aún no está en el registro también se ve (al final), aunque no se pueda escribir.
    const r = sincronizar(this.registro, this.usadas(), this.ahora()) ?? this.registro;
    return ordenadas(r);
  }

  existe(id: string): boolean {
    return this.lista().some((c) => c.id === id);
  }

  /** Guarda en el registro las colecciones que usan los elementos y faltaban. */
  sincronizar(): Promise<void> {
    const nuevo = sincronizar(this.registro, this.usadas(), this.ahora());
    return nuevo ? this.guardar(nuevo) : Promise.resolve();
  }

  crear(nombre: string): Promise<boolean> {
    return this.aplicar((r) => crear(r, nombre, this.ahora()));
  }

  mover(id: string, paso: -1 | 1): Promise<boolean> {
    return this.aplicar((r) => mover(r, id, paso));
  }

  /** Renombra en el registro y, después, en cada elemento (en su turno; es organización: sin tocar `modificado`). */
  async renombrar(id: string, nombre: string): Promise<boolean> {
    const nuevo = limpiarColeccion(nombre);
    this.enCurso.add(id);
    try {
      if (!(await this.aplicar((r) => renombrar(r, id, nombre)))) return false;
      await this.enElementos(id, (lista) => [...new Set(lista.map((c) => (c === id ? nuevo : c)))]);
      return true;
    } finally {
      this.enCurso.delete(id);
    }
  }

  /** Borra la colección del registro y la quita de sus elementos (que se quedan). */
  async borrar(id: string): Promise<boolean> {
    this.enCurso.add(id);
    try {
      if (!(await this.aplicar((r) => borrar(r, id)))) return false;
      await this.enElementos(id, (lista) => lista.filter((c) => c !== id));
      return true;
    } finally {
      this.enCurso.delete(id);
    }
  }

  private async enElementos(id: string, cambio: (lista: string[]) => string[]): Promise<void> {
    for (const fm of this.repositorio.elementos().filter((e) => e.colecciones?.includes(id)))
      await this.repositorio
        .actualizarElemento(fm.id, (el) => {
          const lista = cambio(el.frontmatter.colecciones ?? []);
          const { colecciones: _, ...resto } = el.frontmatter;
          return { ...el, frontmatter: (lista.length ? { ...resto, colecciones: lista } : resto) as FrontmatterComun };
        })
        .catch(() => undefined);
  }

  /** Aplica una operación sobre el registro (con lo de los elementos ya sumado) y la guarda. */
  private async aplicar(op: (r: Colecciones) => Colecciones | null): Promise<boolean> {
    if (!this.opciones.puedeEscribir() || !this.legible) return false;
    // La base, con todo lo que usan los elementos (también la que se va a renombrar o borrar, si aún no estaba).
    const base = sincronizar(this.registro, usadasPor(this.repositorio.elementos()), this.ahora()) ?? this.registro;
    const nuevo = op(base);
    if (!nuevo) return false;
    await this.guardar(nuevo);
    return true;
  }

  private guardar(r: Colecciones): Promise<void> {
    if (!this.opciones.puedeEscribir() || !this.legible) return Promise.resolve();
    this.registro = r;
    this.opciones.alCambiar?.();
    // Las escrituras del archivo, en orden.
    this.pendiente = this.pendiente
      .catch(() => undefined)
      .then(() => escribirTexto(this.almacen, RUTA_COLECCIONES, `${JSON.stringify(r, null, 2)}\n`));
    return this.pendiente;
  }
}
