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
import { type ApiIndice, claveIndice, type DocumentoBusqueda, type Indexado, MAX_INDEXADO } from './contrato';

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
  /** Con frases, solo se comprueban los mejores candidatos: el total es «al menos». */
  aproximado: boolean;
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
  /** Lo que el lector deriva para buscar (`textoIndexable`); vacío si no hay. Lanza si no se pudo derivar. */
  indexable?: (el: Elemento) => Promise<string>;
  /** El texto de un original que va como adjunto (más de 2 MB); `null` si no es texto. */
  cargarOriginal?: (el: Elemento) => Promise<string | null>;
  /** El lector vigente de un elemento (`nombre@version`), para la clave del índice. */
  lectorVigente?: (fm: FrontmatterComun) => string | undefined;
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

/** Solo letras y cifras separadas por un espacio, con un espacio a cada lado: así una frase casa por palabras. */
const enPalabras = (s: string) =>
  ` ${normalizarBusqueda(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;

/** El texto en que se comprueba una frase: el título, la ref, las etiquetas, las notas y el principio del original. */
function textoDe(el: Elemento, original: string): string {
  const fm = el.frontmatter;
  return enPalabras(
    [fm.titulo, fm.ref, ...(fm.etiquetas ?? []), el.notas, original.slice(0, MAX_TEXTO_FRASE)].join('\n'),
  );
}

/** Una palabra tal cual la guarda el índice (sin espacios ni signos). */
const esPalabra = (s: string) => /^[\p{L}\p{N}]+$/u.test(s);

/** La frase está, palabra por palabra («read timeout» no casa con «thread timeouts»). Sin palabras, sí. */
function tieneFrase(texto: string, frase: string): boolean {
  const buscada = enPalabras(frase);
  return buscada === '  ' || texto.includes(buscada);
}

/** Los textos de frase ya leídos (por elemento y versión): escribir dentro de comillas repite la búsqueda. */
const MAX_TEXTOS = 400;

/** Error de una búsqueda que se cortó porque llegó otra. */
const cortada = () => new DOMException('Cortada', 'AbortError');

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
  /** Lo que ya se intentó indexar en esta sesión y quedó incompleto (lectura o derivado fallidos), por su clave. */
  private readonly incompletos = new Map<string, string>();
  private readonly textos = new Map<string, string>();

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
        try {
          await this.sincronizarAhora();
        } catch {
          // El índice falló (su Worker murió): se queda lo que hay y se reintenta con el próximo cambio.
          this.ponerEstado({ fase: 'listo' });
        }
      } while (this.otraVez && !this.cerrado);
    })().finally(() => {
      this.sincronizando = null;
    });
    return this.sincronizando;
  }

  /**
   * Olvida lo indexado y lo rehace: cuando el índice se perdió (su Worker no cargó o murió y ahora está en este
   * hilo, vacío).
   */
  rehacer(): Promise<void> {
    this.claves.clear();
    this.incompletos.clear();
    return this.sincronizar();
  }

  private clave(fm: FrontmatterComun): string {
    return claveIndice(fm, this.o.lectorVigente?.(fm));
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
      .filter((fm) => {
        const clave = this.clave(fm);
        return this.claves.get(fm.id) !== clave && this.incompletos.get(fm.id) !== clave;
      })
      .sort((a, b) => instante(b.modificado) - instante(a.modificado));
    for (let i = 0; i < faltan.length && !this.cerrado; i += TANDA) {
      this.ponerEstado({ fase: 'indexando', hechos: i, total: faltan.length });
      const tanda = (await Promise.all(faltan.slice(i, i + TANDA).map((fm) => this.documento(fm)))).filter(
        (d): d is Indexado => d !== null,
      );
      if (!tanda.length) continue;
      await this.o.api.poner(tanda);
      for (const { doc, clave } of tanda) {
        // Lo incompleto se guarda con una clave que nunca coincide: al abrir otra vez se reintenta; en esta sesión,
        // no (hasta que cambie).
        const real = clave.replace(/~$/, '');
        this.claves.set(doc.id, clave);
        if (real !== clave) this.incompletos.set(doc.id, real);
        else this.incompletos.delete(doc.id);
      }
      this.sucio = true;
    }
    this.ponerEstado({ fase: 'listo' });
    if (this.sucio) this.programarGuardado();
  }

  /** El original como texto: el del archivo o, si va como adjunto, el del adjunto (si es texto). */
  private async original(el: Elemento): Promise<string> {
    if (el.original !== null) return el.original;
    if (!el.frontmatter.adjunto || !this.o.cargarOriginal) return '';
    return (await this.o.cargarOriginal(el)) ?? '';
  }

  /**
   * Lo que se indexa de un elemento (leído del espacio); `null` si ya no está. Si algo falla (el archivo, el
   * adjunto o el derivado), se indexa lo que haya y la clave lleva `~`: incompleto.
   */
  private async documento(fm: FrontmatterComun): Promise<Indexado | null> {
    let completo = true;
    const leido = await this.o.repositorio.leerElemento(fm.id).catch(() => null);
    if (!leido?.ok) completo = false;
    // Si el archivo no se puede leer, al menos lo del frontmatter.
    const el: Elemento = leido?.ok ? leido.valor : { frontmatter: fm, notas: '', original: null };
    if (el.frontmatter.id !== fm.id) return null;
    let cuerpo = '';
    let indexable = '';
    try {
      cuerpo = (await this.original(el)).slice(0, MAX_INDEXADO);
    } catch {
      completo = false;
    }
    try {
      indexable = (await this.o.indexable?.(el)) ?? '';
    } catch {
      completo = false;
    }
    const f = el.frontmatter;
    const doc: DocumentoBusqueda = {
      id: f.id,
      titulo: f.titulo,
      ref: f.ref,
      etiquetas: (f.etiquetas ?? []).join(' '),
      notas: el.notas,
      cuerpo,
      indexable,
    };
    return { doc, clave: `${this.clave(f)}${completo ? '' : '~'}` };
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

  /**
   * Busca. `senal` corta una búsqueda que ya no hace falta (llegó otra): se rechaza con `AbortError` antes de leer
   * más archivos.
   */
  async buscar(
    texto: string,
    { ahora = this.o.reloj?.() ?? new Date(), senal }: { ahora?: Date; senal?: AbortSignal } = {},
  ): Promise<Busqueda> {
    const consulta = analizarConsulta(texto, { ahora });
    const vacia: Busqueda = { consulta, total: 0, aproximado: false, resultados: [], facetas: facetasDe([]) };
    if (consulta.imposible || !hayConsulta(consulta)) return vacia;
    await this.cargado;
    const seguir = () => {
      if (senal?.aborted) throw cortada();
    };

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
      const aciertos = await this.o.api.buscar(palabras, consulta.excluir.filter(esPalabra));
      seguir();
      for (const a of aciertos) {
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
      seguir,
    );
    // Las frases se comprueban en los mejores candidatos: si había más, el total es aproximado (al menos).
    const aproximado = consulta.frases.length > 0 && candidatos.length > MAX_LEIDOS;
    if (consulta.frases.length) candidatos = await this.conFrases(candidatos, consulta.frases, seguir);
    return {
      consulta,
      total: candidatos.length,
      aproximado,
      facetas: facetasDe(candidatos.map((c) => c.fm)),
      resultados: candidatos
        .slice(0, MAX_RESULTADOS)
        .map(({ fm, terminos, enContenido }) => ({ fm, terminos, enContenido })),
    };
  }

  /** Quita lo que contiene alguna palabra o frase excluida (las frases, comprobadas en todos los que podrían). */
  private async excluir<T extends { fm: FrontmatterComun }>(
    lista: T[],
    excluir: readonly string[],
    seguir: () => void,
  ): Promise<T[]> {
    if (!excluir.length || !lista.length) return lista;
    const fuera = new Set<string>();
    for (const e of excluir) {
      const palabras = buscables(e.split(/\s+/));
      if (!palabras.length) continue;
      const ids = await this.o.api.conPalabras(palabras);
      seguir();
      // Una palabra tal cual la guarda el índice: fuera todos los que la tienen.
      if (esPalabra(e)) {
        for (const id of ids) fuera.add(id);
        continue;
      }
      // Una frase (o una palabra con signos): solo los que tienen todas sus palabras pueden tenerla; se comprueba
      // leyéndolos.
      const posibles = new Set(ids);
      const leer = lista.filter((c) => posibles.has(c.fm.id) && !fuera.has(c.fm.id));
      await this.porTandas(leer, seguir, (c, texto) => {
        if (tieneFrase(texto, e)) fuera.add(c.fm.id);
      });
    }
    return lista.filter((c) => !fuera.has(c.fm.id));
  }

  /** Deja los que tienen todas las frases, comprobándolo en los mejores candidatos. */
  private async conFrases<T extends { fm: FrontmatterComun }>(
    lista: T[],
    frases: readonly string[],
    seguir: () => void,
  ): Promise<T[]> {
    const quedan: T[] = [];
    await this.porTandas(lista.slice(0, MAX_LEIDOS), seguir, (c, texto) => {
      if (frases.every((f) => tieneFrase(texto, f))) quedan.push(c);
    });
    return quedan;
  }

  /** Lee los textos de frase de una lista, unos cuantos a la vez, en orden, parando si la búsqueda se corta. */
  private async porTandas<T extends { fm: FrontmatterComun }>(
    lista: readonly T[],
    seguir: () => void,
    cada: (c: T, texto: string) => void,
  ): Promise<void> {
    for (let i = 0; i < lista.length; i += LEIDOS_A_LA_VEZ) {
      seguir();
      const tanda = lista.slice(i, i + LEIDOS_A_LA_VEZ);
      const textos = await Promise.all(tanda.map((c) => this.texto(c.fm)));
      for (const [j, c] of tanda.entries()) cada(c, textos[j] ?? '');
    }
    seguir();
  }

  /** El texto de frase de un elemento, de la memoria si ya se leyó esa misma versión. */
  private async texto(fm: FrontmatterComun): Promise<string> {
    const clave = `${fm.id}|${claveIndice(fm)}`;
    const guardado = this.textos.get(clave);
    if (guardado !== undefined) return guardado;
    const leido = await this.o.repositorio.leerElemento(fm.id).catch(() => null);
    if (!leido?.ok) return '';
    const texto = textoDe(leido.valor, await this.original(leido.valor).catch(() => ''));
    if (this.textos.size >= MAX_TEXTOS) this.textos.delete(this.textos.keys().next().value ?? '');
    this.textos.set(clave, texto);
    return texto;
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
