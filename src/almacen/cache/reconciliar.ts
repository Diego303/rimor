/**
 * Pone la caché al día con los archivos (al abrir un espacio): solo lee lo nuevo o cambiado y borra lo que
 * ya no existe. Con la caché vacía, es la reconstrucción completa. Antes, termina la operación del diario
 * que se cortara (IN-005).
 */
import { leerElemento, rutaElemento } from '@rimor/formato';
import { type Almacen, type EntradaAlmacen, leerTexto, listarTodo } from '../contrato';
import { CARPETA_PAPELERA, recuperarOperacion } from '../repositorio';
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

/** ¿Está el archivo donde le corresponde por su ref, título y fecha (dentro o fuera de la papelera)? */
function enSuSitio(e: EntradaFrontmatter): boolean {
  const propia = rutaElemento(e.frontmatter.ref, e.frontmatter.titulo, e.frontmatter.creado);
  return e.ruta === propia || e.ruta === `${CARPETA_PAPELERA}/${propia}`;
}

/** Entre dos copias con el mismo id gana la que está en su sitio; si ninguna o las dos, la de ruta menor. */
function gana(a: EntradaFrontmatter, b: EntradaFrontmatter): EntradaFrontmatter {
  const sa = enSuSitio(a);
  const sb = enSuSitio(b);
  if (sa !== sb) return sa ? a : b;
  return a.ruta <= b.ruta ? a : b;
}

export async function reconciliar(
  almacen: Almacen,
  cache: CacheEspacio,
  alProgreso?: (p: Progreso) => void,
): Promise<ResultadoReconciliacion> {
  await recuperarOperacion(almacen);
  const archivos: EntradaAlmacen[] = [];
  for (const prefijo of ['elementos/', `${CARPETA_PAPELERA}/elementos/`])
    for (const e of await listarTodo(almacen, prefijo)) if (e.ruta.endsWith('.md')) archivos.push(e);

  const enCache = await cache.frontmatters();
  const porRuta = new Map(enCache.map((e) => [e.ruta, e]));
  const resultado: ResultadoReconciliacion = {
    nuevos: 0,
    cambiados: 0,
    borrados: 0,
    fallidos: [],
    total: 0,
    entradas: [],
  };

  // Candidatos por id: los que siguen igual (de la caché) y los releídos.
  const candidatos = new Map<string, { entrada: EntradaFrontmatter; leido: boolean }[]>();
  const anotar = (entrada: EntradaFrontmatter, leido: boolean) => {
    const lista = candidatos.get(entrada.id) ?? [];
    lista.push({ entrada, leido });
    candidatos.set(entrada.id, lista);
  };

  const pendientes: EntradaAlmacen[] = [];
  for (const a of archivos) {
    const c = porRuta.get(a.ruta);
    if (c && c.tam === a.tam && c.modificado === a.modificado) anotar(c, false);
    else pendientes.push(a);
  }

  for (const [i, a] of pendientes.entries()) {
    const r = leerElemento((await leerTexto(almacen, a.ruta)) ?? '');
    if (!r.ok) resultado.fallidos.push({ ruta: a.ruta, codigo: r.error.codigo });
    else {
      const fm = r.valor.frontmatter;
      anotar({ id: fm.id, ref: fm.ref, ruta: a.ruta, tam: a.tam, modificado: a.modificado, frontmatter: fm }, true);
    }
    if ((i + 1) % LOTE === 0 || i === pendientes.length - 1) alProgreso?.({ hechos: i + 1, total: pendientes.length });
  }

  const vigentes = new Map<string, EntradaFrontmatter>();
  const aGuardar: EntradaFrontmatter[] = [];
  const cachePorId = new Map(enCache.map((e) => [e.id, e]));
  for (const [id, lista] of candidatos) {
    const ganador = lista.map((x) => x.entrada).reduce(gana);
    for (const x of lista)
      if (x.entrada !== ganador) resultado.fallidos.push({ ruta: x.entrada.ruta, codigo: 'almacen.duplicado' });
    vigentes.set(id, ganador);
    if (!lista.find((x) => x.entrada === ganador)?.leido) continue;
    const anterior = cachePorId.get(id);
    if (!anterior) resultado.nuevos++;
    else if (
      anterior.ruta !== ganador.ruta ||
      anterior.tam !== ganador.tam ||
      anterior.modificado !== ganador.modificado
    ) {
      resultado.cambiados++;
      if (anterior.frontmatter.hash !== ganador.frontmatter.hash)
        await cache.podarDerivados(id, ganador.frontmatter.hash);
    } else continue;
    aGuardar.push(ganador);
  }
  for (let i = 0; i < aGuardar.length; i += LOTE) await cache.guardarFrontmatters(aGuardar.slice(i, i + LOTE));

  // Lo que está en la caché y ya no está en ningún archivo. Un renombrado conserva su id: su entrada ya cambió.
  const sobran = enCache.filter((c) => !vigentes.has(c.id)).map((c) => c.id);
  await cache.borrarElementos(sobran);
  resultado.borrados = sobran.length;
  resultado.entradas = [...vigentes.values()];
  resultado.total = vigentes.size;
  return resultado;
}
