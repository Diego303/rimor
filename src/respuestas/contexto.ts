/**
 * Contexto de la respuesta de Rimor (IN-016): lo que rodea a un elemento y que el lector puede recordar (misma
 * huella, versiones, notas de solución, colecciones probables y a qué responde). Sobre lo que el repositorio
 * tiene en memoria; solo abre archivos para leer las notas de los resueltos con la misma huella.
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import type { Repositorio } from '../almacen/repositorio';
import type { Idioma } from '../i18n/formatos';
import type { Contexto, Nota } from '../lectores/contrato';

const MAX_COLECCIONES = 3;
const MAX_NOTAS = 3;
/** Lo que se considera «a la vez»: lo guardado en las 24 h de antes o de después. */
export const VENTANA_CERCANOS_MS = 24 * 60 * 60 * 1000;

/** La huella que escribe el lector de Error (IN-021) en su resumen. */
export const huellaDe = (fm: FrontmatterComun): string | undefined => {
  const h = fm.lector.resumen.huella;
  return typeof h === 'string' && h ? h : undefined;
};

const porFechaDesc = (a: FrontmatterComun, b: FrontmatterComun) => b.creado.localeCompare(a.creado);

/** Palabras del título que dicen algo (4 letras o más), sin acentos ni mayúsculas. */
function palabras(titulo: string): Set<string> {
  const normal = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return new Set(normal.split(/[^\p{L}\p{N}]+/u).filter((p) => p.length >= 4));
}

/** Colecciones de otros elementos parecidos (por etiquetas y, si no, por palabras del título), sin las suyas. */
export function coleccionesCandidatas(fm: FrontmatterComun, otros: readonly FrontmatterComun[]): string[] {
  const propias = new Set(fm.colecciones ?? []);
  const etiquetas = new Set(fm.etiquetas ?? []);
  const delTitulo = palabras(fm.titulo);
  const puntos = new Map<string, number>();
  const sumar = (por: (o: FrontmatterComun) => number) => {
    for (const o of otros) {
      if (o.id === fm.id || !o.colecciones?.length) continue;
      const n = por(o);
      if (n) for (const c of o.colecciones) if (!propias.has(c)) puntos.set(c, (puntos.get(c) ?? 0) + n);
    }
  };
  if (etiquetas.size) sumar((o) => (o.etiquetas ?? []).filter((e) => etiquetas.has(e)).length);
  if (!puntos.size && delTitulo.size) sumar((o) => [...palabras(o.titulo)].filter((p) => delTitulo.has(p)).length);
  return [...puntos]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_COLECCIONES)
    .map(([c]) => c);
}

export interface OpcionesContexto {
  /** Ref del elemento al que responde la captura. */
  respondeA?: string;
  /**
   * El resumen calculado con los derivados (`lector.resumen(datos)`): en una captura nueva, el del frontmatter
   * aún es el provisional de `leer` y no trae la huella.
   */
  resumen?: Record<string, unknown>;
}

export async function construirContexto(
  el: Elemento,
  repositorio: Repositorio,
  idioma: Idioma,
  { respondeA, resumen }: OpcionesContexto = {},
): Promise<Contexto> {
  const fm = el.frontmatter;
  const todos = repositorio.elementos();
  const huella = huellaDe(resumen ? { ...fm, lector: { ...fm.lector, resumen } } : fm);
  const mismaHuella = huella ? todos.filter((o) => o.id !== fm.id && huellaDe(o) === huella).sort(porFechaDesc) : [];
  // Las versiones anteriores, de `historial/` (IN-029): solo si las tiene (`version` > 1), de la más reciente a la
  // más antigua. Una que no se puede leer no invalida el resto del contexto.
  const versiones: FrontmatterComun[] =
    (fm.version ?? 1) > 1
      ? (await repositorio.versiones(fm.id).catch(() => []))
          .filter((v) => v.motivo !== 'edicion')
          .map((v) => v.elemento.frontmatter)
      : [];

  const notas: Nota[] = [];
  for (const o of mismaHuella.filter((x) => x.estado === 'resuelto').slice(0, MAX_NOTAS)) {
    // Una nota que no se puede leer se omite: no invalida el resto del contexto.
    const leido = await repositorio.leerElemento(o.id).catch(() => null);
    const linea = leido?.ok ? leido.valor.notas.split('\n').find((l) => l.trim()) : undefined;
    if (linea) notas.push({ ref: o.ref, texto: linea.trim(), fecha: o.modificado });
  }

  const instante = Date.parse(fm.creado);
  const cercanos = Number.isFinite(instante)
    ? todos
        .filter((o) => o.id !== fm.id && Math.abs(Date.parse(o.creado) - instante) <= VENTANA_CERCANOS_MS)
        .sort((a, b) => Math.abs(Date.parse(a.creado) - instante) - Math.abs(Date.parse(b.creado) - instante))
    : [];

  const respondido = respondeA ? repositorio.frontmatter(respondeA) : undefined;
  return {
    idioma,
    mismaHuella,
    versiones,
    notas,
    colecciones: coleccionesCandidatas(fm, todos),
    cercanos,
    ...(respondido ? { respondeA: respondido } : {}),
  };
}
