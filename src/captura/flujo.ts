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
import type { Entrada, Lector } from '../lectores/contrato';
import type { ColaDerivados } from '../lectores/derivados';
import type { Registro } from '../lectores/registro';
import { type OpcionesOcultar, ocultar } from '../seguridad/secretos/ocultar';
import { type Candidato, detectar, entradaDeArchivo } from './detector';

/** Por encima de este tamaño, un archivo se rechaza (ficha IN-014). */
export const LIMITE_ARCHIVO = 50 * 1024 * 1024;
const LARGO_TITULO = 120;
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
}

export interface EfectosCaptura {
  repositorio: Repositorio;
  registro: Registro;
  reloj?: () => Date;
  nuevoId?: () => string;
  /** Si se da, se piden los derivados en segundo plano (prioridad de fondo). */
  cola?: ColaDerivados;
  secretos?: OpcionesOcultar;
}

export interface Capturado {
  elemento: Elemento;
  /** Cuando el detector dudó: el otro tipo posible, para ofrecer el cambio. */
  alternativa?: Candidato;
  /** Ruta del adjunto si lo creó esta captura (para deshacer). */
  adjuntoNuevo?: string;
  /** Los derivados que se están calculando, para la respuesta de Rimor (IN-016). */
  derivados?: Promise<unknown>;
}

export type ResultadoCaptura = { tipo: 'creado'; capturado: Capturado } | { tipo: 'duplicado'; ref: string };

/** Primera línea con contenido, recortada. */
function primeraLinea(texto: string): string {
  return (texto.split(/\r?\n/).find((l) => l.trim()) ?? '').trim();
}

const recortar = (t: string) => (t.length > LARGO_TITULO ? `${t.slice(0, LARGO_TITULO - 1)}…` : t);

const extension = (nombre: string) => /\.([a-z0-9]{1,10})$/i.exec(nombre)?.[1] ?? '';

/** Sin repetir y sin vacíos, en su orden. */
const unicos = (xs: readonly string[] | undefined) => [...new Set((xs ?? []).map((x) => x.trim()).filter(Boolean))];

function lectorPara(
  registro: Registro,
  tipo: TipoElemento | undefined,
  detectado: string | null,
  binario: boolean,
): Lector | undefined {
  const delTipo = tipo ? registro.lectores.find((l) => l.tipo === tipo) : undefined;
  const elegido = delTipo ?? (detectado && !tipo ? registro.porNombre(detectado) : undefined);
  // De reserva: el genérico para binarios y Texto para lo demás.
  return elegido ?? registro.lectores.find((l) => l.tipo === (binario ? 'archivo' : 'texto'));
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
    const r = ocultar(texto, efectos.secretos);
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

  // 3. Detectar, salvo que el tipo venga forzado.
  const deteccion = entrada.tipo ? null : detectar(vista, registro, cabecera ? { cabecera } : {});
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
  const borrador = await lector.leer(vista);
  const ahora = isoConZona(reloj());
  const tipo = entrada.tipo ?? lector.tipo;
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
    ...(etiquetas.length ? { etiquetas } : {}),
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
  };
}

export type Capturador = ReturnType<typeof crearCapturador>;
