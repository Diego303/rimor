/**
 * Lo que se comparte con Rimor desde otra app (CAP-08, IN-050, Web Share Target): el service worker recibe el POST de
 * `compartir`, guarda su título, su texto, su URL y sus archivos en la caché `rimor-compartido` y lleva a la app con
 * `?compartido`; la app lo recoge (y lo borra) para rellenar el compositor. Puro sobre una `Cache` (la de verdad o una
 * de pruebas): lo usan el service worker y la app.
 */

export const CACHE_COMPARTIDO = 'rimor-compartido';
/** Ruta (bajo la `BASE`) a la que el sistema manda lo compartido: la `action` del `share_target` del manifest. */
export const RUTA_COMPARTIR = 'compartir';
/** Lo que lleva la URL a la que se vuelve: la app sabe que tiene algo que recoger. */
export const MARCA_COMPARTIDO = 'compartido';

/** Lo mínimo de una `Cache` que se usa (así se prueba sin navegador). */
export interface CacheMinima {
  match(clave: string): Promise<Response | undefined>;
  put(clave: string, respuesta: Response): Promise<void>;
  delete(clave: string): Promise<boolean>;
  keys(): Promise<readonly Request[]>;
}

interface Datos {
  titulo: string;
  texto: string;
  url: string;
  archivos: { nombre: string; tipo: string }[];
}

const claveDatos = (base: string) => `${base}compartido/datos`;
const claveArchivo = (base: string, i: number) => `${base}compartido/archivo-${i}`;

const texto = (x: FormDataEntryValue | null) => (typeof x === 'string' ? x.trim() : '');

/** Vacía la caché (lo de un compartir anterior que nunca se recogió no se mezcla). */
async function vaciar(cache: CacheMinima): Promise<void> {
  for (const r of await cache.keys()) await cache.delete(r.url);
}

/** Guarda lo compartido (en el service worker). */
export async function guardarCompartido(formulario: FormData, cache: CacheMinima, base: string): Promise<void> {
  await vaciar(cache);
  // Un campo de archivos vacío llega como un archivo sin nombre ni bytes.
  const archivos = formulario
    .getAll('archivos')
    .filter((f): f is File => typeof f !== 'string' && (f.name !== '' || f.size > 0));
  const datos: Datos = {
    titulo: texto(formulario.get('titulo')),
    texto: texto(formulario.get('texto')),
    url: texto(formulario.get('url')),
    archivos: archivos.map((f) => ({ nombre: f.name, tipo: f.type })),
  };
  for (const [i, f] of archivos.entries()) await cache.put(claveArchivo(base, i), new Response(f));
  await cache.put(
    claveDatos(base),
    new Response(JSON.stringify(datos), { headers: { 'content-type': 'application/json' } }),
  );
}

/**
 * El texto para el compositor: el título, el texto y la URL, sin repetir (Android suele poner la URL también en el
 * texto, y el título a veces es el principio del texto).
 */
export function textoCompartido({ titulo, texto: cuerpo, url }: Pick<Datos, 'titulo' | 'texto' | 'url'>): string {
  const partes: string[] = [];
  if (titulo && !cuerpo.includes(titulo) && titulo !== url) partes.push(titulo);
  if (cuerpo) partes.push(cuerpo);
  if (url && !cuerpo.includes(url)) partes.push(url);
  return partes.join('\n');
}

/** Recoge lo compartido (en la app) y vacía la caché; `null` si no hay nada (o no se entiende). */
export async function recogerCompartido(
  cache: CacheMinima,
  base: string,
): Promise<{ texto: string; archivos: File[] } | null> {
  const respuesta = await cache.match(claveDatos(base));
  if (!respuesta) return null;
  let datos: Partial<Datos>;
  try {
    datos = (await respuesta.json()) as Partial<Datos>;
  } catch {
    await vaciar(cache);
    return null;
  }
  const archivos: File[] = [];
  for (const [i, a] of (Array.isArray(datos.archivos) ? datos.archivos : []).entries()) {
    const r = await cache.match(claveArchivo(base, i));
    if (r) archivos.push(new File([await r.blob()], String(a?.nombre ?? ''), { type: String(a?.tipo ?? '') }));
  }
  await vaciar(cache);
  const t = textoCompartido({
    titulo: String(datos.titulo ?? ''),
    texto: String(datos.texto ?? ''),
    url: String(datos.url ?? ''),
  });
  return t || archivos.length ? { texto: t, archivos } : null;
}

/** ¿Es de DuckDB (sus `.wasm`, sus workers, sus extensiones)? No se precarga: se guarda la primera vez que se usa. */
export const esDuckdb = (ruta: string): boolean =>
  ruta.endsWith('.wasm') || /\/duckdb\//.test(ruta) || /\/duckdb-browser-[^/]*\.worker[^/]*\.js$/.test(ruta);
