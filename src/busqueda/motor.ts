/**
 * El motor de búsqueda (BUS-01, BUS-02): mantiene el índice al día con el espacio (al abrir carga el guardado y
 * reindexa solo lo que cambió; quita lo borrado o en la papelera), lo guarda comprimido (solo la pestaña que
 * escribe) y responde a las consultas: filtros sobre el frontmatter, palabras en el índice, frases exactas
 * comprobadas en los mejores candidatos y exclusiones. Ranking: la relevancia, con un empujón a lo fijado y a lo
 * reciente. TS puro: el índice va detrás de `ApiIndice` (en el Worker o aquí).
 */
import type { Elemento, FrontmatterComun, Resultado, TipoElemento } from '@rimor/formato';
import { comprimir, descomprimir } from '../almacen/cache/comprimir';
import {
  analizarConsulta,
  type Consulta,
  coincideFiltros,
  type EstadosDe,
  hayConsulta,
  normalizarBusqueda,
} from './consulta';
import { type ApiIndice, claveIndice, type DocumentoBusqueda, type Indexado } from './contrato';

/** Como mucho, los resultados que se devuelven (F0-8). */
export const MAX_RESULTADOS = 50;
/** Los candidatos que se leen para comprobar una frase exacta. */
export const MAX_LEIDOS = 200;
/** Elementos por tanda al indexar. */
const TANDA = 25;
/** Lo que se espera para guardar el índice tras un cambio (agrupa las escrituras). */
const ESPERA_GUARDAR_MS = 2000;
/** Lo que se lee del original para comprobar una frase. */
const MAX_TEXTO_FRASE = 65_536;

export type EstadoMotor =
  | { fase: 'preparando' }
  | { fase: 'indexando'; hechos: number; total: number }
  | { fase: 'listo' };

export interface ResultadoBusqueda {
  fm: FrontmatterComun;
  /** Lo que casa, para resaltarlo (palabras del índice, sin acentos ni mayúsculas). */
  terminos: string[];
  /** Casa solo dentro del contenido (no en el título, la ref ni las etiquetas). */
  enContenido: boolean;
}

/** Cuántos resultados hay de cada tipo, colección y etiqueta (de más a menos). */
export interface Facetas {
  tipos: [TipoElemento, number][];
  colecciones: [string, number][];
  etiquetas: [string, number][];
}

export interface Busqueda {
  consulta: Consulta;
  /** Cuántos cumplen la consulta (los que se devuelven son como mucho `MAX_RESULTADOS`). */
  total: number;
  resultados: ResultadoBusqueda[];
  /** De todos los que cumplen la consulta, no solo de los devueltos. */
  facetas: Facetas;
}

/** Lo que el motor usa del repositorio. */
export interface RepositorioBusqueda {
  elementos(): FrontmatterComun[];
  leerElemento(refOId: string): Promise<Resultado<Elemento>>;
}

/** Lo que el motor usa de la caché del espacio. */
export interface CacheIndice {
  indice(): Promise<Uint8Array | undefined>;
  guardarIndice(datos: Uint8Array): Promise<void>;
}

export interface OpcionesMotor {
  repositorio: RepositorioBusqueda;
  api: ApiIndice;
  cache?: CacheIndice;
  /** Solo la pestaña que escribe guarda el índice. */
  puedeEscribir?: () => boolean;
  /** Lo que el lector deriva para buscar (`textoIndexable`); vacío si no hay. */
  indexable?: (el: Elemento) => Promise<string>;
  estadosDe?: EstadosDe;
  reloj?: () => Date;
  esperaGuardarMs?: number;
}

const DIA = 86_400_000;

/** Las fechas ya leídas: leer 10.000 fechas en cada búsqueda se nota. */
const INSTANTES = new Map<string, number>();
function instante(iso: string): number {
  let ms = INSTANTES.get(iso);
  if (ms === undefined) {
    if (INSTANTES.size > 50_000) INSTANTES.clear();
    ms = Date.parse(iso);
    INSTANTES.set(iso, ms);
  }
  return ms;
}

/** Lo que se lee a la vez al comprobar frases. */
const LEIDOS_A_LA_VEZ = 20;

/** Las palabras que el índice puede buscar (con alguna letra o cifra: `#` o `-` solos no). */
const buscables = (palabras: readonly string[]) => palabras.filter((p) => /[\p{L}\p{N}]/u.test(p));

/** El texto en que se comprueba una frase: lo mismo que se indexa, con más del original. */
function textoDe(el: Elemento): string {
  const fm = el.frontmatter;
  return normalizarBusqueda(
    [fm.titulo, fm.ref, ...(fm.etiquetas ?? []), el.notas, (el.original ?? '').slice(0, MAX_TEXTO_FRASE)].join('\n'),
  ).replace(/\s+/g, ' ');
}

/** Una palabra tal cual la guarda el índice (sin espacios ni signos). */
const esPalabra = (s: string) => /^[\p{L}\p{N}]+$/u.test(s);

const tieneFrase = (texto: string, frase: string) => texto.includes(frase.replace(/\s+/g, ' '));

export class MotorBusqueda {
  private readonly claves = new Map<string, string>();
  private estadoActual: EstadoMotor = { fase: 'preparando' };
  private readonly oyentes = new Set<(e: EstadoMotor) => void>();
  private readonly cargado: Promise<void>;
  private sincronizando: Promise<void> | null = null;
  private otraVez = false;
  private sucio = false;
  private temporizador: ReturnType<typeof setTimeout> | undefined;
  private cerrado = false;
  private guardando: Promise<void> = Promise.resolve();

  constructor(private readonly o: OpcionesMotor) {
    this.cargado = this.cargar();
  }

  estado(): EstadoMotor {
    return this.estadoActual;
  }

  alCambiarEstado(fn: (e: EstadoMotor) => void): () => void {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  }

  private ponerEstado(e: EstadoMotor): void {
    this.estadoActual = e;
    for (const fn of this.oyentes) fn(e);
  }

  /** Carga el índice guardado (si vale); si no, se empieza de cero. */
  private async cargar(): Promise<void> {
    try {
      const datos = await this.o.cache?.indice();
      if (!datos) return;
      const json = new TextDecoder().decode(await descomprimir(datos));
      if (!(await this.o.api.cargar(json))) return;
      for (const [id, clave] of await this.o.api.claves()) this.claves.set(id, clave);
    } catch {
      // Un índice ilegible se rehace.
      this.claves.clear();
    }
  }

  /**
   * Pone el índice al día con los elementos: lo que falta o cambió (lo más reciente primero) y lo que ya no está.
   * Si se pide mientras va, se repite al acabar (una vez, con lo último).
   */
  sincronizar(): Promise<void> {
    if (this.cerrado) return Promise.resolve();
    if (this.sincronizando) {
      this.otraVez = true;
      return this.sincronizando;
    }
    this.sincronizando = (async () => {
      await this.cargado;
      do {
        this.otraVez = false;
        await this.sincronizarAhora();
      } while (this.otraVez && !this.cerrado);
    })().finally(() => {
      this.sincronizando = null;
    });
    return this.sincronizando;
  }

  private async sincronizarAhora(): Promise<void> {
    const elementos = this.o.repositorio.elementos();
    const vivos = new Set(elementos.map((fm) => fm.id));
    const sobran = [...this.claves.keys()].filter((id) => !vivos.has(id));
    if (sobran.length) {
      await this.o.api.quitar(sobran);
      for (const id of sobran) this.claves.delete(id);
      this.sucio = true;
    }
    const faltan = elementos
      .filter((fm) => this.claves.get(fm.id) !== claveIndice(fm))
      .sort((a, b) => instante(b.modificado) - instante(a.modificado));
    for (let i = 0; i < faltan.length && !this.cerrado; i += TANDA) {
      this.ponerEstado({ fase: 'indexando', hechos: i, total: faltan.length });
      const tanda = (await Promise.all(faltan.slice(i, i + TANDA).map((fm) => this.documento(fm)))).filter(
        (d): d is Indexado => d !== null,
      );
      if (!tanda.length) continue;
      await this.o.api.poner(tanda);
      for (const { doc, clave } of tanda) this.claves.set(doc.id, clave);
      this.sucio = true;
    }
    this.ponerEstado({ fase: 'listo' });
    if (this.sucio) this.programarGuardado();
  }

  /** Lo que se indexa de un elemento (leído del espacio); `null` si ya no está. */
  private async documento(fm: FrontmatterComun): Promise<Indexado | null> {
    const leido = await this.o.repositorio.leerElemento(fm.id).catch(() => null);
    // Si el archivo no se puede leer, al menos lo del frontmatter.
    const el: Elemento = leido?.ok ? leido.valor : { frontmatter: fm, notas: '', original: null };
    if (el.frontmatter.id !== fm.id) return null;
    let indexable = '';
    try {
      indexable = (await this.o.indexable?.(el)) ?? '';
    } catch {
      indexable = '';
    }
    const f = el.frontmatter;
    const doc: DocumentoBusqueda = {
      id: f.id,
      titulo: f.titulo,
      ref: f.ref,
      etiquetas: (f.etiquetas ?? []).join(' '),
      notas: el.notas,
      cuerpo: el.original ?? '',
      indexable,
    };
    return { doc, clave: claveIndice(f) };
  }

  private programarGuardado(): void {
    if (!this.o.cache || !(this.o.puedeEscribir?.() ?? true)) return;
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.guardar(), this.o.esperaGuardarMs ?? ESPERA_GUARDAR_MS);
  }

  /**
   * Guarda el índice comprimido en la caché (si cambió y esta pestaña escribe). Las escrituras van en orden: quien
   * llama espera también a la que ya estaba en marcha.
   */
  guardar(): Promise<void> {
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    this.guardando = this.guardando.then(() => this.guardarAhora());
    return this.guardando;
  }

  private async guardarAhora(): Promise<void> {
    if (!this.sucio || !this.o.cache || !(this.o.puedeEscribir?.() ?? true)) return;
    this.sucio = false;
    try {
      const json = await this.o.api.exportar();
      await this.o.cache.guardarIndice(await comprimir(new TextEncoder().encode(json)));
    } catch {
      // Es una caché: se rehará.
      this.sucio = true;
    }
  }

  /** Lo que el índice tiene de cada elemento (para las pruebas y el diagnóstico). */
  indexados(): number {
    return this.claves.size;
  }

  async buscar(texto: string, { ahora = this.o.reloj?.() ?? new Date() }: { ahora?: Date } = {}): Promise<Busqueda> {
    const consulta = analizarConsulta(texto, { ahora });
    const vacia: Busqueda = { consulta, total: 0, resultados: [], facetas: facetasDe([]) };
    if (consulta.imposible || !hayConsulta(consulta)) return vacia;
    await this.cargado;

    const palabras = buscables([...consulta.palabras, ...consulta.frases.flatMap((f) => f.split(/\s+/))]);
    const conTexto = consulta.palabras.length > 0 || consulta.frases.length > 0;
    if (conTexto && !palabras.length) return vacia;
    const filtradas = this.o.repositorio.elementos().filter((fm) => coincideFiltros(fm, consulta, this.o.estadosDe));
    if (!filtradas.length) return vacia;

    let candidatos: { fm: FrontmatterComun; puntuacion: number; terminos: string[]; enContenido: boolean }[];
    if (conTexto) {
      const porId = new Map(filtradas.map((fm) => [fm.id, fm]));
      candidatos = [];
      // Las palabras sueltas excluidas, en la misma pasada del índice; las frases, después.
      for (const a of await this.o.api.buscar(palabras, consulta.excluir.filter(esPalabra))) {
        const fm = porId.get(a.id);
        if (fm)
          candidatos.push({
            fm,
            puntuacion: a.puntuacion * empujon(fm, ahora),
            terminos: a.terminos,
            enContenido: a.enContenido,
          });
      }
      candidatos.sort((a, b) => b.puntuacion - a.puntuacion);
    } else {
      candidatos = filtradas
        .map((fm) => ({ fm, puntuacion: 0, terminos: [], enContenido: false }))
        .sort((a, b) => instante(b.fm.creado) - instante(a.fm.creado));
    }

    candidatos = await this.excluir(
      candidatos,
      conTexto ? consulta.excluir.filter((e) => !esPalabra(e)) : consulta.excluir,
    );
    if (consulta.frases.length) candidatos = await this.conFrases(candidatos, consulta.frases);
    return {
      consulta,
      total: candidatos.length,
      facetas: facetasDe(candidatos.map((c) => c.fm)),
      resultados: candidatos
        .slice(0, MAX_RESULTADOS)
        .map(({ fm, terminos, enContenido }) => ({ fm, terminos, enContenido })),
    };
  }

  /** Quita lo que contiene alguna palabra o frase excluida. */
  private async excluir<T extends { fm: FrontmatterComun }>(lista: T[], excluir: readonly string[]): Promise<T[]> {
    if (!excluir.length || !lista.length) return lista;
    const fuera = new Set<string>();
    for (const e of excluir) {
      const palabras = buscables(e.split(/\s+/));
      if (!palabras.length) continue;
      const ids = await this.o.api.conPalabras(palabras);
      // Una palabra tal cual la guarda el índice: fuera todos los que la tienen.
      if (esPalabra(e)) {
        for (const id of ids) fuera.add(id);
        continue;
      }
      // Una frase (o una palabra con signos): solo los que tienen todas sus palabras pueden tenerla; se comprueba
      // leyéndolos.
      const posibles = new Set(ids);
      const leer = lista.filter((c) => posibles.has(c.fm.id) && !fuera.has(c.fm.id)).slice(0, MAX_LEIDOS);
      const textos = await Promise.all(leer.map((c) => this.texto(c.fm.id)));
      leer.forEach((c, j) => {
        if (tieneFrase(textos[j] ?? '', e)) fuera.add(c.fm.id);
      });
    }
    return lista.filter((c) => !fuera.has(c.fm.id));
  }

  /** Deja los que tienen todas las frases, comprobándolo en los mejores candidatos. */
  private async conFrases<T extends { fm: FrontmatterComun }>(lista: T[], frases: readonly string[]): Promise<T[]> {
    const quedan: T[] = [];
    const leer = lista.slice(0, MAX_LEIDOS);
    for (let i = 0; i < leer.length; i += LEIDOS_A_LA_VEZ) {
      const tanda = leer.slice(i, i + LEIDOS_A_LA_VEZ);
      const textos = await Promise.all(tanda.map((c) => this.texto(c.fm.id)));
      tanda.forEach((c, j) => {
        if (frases.every((f) => tieneFrase(textos[j] ?? '', f))) quedan.push(c);
      });
    }
    return quedan;
  }

  private async texto(id: string): Promise<string> {
    const leido = await this.o.repositorio.leerElemento(id).catch(() => null);
    return leido?.ok ? textoDe(leido.valor) : '';
  }

  /** Deja de indexar y guarda lo pendiente. */
  async cerrar(): Promise<void> {
    if (this.cerrado) return;
    this.cerrado = true;
    this.oyentes.clear();
    await this.sincronizando?.catch(() => undefined);
    await this.guardar();
  }
}

/** Recuento de más a menos (a igualdad, por nombre). */
function recuento<T extends string>(valores: Iterable<T>): [T, number][] {
  const n = new Map<T, number>();
  for (const v of valores) n.set(v, (n.get(v) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function facetasDe(lista: readonly FrontmatterComun[]): Facetas {
  return {
    tipos: recuento(lista.map((fm) => fm.tipo)),
    colecciones: recuento(lista.flatMap((fm) => fm.colecciones ?? [])),
    etiquetas: recuento(lista.flatMap((fm) => (fm.etiquetas ?? []).map((e) => e.toLocaleLowerCase()))),
  };
}

/** El empujón del ranking: ×1,25 lo fijado y hasta ×1,25 lo reciente (la mitad cada semana). */
export function empujon(fm: FrontmatterComun, ahora: Date): number {
  const fijado = fm.fijado ? 1.25 : 1;
  const edad = Math.max(0, (ahora.getTime() - instante(fm.creado)) / DIA);
  const reciente = Number.isFinite(edad) ? 1 + 0.25 * 0.5 ** (edad / 7) : 1;
  return fijado * reciente;
}
