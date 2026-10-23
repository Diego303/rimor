/**
 * Leer un paquete para importarlo (DAT-04, SEG-04): un ZIP o el JSON único de IN-035, convertido en sus archivos
 * y validado entero **antes de escribir nada**: el ZIP (rutas, tamaños, número, bombas, CRC, enlaces simbólicos),
 * el `manifest.json`, los hashes de cada archivo y el esquema de los elementos, las entidades y las colecciones.
 * El primer fallo para, con su regla y su archivo. TS puro.
 */
import {
  ESQUEMA_ACTUAL,
  leerColecciones,
  leerElemento,
  leerEntidad,
  leerManifest,
  type Manifest,
  migrar,
  unir,
} from '@rimor/formato';
import { fueraDeLaExportacion, RUTA_MANIFEST_EXPORTADO, sha256 } from '../exportar';
import { ErrorZip, entradasZip, LIMITES_ZIP, type LimitesZip, leerEntrada, rutaSegura, trozosDe } from '../leerZip';

/** Un rechazo: la regla (`zip.rutaInsegura`, `importar.hash`…) y el archivo que la ha provocado. */
export class ErrorImportar extends Error {
  constructor(
    public readonly codigo: string,
    public readonly ruta?: string,
  ) {
    super(ruta ? `${codigo}: ${ruta}` : codigo);
    this.name = 'ErrorImportar';
  }
}

export interface Paquete {
  origen: 'zip' | 'json';
  manifest: Manifest;
  /** Los archivos que se importan (sin `manifest.json` ni lo que nunca se importa). */
  archivos: Map<string, Uint8Array>;
  /** Lo que conviene saber aunque no impida importar (`importar.sinHashes`). */
  avisos: string[];
}

const texto = (d: Uint8Array) => new TextDecoder().decode(d);
const bytes = (s: string) => new TextEncoder().encode(s);

/** Lo que nunca se importa (como no se exporta): la caché y el diario de una operación cortada. */
const ignorada = (ruta: string) => fueraDeLaExportacion(ruta) && ruta !== RUTA_MANIFEST_EXPORTADO;

/** Los archivos de un ZIP, validados por `leerZip`, sin enlaces simbólicos ni carpetas. */
async function archivosDeZip(fuente: Blob | Uint8Array, limites: LimitesZip): Promise<Map<string, Uint8Array>> {
  const { tam, leer } = trozosDe(fuente);
  const archivos = new Map<string, Uint8Array>();
  try {
    const entradas = await entradasZip(tam, leer, limites);
    for (const e of entradas) if (e.enlace) throw new ErrorImportar('zip.enlace', e.ruta);
    for (const e of entradas) {
      if (e.carpeta || ignorada(e.ruta)) continue;
      archivos.set(e.ruta, await leerEntrada(e, leer));
    }
  } catch (e) {
    if (e instanceof ErrorZip) throw new ErrorImportar(e.codigo, e.ruta);
    throw e;
  }
  return archivos;
}

const esTexto = (x: unknown): x is string => typeof x === 'string';

/** Base64 a bytes; `null` si no lo es. */
function deBase64(s: unknown): Uint8Array | null {
  if (!esTexto(s)) return null;
  try {
    const binario = atob(s);
    return Uint8Array.from(binario, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Los archivos del JSON único: los mismos que su ZIP (`yaml` + `cuerpo`, base64, texto), con las mismas reglas. */
function archivosDeJson(contenido: string, limites: LimitesZip): Map<string, Uint8Array> {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(contenido);
  } catch {
    throw new ErrorImportar('importar.jsonRoto');
  }
  if (!json || typeof json !== 'object' || !json.manifest) throw new ErrorImportar('importar.jsonRoto');
  const archivos = new Map<string, Uint8Array>();
  let total = 0;
  const poner = (ruta: unknown, datos: Uint8Array | null) => {
    if (!esTexto(ruta) || !rutaSegura(ruta) || ruta.endsWith('/'))
      throw new ErrorImportar('zip.rutaInsegura', esTexto(ruta) ? ruta : undefined);
    if (!datos) throw new ErrorImportar('importar.jsonRoto', ruta);
    if (archivos.has(ruta)) throw new ErrorImportar('zip.rutaRepetida', ruta);
    total += datos.length;
    if (archivos.size + 1 > limites.archivos) throw new ErrorImportar('zip.demasiadosArchivos');
    if (total > limites.total) throw new ErrorImportar('zip.demasiadoGrande', ruta);
    if (!ignorada(ruta)) archivos.set(ruta, datos);
  };
  const lista = (x: unknown) => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);
  poner(RUTA_MANIFEST_EXPORTADO, bytes(`${JSON.stringify(json.manifest, null, 2)}\n`));
  for (const e of lista(json.elementos))
    poner(e.ruta, esTexto(e.yaml) && esTexto(e.cuerpo) ? bytes(unir(e.yaml, e.cuerpo)) : null);
  for (const a of lista(json.adjuntos)) poner(a.ruta, deBase64(a.base64));
  for (const a of lista(json.archivos)) poner(a.ruta, esTexto(a.texto) ? bytes(a.texto) : deBase64(a.base64));
  return archivos;
}

/** El manifest del paquete: de Rimor y de un esquema que esta app entiende. */
function manifestDe(archivos: Map<string, Uint8Array>): Manifest {
  const datos = archivos.get(RUTA_MANIFEST_EXPORTADO);
  if (!datos) throw new ErrorImportar('importar.sinManifest');
  const manifest = leerManifest(texto(datos));
  if (!manifest) throw new ErrorImportar('importar.manifest', RUTA_MANIFEST_EXPORTADO);
  if (manifest.esquema > ESQUEMA_ACTUAL) throw new ErrorImportar('importar.esquemaNuevo', RUTA_MANIFEST_EXPORTADO);
  return manifest;
}

/**
 * Cada archivo que el manifest lista está y su hash casa, y no hay ninguno que no liste (los adjuntos excluidos
 * de un JSON no están, y se dice). Sin hashes (un manifest hecho a mano), se avisa.
 */
async function comprobarHashes(manifest: Manifest, archivos: Map<string, Uint8Array>, avisos: string[]) {
  const hashes = manifest.hashes?.archivos;
  if (!hashes) {
    avisos.push('importar.sinHashes');
    return;
  }
  const excluidos = new Set(manifest.adjuntos_excluidos ?? []);
  for (const [ruta, hash] of Object.entries(hashes)) {
    const datos = archivos.get(ruta);
    if (!datos) {
      if (!excluidos.has(ruta)) throw new ErrorImportar('importar.falta', ruta);
      continue;
    }
    if ((await sha256(datos)) !== hash) throw new ErrorImportar('importar.hash', ruta);
  }
  for (const ruta of archivos.keys())
    if (ruta !== RUTA_MANIFEST_EXPORTADO && !Object.hasOwn(hashes, ruta))
      throw new ErrorImportar('importar.sobra', ruta);
  if (excluidos.size) avisos.push('importar.conExcluidos');
}

const esElemento = (r: string) => /^(papelera\/)?elementos\/.+\.md$/.test(r);
const esEntidad = (r: string) => /^(comparaciones|hilos)\/.+\.md$/.test(r);

/**
 * El esquema de lo que tiene uno (elementos, entidades y el registro de colecciones), y que ningún `id` ni ninguna ref
 * se repita (el mismo elemento en `elementos/` y en la papelera, dos con la misma ref).
 */
function comprobarEsquemas(archivos: Map<string, Uint8Array>) {
  const ids = new Set<string>();
  const refs = new Set<string>();
  const unico = (id: string, ref: string, ruta: string) => {
    if (ids.has(id)) throw new ErrorImportar('importar.idRepetido', ruta);
    if (refs.has(ref)) throw new ErrorImportar('importar.refRepetida', ruta);
    ids.add(id);
    refs.add(ref);
  };
  for (const [ruta, datos] of archivos) {
    if (esElemento(ruta)) {
      const el = leerElemento(texto(datos));
      if (!el.ok) throw new ErrorImportar('importar.elemento', ruta);
      unico(el.valor.frontmatter.id, el.valor.frontmatter.ref, ruta);
    }
    if (esEntidad(ruta)) {
      const entidad = leerEntidad(texto(datos));
      if (!entidad.ok) throw new ErrorImportar('importar.entidad', ruta);
      unico(entidad.valor.frontmatter.id, entidad.valor.frontmatter.ref, ruta);
    }
    if (ruta === 'colecciones.json' && leerColecciones(texto(datos)) === null)
      throw new ErrorImportar('importar.colecciones', ruta);
  }
}

/** Ningún archivo del paquete está donde otro necesita una carpeta (`a` y `a/b`). */
function comprobarCarpetas(archivos: Map<string, Uint8Array>) {
  for (const ruta of archivos.keys()) {
    const partes = ruta.split('/');
    for (let i = 1; i < partes.length; i++) {
      const carpeta = partes.slice(0, i).join('/');
      if (archivos.has(carpeta)) throw new ErrorImportar('importar.rutaChoca', carpeta);
    }
  }
}

/** Lleva un paquete de un esquema antiguo al actual (sus archivos de texto). */
function migrarPaquete(manifest: Manifest, archivos: Map<string, Uint8Array>): Manifest {
  if (manifest.esquema === ESQUEMA_ACTUAL) return manifest;
  const deTexto = new Map(
    [...archivos].filter(([r]) => r.endsWith('.md') || r.endsWith('.json')).map(([r, d]) => [r, texto(d)] as const),
  );
  const r = migrar({ manifest, archivos: deTexto }, manifest.esquema);
  if (!r.ok) throw new ErrorImportar('importar.migracion', RUTA_MANIFEST_EXPORTADO);
  for (const [ruta, contenido] of r.valor.archivos) archivos.set(ruta, bytes(contenido));
  return r.valor.manifest;
}

/**
 * Lee y valida un paquete. Lanza `ErrorImportar` con la regla y el archivo del primer fallo; si vuelve, nada ha
 * fallado y se puede importar.
 */
export async function leerPaquete(
  fuente: Blob | Uint8Array,
  nombre: string,
  { limites = LIMITES_ZIP }: { limites?: LimitesZip } = {},
): Promise<Paquete> {
  // Antes de leer nada: un archivo mayor que el límite no se abre (un JSON se lee entero en memoria).
  const tamano = fuente instanceof Uint8Array ? fuente.length : fuente.size;
  if (tamano > limites.total) throw new ErrorImportar('zip.demasiadoGrande');
  const esJson =
    /\.json$/i.test(nombre) ||
    (fuente instanceof Uint8Array ? fuente[0] === 0x7b : (await fuente.slice(0, 1).text()) === '{');
  const origen = esJson ? 'json' : 'zip';
  const archivos = esJson
    ? archivosDeJson(fuente instanceof Uint8Array ? texto(fuente) : await fuente.text(), limites)
    : await archivosDeZip(fuente, limites);
  const avisos: string[] = [];
  const manifest = manifestDe(archivos);
  await comprobarHashes(manifest, archivos, avisos);
  archivos.delete(RUTA_MANIFEST_EXPORTADO);
  // Primero se migra: un paquete antiguo se valida con el esquema de ahora.
  const migrado = migrarPaquete(manifest, archivos);
  comprobarEsquemas(archivos);
  comprobarCarpetas(archivos);
  return { origen, manifest: migrado, archivos, avisos };
}
