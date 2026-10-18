/**
 * Pone la caché al día con los archivos (al abrir un espacio): solo lee lo nuevo o cambiado y borra lo que
 * ya no existe. Con la caché vacía, es la reconstrucción completa.
 */
import { leerElemento } from '@rimor/formato';
import { type Almacen, type EntradaAlmacen, leerTexto, listarTodo } from '../contrato';
import { CARPETA_PAPELERA } from '../repositorio';
import type { CacheEspacio, EntradaFrontmatter } from './cache';

export interface Progreso {
  hechos: number;
  total: number;
}

export interface ResultadoReconciliacion {
  nuevos: number;
  cambiados: number;
  borrados: number;
  fallidos: { ruta: string; codigo: string }[];
  /** Elementos en la caché al terminar. */
  total: number;
  entradas: EntradaFrontmatter[];
}

const LOTE = 100;

export async function reconciliar(
  almacen: Almacen,
  cache: CacheEspacio,
  alProgreso?: (p: Progreso) => void,
): Promise<ResultadoReconciliacion> {
  const archivos: EntradaAlmacen[] = [];
  for (const prefijo of ['elementos/', `${CARPETA_PAPELERA}/elementos/`])
    for (const e of await listarTodo(almacen, prefijo)) if (e.ruta.endsWith('.md')) archivos.push(e);

  const enCache = await cache.frontmatters();
  const porRuta = new Map(enCache.map((e) => [e.ruta, e]));
  const vigentes = new Map<string, EntradaFrontmatter>();
  const pendientes = archivos.filter((a) => {
    const c = porRuta.get(a.ruta);
    if (c && c.tam === a.tam && c.modificado === a.modificado) {
      vigentes.set(c.id, c);
      return false;
    }
    return true;
  });

  const resultado: ResultadoReconciliacion = {
    nuevos: 0,
    cambiados: 0,
    borrados: 0,
    fallidos: [],
    total: 0,
    entradas: [],
  };
  let lote: EntradaFrontmatter[] = [];
  for (const [i, a] of pendientes.entries()) {
    const r = leerElemento((await leerTexto(almacen, a.ruta)) ?? '');
    if (!r.ok) resultado.fallidos.push({ ruta: a.ruta, codigo: r.error.codigo });
    else {
      const fm = r.valor.frontmatter;
      const entrada: EntradaFrontmatter = {
        id: fm.id,
        ref: fm.ref,
        ruta: a.ruta,
        tam: a.tam,
        modificado: a.modificado,
        frontmatter: fm,
      };
      if (porRuta.has(a.ruta)) resultado.cambiados++;
      else resultado.nuevos++;
      vigentes.set(fm.id, entrada);
      lote.push(entrada);
    }
    if (lote.length >= LOTE || i === pendientes.length - 1) {
      await cache.guardarFrontmatters(lote);
      lote = [];
      alProgreso?.({ hechos: i + 1, total: pendientes.length });
    }
  }

  // Lo que está en la caché y ya no está en ningún archivo. Un elemento renombrado conserva su id:
  // su entrada nueva ya sustituyó a la vieja.
  const sobran = enCache.filter((c) => !vigentes.has(c.id)).map((c) => c.id);
  await cache.borrarElementos(sobran);
  resultado.borrados = sobran.length;
  resultado.entradas = [...vigentes.values()];
  resultado.total = vigentes.size;
  return resultado;
}
