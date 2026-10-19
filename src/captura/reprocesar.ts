/**
 * Cambiar el tipo de un elemento (IN-026, tecla `t`; lo reutiliza IN-027): se vuelve a leer su original con otro
 * lector y se guarda con el tipo, la ref (el prefijo va con el tipo; la vieja queda en `alias`) y el resumen
 * nuevos. El `id` no cambia: las menciones por id siguen valiendo y el archivo se renombra solo.
 */
import { asignarRef, type Elemento, isoConZona } from '@rimor/formato';
import type { Repositorio } from '../almacen/repositorio';
import type { Lector } from '../lectores/contrato';
import { decodificarTexto } from './firmas';

/** Tipos que leen bytes: no se puede llegar a ellos (ni salir) cambiando de lector un texto. */
const TIPOS_BINARIOS = new Set(['archivo', 'imagen', 'pdf']);

/** ¿Se puede cambiar este elemento a este lector? Solo entre lectores de texto, y a otro distinto. */
export function sePuedeCambiar(el: Pick<Elemento, 'frontmatter'>, lector: Pick<Lector, 'tipo' | 'nombre'>): boolean {
  const fm = el.frontmatter;
  return !TIPOS_BINARIOS.has(fm.tipo) && !TIPOS_BINARIOS.has(lector.tipo) && fm.lector.nombre !== lector.nombre;
}

/** El texto original, esté en el `.md` o en un adjunto (los textos grandes). */
async function textoDe(el: Elemento, repositorio: Repositorio): Promise<string | null> {
  if (el.original !== null) return el.original;
  const ruta = el.frontmatter.adjunto?.ruta;
  if (!ruta) return null;
  const bytes = await repositorio.leerAdjunto(ruta);
  return bytes ? (decodificarTexto(bytes)?.texto ?? null) : null;
}

/** Cambia el tipo. Devuelve la ref nueva, o `null` si no se pudo (binario, sin original, mismo lector). */
export async function cambiarTipo(
  refOId: string,
  lector: Lector,
  repositorio: Repositorio,
  reloj: () => Date = () => new Date(),
): Promise<string | null> {
  const leido = await repositorio.leerElemento(refOId);
  if (!leido.ok || !sePuedeCambiar(leido.valor, lector)) return null;
  const el = leido.valor;
  const texto = await textoDe(el, repositorio);
  if (texto === null) return null;
  const nombre = el.frontmatter.adjunto?.nombre;
  const borrador = await lector.leer({ texto, ...(nombre ? { nombre } : {}) }).catch(() => null);
  const fm = el.frontmatter;
  const ref = asignarRef(lector.tipo, repositorio.refs());
  const nuevo: Elemento = {
    ...el,
    frontmatter: {
      ...(borrador?.metadatos ?? {}),
      ...fm,
      tipo: lector.tipo,
      ref,
      alias: [...(fm.alias ?? []), fm.ref],
      lector: { nombre: lector.nombre, version: lector.version, resumen: borrador?.resumen ?? {} },
      modificado: isoConZona(reloj()),
    },
  };
  await repositorio.guardarElemento(nuevo);
  return ref;
}
