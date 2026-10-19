/**
 * Lectura y escritura del `.md` de una entidad (comparación, hilo, investigación o documento, plan §13.2): el
 * frontmatter, validado con el esquema de su `tipo`, y el cuerpo en Markdown (notas, texto) tal cual. A diferencia
 * de un elemento, no lleva original ni lector.
 */
import * as v from 'valibot';
import {
  type Comparacion,
  comparacionSchema,
  type Documento,
  documentoSchema,
  type Hilo,
  hiloSchema,
  type Investigacion,
  investigacionSchema,
} from './esquemas';
import { escribirYaml, leerYaml, separar, unir } from './frontmatter';
import { fallo, ok, type Resultado } from './resultado';
import type { TipoEntidad } from './tipos';

const ESQUEMAS = {
  comparacion: comparacionSchema,
  hilo: hiloSchema,
  investigacion: investigacionSchema,
  documento: documentoSchema,
} as const satisfies Record<TipoEntidad, unknown>;

/** El frontmatter de cada tipo de entidad. */
export interface FrontmatterEntidades {
  comparacion: Comparacion;
  hilo: Hilo;
  investigacion: Investigacion;
  documento: Documento;
}

export type FrontmatterEntidad = FrontmatterEntidades[TipoEntidad];

export interface Entidad<F extends FrontmatterEntidad = FrontmatterEntidad> {
  frontmatter: F;
  /** El cuerpo en Markdown; puede ser vacío. */
  cuerpo: string;
}

/** Orden de las claves al escribir: identidad y fechas primero; el resto, en su orden. */
const ORDEN = ['id', 'ref', 'tipo', 'titulo', 'creado', 'modificado', 'estado', 'clase', 'fuentes', 'resultado'];

function ordenar(fm: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const k of ORDEN) if (fm[k] !== undefined) salida[k] = fm[k];
  for (const [k, x] of Object.entries(fm)) if (!(k in salida) && x !== undefined) salida[k] = x;
  return salida;
}

const esTipoEntidad = (x: unknown): x is TipoEntidad => typeof x === 'string' && x in ESQUEMAS;

/** Lee el `.md` de una entidad y valida su frontmatter con el esquema de su tipo. */
export function leerEntidad(texto: string): Resultado<Entidad> {
  const partes = separar(texto);
  if (!partes.ok) return partes;
  const datos = leerYaml(partes.valor.yaml);
  if (!datos.ok) return datos;
  const tipo = datos.valor.tipo;
  if (!esTipoEntidad(tipo)) return fallo('formato.tipoEntidadDesconocido', { tipo: String(tipo) });
  const r = v.safeParse(ESQUEMAS[tipo], datos.valor);
  if (!r.success) {
    const problema = r.issues[0];
    return fallo('formato.frontmatterInvalido', {
      campo: problema?.path?.map((p) => String(p.key)).join('.') ?? '',
      mensaje: problema?.message ?? '',
    });
  }
  const cuerpo = partes.valor.cuerpo;
  return ok({
    frontmatter: r.output as FrontmatterEntidad,
    cuerpo: (cuerpo.startsWith('\n') ? cuerpo.slice(1) : cuerpo).replace(/\n$/, ''),
  });
}

/** Escribe el `.md` de una entidad. Con `previo` (el texto anterior), conserva su YAML (orden y comentarios). */
export function escribirEntidad(entidad: Entidad, previo?: string): string {
  const yamlPrevio = previo === undefined ? undefined : separar(previo);
  const yaml = escribirYaml(
    ordenar(entidad.frontmatter as Record<string, unknown>),
    yamlPrevio?.ok ? yamlPrevio.valor.yaml : undefined,
  );
  return unir(yaml, `\n${entidad.cuerpo ? `${entidad.cuerpo}\n` : ''}`);
}
