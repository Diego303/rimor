/**
 * Exportar el espacio (DAT-03, DAT-05; F0-2): un ZIP en streaming con todos sus archivos y su `manifest.json`
 * (recuentos y hashes SHA-256), o un JSON único con los adjuntos pequeños en base64 y los grandes declarados como
 * excluidos. TS puro sobre un almacén: corre en el Worker de exportación o, sin él, aquí.
 */
import { isoConZona, leerManifest, leerYaml, type Manifest, separar, slug, unir } from '@rimor/formato';
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import type { Almacen, EntradaAlmacen } from '../almacen/contrato';
import { listarTodo } from '../almacen/contrato';

export const RUTA_MANIFEST_EXPORTADO = 'manifest.json';
/** Los adjuntos que caben en el JSON único (en base64). */
export const MAX_ADJUNTO_JSON = 1024 * 1024;
/** Lo que se empuja al ZIP de una vez, cediendo el hilo entre trozos (F0-2). */
export const TROZO = 256 * 1024;
/** El texto se comprime; los adjuntos van tal cual (a menudo ya comprimidos). */
const NIVEL_TEXTO = 6;

/** Lo que no sale del espacio: la caché, el diario de una operación cortada y el manifest (se escribe el nuevo). */
export const fueraDeLaExportacion = (ruta: string): boolean =>
  ruta.startsWith('.rimor/cache/') || ruta === '.rimor/operacion.json' || ruta === RUTA_MANIFEST_EXPORTADO;

export type AlmacenLectura = Pick<Almacen, 'leer' | 'listar'>;

export interface ProgresoExportacion {
  /** Bytes leídos del espacio. */
  hechos: number;
  total: number;
}

export interface OpcionesExportar {
  ahora: Date;
  /** La versión de la app que exporta. */
  version: string;
  alProgreso?: (p: ProgresoExportacion) => void;
  senal?: AbortSignal;
  /** Cede el hilo entre trozos; por defecto, un `setTimeout` de 0. */
  ceder?: () => Promise<void>;
}

const cederPorDefecto = () => new Promise<void>((r) => setTimeout(r, 0));

/** Cada cuánto se cede el hilo como mucho: ceder en cada archivo sumaría ~4 ms por archivo (el mínimo anidado). */
const CEDER_CADA_MS = 12;

/** Cede solo si ha pasado un rato desde la última vez. */
function cederCada(ceder: () => Promise<void>): () => Promise<void> {
  let ultima = performance.now();
  return async () => {
    if (performance.now() - ultima < CEDER_CADA_MS) return;
    await ceder();
    ultima = performance.now();
  };
}

/** Lo que un ZIP sin ZIP64 admite (los recuentos y posiciones van en 16 y 32 bits): por encima, se corta. */
export const MAX_ENTRADAS_ZIP = 0xffff - 1;
export const MAX_BYTES_ZIP = 0xffffffff - 1;

function comprobar(senal: AbortSignal | undefined): void {
  if (senal?.aborted) throw new DOMException('Exportación cancelada', 'AbortError');
}

/** «rimor-trabajo-2026-10-22.zip»; con motivo, «rimor-trabajo-2026-10-22-antes-de-vaciar.zip». */
export function nombreExportacion(espacio: string, fecha: Date, extension: 'zip' | 'json', motivo?: string): string {
  const nombre = /[\p{L}\p{N}]/u.test(espacio) ? slug(espacio) : 'espacio';
  return `rimor-${nombre}-${isoConZona(fecha).slice(0, 10)}${motivo ? `-${slug(motivo)}` : ''}.${extension}`;
}

/** SHA-256 en hexadecimal. */
export async function sha256(datos: Uint8Array): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', datos as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(resumen)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cuántos hay de cada cosa (Anexo A, más comparaciones, hilos y papelera). */
export function recuentosDe(rutas: readonly string[]): Record<string, number> {
  const contar = (prefijo: string, final = '') =>
    rutas.filter((r) => r.startsWith(prefijo) && r.endsWith(final)).length;
  return {
    elementos: contar('elementos/', '.md'),
    comparaciones: contar('comparaciones/', '.md'),
    hilos: contar('hilos/', '.md'),
    investigaciones: contar('investigaciones/', '.md'),
    documentos: contar('documentos/'),
    adjuntos: contar('adjuntos/'),
    papelera: contar('papelera/', '.md'),
  };
}

/** Los archivos que se exportan, en orden de ruta (dos exportaciones del mismo espacio, en el mismo orden). */
async function archivosDe(almacen: AlmacenLectura): Promise<EntradaAlmacen[]> {
  const todos = await listarTodo(almacen as Almacen, '');
  return todos.filter((e) => !fueraDeLaExportacion(e.ruta)).sort((a, b) => (a.ruta < b.ruta ? -1 : 1));
}

/** Lee un archivo; si se estaba escribiendo y falla, lo intenta otra vez. `null` si ya no está. */
async function leer(almacen: AlmacenLectura, ruta: string): Promise<Uint8Array | null> {
  try {
    return await almacen.leer(ruta);
  } catch {
    await new Promise((r) => setTimeout(r, 50));
    return almacen.leer(ruta);
  }
}

/** El manifest del espacio, del que sale el exportado. */
async function manifestBase(almacen: AlmacenLectura): Promise<Manifest> {
  const datos = await almacen.leer(RUTA_MANIFEST_EXPORTADO);
  const manifest = datos && leerManifest(new TextDecoder().decode(datos));
  if (!manifest) throw new Error('exportar.sinManifest');
  return manifest;
}

/** El manifest de una exportación: el del espacio con la fecha, la versión, los recuentos y los hashes. */
export function manifestExportado(
  base: Manifest,
  hashes: ReadonlyMap<string, string>,
  { ahora, version, excluidos = [] }: { ahora: Date; version: string; excluidos?: readonly string[] },
): Manifest {
  const rutas = [...hashes.keys()];
  const nuevo: Record<string, unknown> = {
    ...base,
    exportado: isoConZona(ahora),
    app: { ...(base.app ?? {}), version },
    recuentos: recuentosDe([...rutas, ...excluidos]),
    adjuntos_excluidos: [...excluidos],
    hashes: { algoritmo: 'SHA-256', archivos: Object.fromEntries(rutas.map((r) => [r, hashes.get(r) ?? ''])) },
  };
  // Siempre en el mismo orden (el del Anexo A y después lo demás): leer un manifest lo reordena, y exportar dos
  // veces lo mismo debe dar el mismo archivo.
  const orden = [
    ...ORDEN_MANIFEST.filter((k) => k in nuevo),
    ...Object.keys(nuevo).filter((k) => !ORDEN_MANIFEST.includes(k)),
  ];
  return Object.fromEntries(orden.map((k) => [k, nuevo[k]])) as Manifest;
}

const ORDEN_MANIFEST = [
  'formato',
  'esquema',
  'espacio',
  'creado',
  'exportado',
  'app',
  'recuentos',
  'adjuntos_excluidos',
  'hashes',
];

const aTexto = (m: Manifest) => `${JSON.stringify(m, null, 2)}\n`;

export interface ZipExportado {
  /** Los trozos del ZIP, en orden (para un `Blob`). */
  trozos: Uint8Array[];
  manifest: Manifest;
  bytes: number;
}

/** El ZIP completo del espacio, en streaming. */
export async function exportarZip(almacen: AlmacenLectura, o: OpcionesExportar): Promise<ZipExportado> {
  const ceder = cederCada(o.ceder ?? cederPorDefecto);
  const base = await manifestBase(almacen);
  const archivos = await archivosDe(almacen);
  // Con el manifest; un ZIP que no cabe sería corrupto en silencio (y se apuntaría como copia).
  if (archivos.length + 1 > MAX_ENTRADAS_ZIP) throw new Error('exportar.demasiadoGrande');
  const total = archivos.reduce((s, e) => s + e.tam, 0);
  const trozos: Uint8Array[] = [];
  let error: Error | null = null;
  let terminado = false;
  let bytes = 0;
  const zip = new Zip((e, datos, final) => {
    if (e) error = e;
    else {
      trozos.push(datos);
      bytes += datos.length;
      if (bytes > MAX_BYTES_ZIP) error = new Error('exportar.demasiadoGrande');
    }
    if (final) terminado = true;
  });
  const hashes = new Map<string, string>();
  let hechos = 0;
  o.alProgreso?.({ hechos, total });

  const anadir = async (ruta: string, datos: Uint8Array, comprimir: boolean) => {
    const entrada = comprimir ? new ZipDeflate(ruta, { level: NIVEL_TEXTO }) : new ZipPassThrough(ruta);
    entrada.mtime = o.ahora;
    zip.add(entrada);
    if (!datos.length) entrada.push(datos, true);
    if (error) throw error;
    for (let i = 0; i < datos.length; i += TROZO) {
      entrada.push(datos.subarray(i, i + TROZO), i + TROZO >= datos.length);
      if (error) throw error;
      await ceder();
      comprobar(o.senal);
    }
  };

  for (const { ruta } of archivos) {
    comprobar(o.senal);
    const datos = await leer(almacen, ruta);
    if (!datos) continue;
    hashes.set(ruta, await sha256(datos));
    await anadir(ruta, datos, !ruta.startsWith('adjuntos/'));
    hechos += datos.length;
    o.alProgreso?.({ hechos: Math.min(hechos, total), total });
  }
  const manifest = manifestExportado(base, hashes, o);
  await anadir(RUTA_MANIFEST_EXPORTADO, new TextEncoder().encode(aTexto(manifest)), true);
  zip.end();
  if (error) throw error;
  if (!terminado) throw new Error('exportar.zipIncompleto');
  o.alProgreso?.({ hechos: total, total });
  return { trozos, manifest, bytes };
}

/** Un elemento en el JSON único: el frontmatter leído, su YAML tal cual y el cuerpo (reconstruyen el archivo). */
export interface ElementoJson {
  ruta: string;
  frontmatter: Record<string, unknown>;
  yaml: string;
  cuerpo: string;
}

export type ArchivoJson = { ruta: string; texto: string } | { ruta: string; base64: string };

export interface ExportacionJson {
  manifest: Manifest;
  elementos: ElementoJson[];
  adjuntos: { ruta: string; base64: string }[];
  archivos: ArchivoJson[];
}

/** Base64 de unos bytes, por trozos (un `String.fromCharCode(...grande)` desborda la pila). */
export function aBase64(datos: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < datos.length; i += 0x8000) binario += String.fromCharCode(...datos.subarray(i, i + 0x8000));
  return btoa(binario);
}

// `ignoreBOM`: un BOM al principio se queda en el texto (si no, el archivo reconstruido no sería el mismo).
const utf8Estricto = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/** El texto si es UTF-8 válido; si no, `null`. */
function comoTexto(datos: Uint8Array): string | null {
  try {
    return utf8Estricto.decode(datos);
  } catch {
    return null;
  }
}

/** Un `.md` de `elementos/` como elemento del JSON, si se puede reconstruir exactamente; si no, `null`. */
function comoElemento(ruta: string, texto: string): ElementoJson | null {
  const partes = separar(texto);
  if (!partes.ok || unir(partes.valor.yaml, partes.valor.cuerpo) !== texto) return null;
  const frontmatter = leerYaml(partes.valor.yaml);
  if (!frontmatter.ok) return null;
  return { ruta, frontmatter: frontmatter.valor, yaml: partes.valor.yaml, cuerpo: partes.valor.cuerpo };
}

/**
 * El JSON único: los elementos, los adjuntos de hasta 1 MB y el resto de archivos. Los adjuntos mayores no van y
 * se listan en `manifest.adjuntos_excluidos` (el JSON lo dice: no es una copia completa).
 */
export async function exportarJson(
  almacen: AlmacenLectura,
  o: OpcionesExportar,
): Promise<{ texto: string; manifest: Manifest; excluidos: string[] }> {
  const ceder = cederCada(o.ceder ?? cederPorDefecto);
  const base = await manifestBase(almacen);
  const archivos = await archivosDe(almacen);
  const total = archivos.reduce((s, e) => s + e.tam, 0);
  const salida: Omit<ExportacionJson, 'manifest'> = { elementos: [], adjuntos: [], archivos: [] };
  const hashes = new Map<string, string>();
  const excluidos: string[] = [];
  let hechos = 0;
  o.alProgreso?.({ hechos, total });
  for (const { ruta, tam } of archivos) {
    comprobar(o.senal);
    if (ruta.startsWith('adjuntos/') && tam > MAX_ADJUNTO_JSON) {
      excluidos.push(ruta);
      hechos += tam;
      continue;
    }
    const datos = await leer(almacen, ruta);
    if (!datos) continue;
    if (ruta.startsWith('adjuntos/') && datos.length > MAX_ADJUNTO_JSON) {
      excluidos.push(ruta);
      continue;
    }
    hashes.set(ruta, await sha256(datos));
    const texto = ruta.startsWith('adjuntos/') ? null : comoTexto(datos);
    const elemento =
      texto !== null && ruta.startsWith('elementos/') && ruta.endsWith('.md') ? comoElemento(ruta, texto) : null;
    if (elemento) salida.elementos.push(elemento);
    else if (ruta.startsWith('adjuntos/')) salida.adjuntos.push({ ruta, base64: aBase64(datos) });
    else salida.archivos.push(texto !== null ? { ruta, texto } : { ruta, base64: aBase64(datos) });
    hechos += datos.length;
    o.alProgreso?.({ hechos: Math.min(hechos, total), total });
    await ceder();
  }
  const manifest = manifestExportado(base, hashes, { ...o, excluidos });
  const json: ExportacionJson = { manifest, ...salida };
  o.alProgreso?.({ hechos: total, total });
  return { texto: `${JSON.stringify(json)}\n`, manifest, excluidos };
}
