/**
 * ¿Es lo que se captura la versión nueva de algo que ya estaba? (CMP-02): un prompt, un documento Markdown, un
 * código o una configuración (IN-045) del mismo tipo con el mismo título o muy parecido (Jaccard de *shingles* > 0,6). Mira solo los del mismo
 * tipo que no están en la papelera, el mismo título en memoria y el parecido en los 200 más recientes.
 */
import type { FrontmatterComun, TipoElemento } from '@rimor/formato';
import type { Repositorio } from '../almacen/repositorio';
import { parecido, shingles, tituloComparable, UMBRAL_PARECIDO } from '../versiones/parecido';

/** Los tipos que guardan versiones. */
export const TIPOS_CON_VERSIONES: ReadonlySet<TipoElemento> = new Set(['prompt', 'markdown', 'codigo', 'json']);
/** Cuántos de su tipo (los modificados más recientemente) se leen para buscar el parecido. */
export const CANDIDATOS = 200;
/**
 * Con el mismo título, basta con que se parezcan algo: dos códigos distintos pueden empezar por la misma función
 * y llevar el mismo título sin ser el mismo.
 */
export const PARECIDO_CON_TITULO = 0.2;
/**
 * Con títulos propios y distintos hace falta parecerse más: dos documentos de la misma plantilla («API de pagos» y
 * «Servicio de colas») pasan de 0,6 sin ser versiones el uno del otro.
 */
export const PARECIDO_TITULO_DISTINTO = 0.8;

const masReciente = (a: FrontmatterComun, b: FrontmatterComun) => Date.parse(b.modificado) - Date.parse(a.modificado);

/**
 * El elemento del que `texto` es la versión nueva, o `null`. Solo entre los del mismo tipo y del mismo lector (un
 * parche no es versión de un código, aunque los dos sean código). `generico` es el título que pone el lector cuando
 * no encuentra uno («Prompt», «Código»), o cómo saber si uno lo es: ese no cuenta como mismo título.
 */
export async function anteriorDe(
  texto: string,
  titulo: string,
  { tipo, mismoLector }: { tipo: TipoElemento; mismoLector: (fm: FrontmatterComun) => boolean },
  repositorio: Pick<Repositorio, 'elementos' | 'leerElemento'>,
  generico?: string | ((titulo: string) => boolean),
): Promise<FrontmatterComun | null> {
  if (!TIPOS_CON_VERSIONES.has(tipo)) return null;
  // Los guardados como adjunto (más de 2 MB) no tienen versiones.
  const mismos = repositorio
    .elementos()
    .filter((fm) => fm.tipo === tipo && mismoLector(fm) && !fm.adjunto)
    .sort(masReciente);
  if (!mismos.length) return null;
  const nuevos = shingles(texto);
  const parecidoA = async (fm: FrontmatterComun) => {
    const leido = await repositorio.leerElemento(fm.id).catch(() => null);
    return leido?.ok && leido.valor.original !== null ? parecido(nuevos, shingles(leido.valor.original)) : 0;
  };
  const esGenerico = (x: string) =>
    typeof generico === 'function' ? generico(x) : tituloComparable(x) === tituloComparable(generico ?? '');
  const t = tituloComparable(titulo);
  if (t && !esGenerico(titulo)) {
    for (const fm of mismos.filter((o) => tituloComparable(o.titulo) === t))
      if ((await parecidoA(fm)) >= PARECIDO_CON_TITULO) return fm;
  }
  const esPropio = (x: string) => Boolean(tituloComparable(x)) && !esGenerico(x);
  let mejor: FrontmatterComun | null = null;
  let maximo = UMBRAL_PARECIDO;
  for (const fm of mismos.slice(0, CANDIDATOS)) {
    const p = await parecidoA(fm);
    if (esPropio(titulo) && esPropio(fm.titulo) && p <= PARECIDO_TITULO_DISTINTO) continue;
    if (p > maximo) {
      maximo = p;
      mejor = fm;
    }
  }
  return mejor;
}
