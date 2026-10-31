/**
 * Flujo de captura (IN-014, plan §14.5): de lo pegado o soltado a un elemento guardado, siempre en el mismo
 * orden. Sin React ni navegador: el repositorio, el registro, el reloj y la cola de derivados van inyectados.
 */
import {
  analizarRef,
  asignarRef,
  type Elemento,
  type FrontmatterComun,
  fallo,
  hashOriginal,
  isoConZona,
  LIMITE_ORIGINAL_EN_MD,
  ok,
  PREFIJOS,
  type Resultado,
  sha256Hex,
  type TipoElemento,
  ulid,
  utf8,
} from '@rimor/formato';
import { ErrorSoloLectura, type Repositorio } from '../almacen/repositorio';
import type { OpcionesCaptura } from '../espacio/ajustes';
import type { Borrador, Entrada, Lector } from '../lectores/contrato';
import type { ColaDerivados } from '../lectores/derivados';
import type { Registro } from '../lectores/registro';
import { type OpcionesOcultar, ocultar } from '../seguridad/secretos/ocultar';
import { tituloComparable } from '../versiones/parecido';
import { type Candidato, detectar, entradaDeArchivo } from './detector';
import { etiquetasInferidas } from './etiquetas';
import { opcionesDetectar, opcionesOcultar } from './opciones';
import { anteriorDe } from './versiones';

/** Por encima de este tamaño, un archivo se rechaza (ficha IN-014). */
export const LIMITE_ARCHIVO = 50 * 1024 * 1024;
const LARGO_TITULO = 120;
/** Con un tipo forzado, solo se comprueba si contradice al detector en textos de hasta este tamaño. */
export const LARGO_COMPROBAR_TIPO = 1024 * 1024;
/** Tipos cuyo lector trabaja con los bytes del archivo, no con su texto. */
const TIPOS_BINARIOS: ReadonlySet<TipoElemento> = new Set(['archivo', 'imagen', 'pdf']);

export type OrigenCaptura = 'pegado' | 'soltado' | 'compartido';

/** Una captura: un texto o un archivo, con las indicaciones del compositor (IN-015). */
export interface EntradaCaptura {
  texto?: string;
  archivo?: File;
  origen: OrigenCaptura;
  /** Tipo forzado con `/tipo`. */
  tipo?: TipoElemento;
  colecciones?: readonly string[];
  etiquetas?: readonly string[];
  /** Hilo al que pertenece (respuesta en un hilo, IN-030). */
  hilo?: string;
  /** Guardarlo como elemento propio aunque se parezca a uno que ya estaba (no como su versión nueva). */
  aparte?: boolean;
}

export interface EfectosCaptura {
  repositorio: Repositorio;
  registro: Registro;
  reloj?: () => Date;
  nuevoId?: () => string;
  /** Si se da, se piden los derivados en segundo plano (prioridad de fondo). */
  cola?: ColaDerivados;
  secretos?: OpcionesOcultar;
  /** Las opciones de los ajustes de ahora (se leen en cada captura): reglas de secretos y detección (IN-038). */
  opciones?: () => OpcionesCaptura;
}

export interface Capturado {
  elemento: Elemento;
  /** Cuando el detector dudó: el otro tipo posible, para ofrecer el cambio. */
  alternativa?: Candidato;
  /**
   * Con un tipo forzado (`/tipo`) que no es el que habría detectado: el detectado. Es una corrección del tipo (cuenta
   * y enseña, IN-049).
   */
  detectado?: TipoElemento;
  /** Ruta del adjunto si lo creó esta captura (para deshacer). */
  adjuntoNuevo?: string;
  /** Los derivados que se están calculando, para la respuesta de Rimor (IN-016). */
  derivados?: Promise<unknown>;
}

/** Una captura que se guardó como versión nueva de un elemento que ya estaba (CMP-02). */
export interface VersionCapturada {
  /** El elemento con su versión nueva. */
  capturado: Capturado;
  version: number;
  /** La copia de la versión anterior en el historial (para deshacer). */
  copia: string;
  /** Lo que se capturó, para guardarlo aparte si no era una versión. */
  entrada: EntradaCaptura;
}

export type ResultadoCaptura =
  | { tipo: 'creado'; capturado: Capturado }
  | { tipo: 'duplicado'; ref: string }
  | ({ tipo: 'version' } & VersionCapturada);

/** Primera línea con contenido, recortada. */
function primeraLinea(texto: string): string {
  return (texto.split(/\r?\n/).find((l) => l.trim()) ?? '').trim();
}

const recortar = (t: string) => (t.length > LARGO_TITULO ? `${t.slice(0, LARGO_TITULO - 1)}…` : t);

const extension = (nombre: string) => /\.([a-z0-9]{1,10})$/i.exec(nombre)?.[1] ?? '';

/** Sin repetir y sin vacíos, en su orden. */
const unicos = (xs: readonly string[] | undefined) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];

/** Sin repetir aunque cambien las mayúsculas, quedándose con la primera (la manual, que va antes). */
function unicasSinMayusculas(xs: readonly string[]): string[] {
  const vistas = new Set<string>();
  return unicos(xs).filter((x) => {
    const clave = x.toLocaleLowerCase();
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function lectorPara(
  registro: Registro,
  tipo: TipoElemento | undefined,
  detectado: string | null,
  binario: boolean,
): Lector | undefined {
  const delTipo = tipo ? registro.deTipo(tipo) : undefined;
  const elegido = delTipo ?? (detectado && !tipo ? registro.porNombre(detectado) : undefined);
  // De reserva: el genérico para binarios y Texto para lo demás.
  return elegido ?? registro.deTipo(binario ? 'archivo' : 'texto');
}

/**
 * Captura una entrada. Los pasos, en este orden: normalizar, ocultar secretos, detectar, comprobar el
 * duplicado exacto, aplicar indicaciones, `leer` y escribir, publicar (el repositorio avisa) y derivar.
 */
export async function capturar(entrada: EntradaCaptura, efectos: EfectosCaptura): Promise<Resultado<ResultadoCaptura>> {
  try {
    return await pasos(entrada, efectos);
  } catch (e) {
    // Otra pestaña escribe: no es un error de la captura, sino algo que se dice.
    if (e instanceof ErrorSoloLectura) return fallo('almacen.soloLectura');
    throw e;
  }
}

async function pasos(entrada: EntradaCaptura, efectos: EfectosCaptura): Promise<Resultado<ResultadoCaptura>> {
  const { repositorio, registro, cola } = efectos;
  const reloj = efectos.reloj ?? (() => new Date());
  const opciones = efectos.opciones?.();
  // Otra pestaña escribe: ni se lee el archivo ni se busca el duplicado.
  if (!repositorio.escribible()) return fallo('almacen.soloLectura');

  // 1. Normalizar: un archivo se lee entero; si es texto, también como texto.
  let texto = entrada.texto;
  let bytes: Uint8Array | null = null;
  let cabecera: Uint8Array | undefined;
  let leidos: Uint8Array | null = null;
  const archivo = entrada.archivo;
  if (archivo) {
    if (archivo.size > LIMITE_ARCHIVO)
      return fallo('captura.demasiadoGrande', { nombre: archivo.name, tam: archivo.size, limite: LIMITE_ARCHIVO });
    leidos = new Uint8Array(await archivo.arrayBuffer());
    const e = entradaDeArchivo(archivo.name, archivo.type, leidos);
    cabecera = e.cabecera;
    if (e.entrada.texto !== undefined) texto = e.entrada.texto;
    else bytes = leidos;
  }
  if (!bytes && !texto?.trim()) return fallo('captura.vacia');

  // 2. Ocultar secretos, antes de nada más: ni el detector ni el lector ven el texto original.
  let ocultados = 0;
  if (texto !== undefined) {
    const r = ocultar(texto, efectos.secretos ?? opcionesOcultar(opciones));
    texto = r.texto;
    ocultados = r.hallados.length;
  }

  // Lo que ven el detector y el lector. Un archivo de texto viaja ya con los secretos ocultados.
  const nombre = archivo?.name;
  let vista: Entrada = {
    ...(texto !== undefined ? { texto } : {}),
    ...(nombre ? { nombre } : {}),
    ...(archivo?.type ? { mime: archivo.type } : {}),
    ...(archivo ? { archivos: [bytes ? archivo : new File([texto ?? ''], archivo.name, { type: archivo.type })] } : {}),
  };

  // 3. Detectar, salvo que el tipo venga forzado. Con el tipo forzado (y con lector) se detecta solo para saber si lo
  // corrige, y solo si no es enorme: con 50 MB serían segundos de más por un recuento.
  const opcionesDeteccion = { ...opcionesDetectar(opciones), ...(cabecera ? { cabecera } : {}) };
  const deteccion = entrada.tipo ? null : detectar(vista, registro, opcionesDeteccion);
  const comprobar =
    entrada.tipo &&
    registro.deTipo(entrada.tipo) &&
    (texto?.length ?? Number.POSITIVE_INFINITY) <= LARGO_COMPROBAR_TIPO;
  const detectada = comprobar ? detectar(vista, registro, opcionesDeteccion) : null;
  // Solo contradice al detector si estaba convencido de otra cosa (no si nada le convencía y habría sido Texto).
  const detectado =
    detectada && detectada.via !== 'por-defecto' && detectada.tipo !== entrada.tipo ? detectada.tipo : undefined;
  const lector = lectorPara(registro, entrada.tipo, deteccion?.lector ?? null, bytes !== null);
  if (!lector) return fallo('captura.sinLector', { tipo: entrada.tipo ?? deteccion?.tipo ?? 'texto' });

  // Un archivo de texto que va a un lector de binarios (un SVG con MIME de imagen) se guarda tal cual: su
  // adjunto debe ser el original, byte a byte (como cualquier binario, no pasa por la ocultación).
  if (archivo && !bytes && leidos && TIPOS_BINARIOS.has(lector.tipo)) {
    bytes = leidos;
    texto = undefined;
    ocultados = 0;
    vista = { nombre: archivo.name, archivos: [archivo], ...(archivo.type ? { mime: archivo.type } : {}) };
  }

  // 4. Duplicado exacto: mismo original que un elemento que no está en la papelera.
  const hash: FrontmatterComun['hash'] = bytes ? `sha256:${sha256Hex(bytes)}` : hashOriginal(texto ?? '');
  const existente = repositorio.porHash(hash);
  if (existente) return ok({ tipo: 'duplicado', ref: existente.ref });

  // 5. Indicaciones del compositor.
  const colecciones = unicos(entrada.colecciones);
  const etiquetas = unicos(entrada.etiquetas);

  // 6. Leer y escribir (la ref se asigna aquí: el capturador serializa las capturas).
  // Un lector que falla al leer no puede hacer perder lo capturado: se guarda con lo mínimo (título y original)
  // y su derivado dirá que no pudo analizarlo.
  const borrador: Borrador = await lector.leer(vista).catch(() => ({
    titulo: '',
    original: bytes ? null : (texto ?? null),
  }));
  const ahora = isoConZona(reloj());
  const tipo = entrada.tipo ?? lector.tipo;
  // Las manuales (`#` del compositor) y las que Rimor infiere (hashtags, dominios, paquetes, lenguaje, niveles).
  const conInferidas = unicasSinMayusculas([
    ...etiquetas,
    ...(bytes ? [] : etiquetasInferidas({ texto: texto ?? '', tipo, resumen: borrador.resumen ?? {} })),
  ]);

  // 6b. ¿Es la versión nueva de un prompt, un documento o un código que ya estaba? Entonces se guarda en él (la
  // anterior, al historial) en vez de crear otro. Lo grande (que va como adjunto) y lo pedido aparte, no.
  const textoVersion = borrador.original === undefined ? texto : borrador.original;
  if (
    !entrada.aparte &&
    !bytes &&
    !borrador.archivo &&
    textoVersion &&
    utf8(textoVersion).length <= LIMITE_ORIGINAL_EN_MD
  ) {
    const propio = tituloComparable((lector.textos.t as (i: 'es', c: string) => string)('es', 'titulo'));
    const generico = (titulo: string) =>
      tituloComparable(titulo) === propio || (lector.tituloGenerico?.(titulo) ?? false);
    // Del mismo lector: el que lo leería hoy (un elemento cuyo lector ya no existe, el de su tipo).
    const mismoLector = (fm: FrontmatterComun) => registro.paraElemento({ frontmatter: fm })?.nombre === lector.nombre;
    const anterior = lector.sinVersiones
      ? null
      : await anteriorDe(textoVersion, borrador.titulo, { tipo, mismoLector }, repositorio, generico);
    if (anterior) {
      const hilo =
        entrada.hilo && analizarRef(entrada.hilo)?.prefijo === PREFIJOS.hilo
          ? { hilo: entrada.hilo as FrontmatterComun['ref'] }
          : {};
      const r = await repositorio.guardarConHistorial(
        anterior.id,
        (el) => {
          // Sobre lo que hay al escribir (en el turno del elemento), no sobre lo leído antes.
          const colecciones = unicos([...(el.frontmatter.colecciones ?? []), ...(entrada.colecciones ?? [])]);
          // Solo las que se escribieron ahora: las inferidas que el usuario quitó no vuelven con otra versión.
          const etiquetas = unicasSinMayusculas([...(el.frontmatter.etiquetas ?? []), ...unicos(entrada.etiquetas)]);
          return {
            ...el,
            original: textoVersion,
            frontmatter: {
              // Lo propio del lector de esta versión (el nombre de un archivo de agente) y lo común encima.
              ...(borrador.metadatos ?? {}),
              ...el.frontmatter,
              modificado: ahora,
              origen: entrada.origen,
              hash,
              ocultados,
              lector: { nombre: lector.nombre, version: lector.version, resumen: borrador.resumen ?? {} },
              ...(colecciones.length ? { colecciones } : {}),
              ...(etiquetas.length ? { etiquetas } : {}),
              // Ya en un hilo, se queda en el suyo (D13: moverlo pide confirmación).
              ...(el.frontmatter.hilo ? {} : hilo),
            },
          };
        },
        'version',
        reloj,
      );
      if (!r.ok) return r;
      const leido = await repositorio.leerElemento(anterior.id);
      if (!leido.ok) return leido;
      if (r.valor.copia) {
        const derivados = cola?.pedir(leido.valor, { prioridad: 'fondo' });
        derivados?.catch(() => undefined);
        return ok({
          tipo: 'version',
          capturado: { elemento: leido.valor, ...(derivados ? { derivados } : {}) },
          version: r.valor.version,
          copia: r.valor.copia,
          entrada,
        });
      }
    }
  }

  const ref = asignarRef(tipo, repositorio.refs());
  // `original: null` en el borrador es que el lector lo quiere como adjunto (su `archivo` o el texto).
  let original: string | null = borrador.original === undefined ? (texto ?? null) : borrador.original;
  let adjunto: FrontmatterComun['adjunto'];
  let adjuntoNuevo: string | undefined;
  const delLector = borrador.archivo ? new Uint8Array(await borrador.archivo.arrayBuffer()) : null;
  const textoAparte = original === null && texto !== undefined ? utf8(texto) : null;
  const grande = original !== null && utf8(original).length > LIMITE_ORIGINAL_EN_MD ? utf8(original) : null;
  const aAdjuntar = bytes ?? delLector ?? textoAparte ?? grande;
  const nombreAdjunto = borrador.archivo?.name ?? nombre ?? '';
  if (aAdjuntar) {
    const g = await repositorio.guardarAdjunto(aAdjuntar, bytes || delLector ? extension(nombreAdjunto) : 'txt');
    if (g.nuevo) adjuntoNuevo = g.ruta;
    const mime = borrador.archivo?.type || archivo?.type || (bytes ? '' : 'text/plain');
    adjunto = {
      hash: g.hash,
      ruta: g.ruta,
      ...(nombreAdjunto ? { nombre: nombreAdjunto } : {}),
      ...(mime ? { mime } : {}),
      tam: aAdjuntar.length,
    };
    original = null;
  }

  const titulo = recortar(borrador.titulo.trim() || nombre || primeraLinea(texto ?? '') || ref);

  const frontmatter: FrontmatterComun = {
    // Lo propio del lector primero: no puede pisar los campos comunes.
    ...(borrador.metadatos ?? {}),
    id: (efectos.nuevoId ?? ulid)(),
    ref,
    tipo,
    titulo,
    creado: ahora,
    modificado: ahora,
    origen: entrada.origen,
    hash,
    ocultados,
    lector: { nombre: lector.nombre, version: lector.version, resumen: borrador.resumen ?? {} },
    ...(colecciones.length ? { colecciones } : {}),
    ...(conInferidas.length ? { etiquetas: conInferidas } : {}),
    // Solo una ref de hilo válida: otra cosa dejaría el archivo ilegible al releerlo.
    ...(entrada.hilo && analizarRef(entrada.hilo)?.prefijo === PREFIJOS.hilo
      ? { hilo: entrada.hilo as FrontmatterComun['ref'] }
      : {}),
    ...(adjunto ? { adjunto } : {}),
  };
  const elemento: Elemento = { frontmatter, notas: '', original };
  try {
    await repositorio.guardarElemento(elemento);
  } catch (e) {
    // Sin elemento, el adjunto recién creado sobraría.
    if (adjuntoNuevo) await repositorio.borrarAdjunto(adjuntoNuevo).catch(() => undefined);
    throw e;
  }

  // 7. Publicar: el repositorio ya avisó del cambio; quien llama pinta el elemento con su resumen.
  // 8. Derivar en segundo plano; la respuesta de Rimor (IN-016) espera a estos datos.
  const derivados = cola?.pedir(elemento, { prioridad: 'fondo' });
  derivados?.catch(() => undefined);

  return ok({
    tipo: 'creado',
    capturado: {
      elemento,
      ...(deteccion?.alternativa ? { alternativa: deteccion.alternativa } : {}),
      ...(detectado ? { detectado } : {}),
      ...(adjuntoNuevo ? { adjuntoNuevo } : {}),
      ...(derivados ? { derivados } : {}),
    },
  });
}

/**
 * Deshace una captura recién hecha: borra el elemento y su adjunto si nadie más lo usa. No toca nada si el
 * elemento ya no está como se capturó (se editó, se movió a la papelera o ya no existe). Devuelve si deshizo.
 */
export async function deshacerCaptura(c: Capturado, repositorio: Repositorio): Promise<boolean> {
  const fm = c.elemento.frontmatter;
  const actual = repositorio.frontmatter(fm.id);
  const entrada = repositorio.buscar(fm.id);
  if (!actual || !entrada || entrada.enPapelera || actual.modificado !== fm.modificado || actual.hash !== fm.hash)
    return false;
  const borrado = await repositorio.borrarElemento(fm.id);
  if (borrado && c.adjuntoNuevo) await repositorio.borrarAdjunto(c.adjuntoNuevo);
  return borrado;
}

/**
 * Deshace una captura que se guardó como versión nueva: la anterior vuelve a ser el elemento (y su copia sale del
 * historial). No toca nada si el elemento se cambió después. Devuelve si deshizo.
 */
export function deshacerVersion(v: VersionCapturada, repositorio: Repositorio): Promise<boolean> {
  const fm = v.capturado.elemento.frontmatter;
  return repositorio.deshacerHistorial(fm.id, v.copia, {
    hash: fm.hash,
    version: v.version,
    modificado: fm.modificado,
  });
}

/**
 * Capturador: las capturas van de una en una (la ref se asigna y se guarda en el mismo turno), así 20 pegados
 * seguidos dan 20 elementos con refs distintas. Un fallo no detiene las siguientes.
 */
export function crearCapturador(efectos: EfectosCaptura) {
  let turno: Promise<unknown> = Promise.resolve();
  return {
    capturar(entrada: EntradaCaptura): Promise<Resultado<ResultadoCaptura>> {
      const r = turno.then(() => capturar(entrada, efectos));
      turno = r.catch(() => undefined);
      return r;
    },
    deshacer: (c: Capturado): Promise<boolean> => deshacerCaptura(c, efectos.repositorio),
    deshacerVersion: (v: VersionCapturada): Promise<boolean> => deshacerVersion(v, efectos.repositorio),
  };
}

export type Capturador = ReturnType<typeof crearCapturador>;
