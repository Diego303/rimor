/**
 * Lectura y escritura del `.md` de un elemento (plan §13.4): frontmatter, notas del usuario y el original
 * en el último bloque de código (o como adjunto si el frontmatter lleva `adjunto`).
 */
import * as v from 'valibot';
import { type FrontmatterComun, type FrontmatterLeido, frontmatterLeidoSchema } from './esquemas';
import { escribirYaml, leerYaml, separar, unir } from './frontmatter';
import { cercaPara, hashOriginal } from './original';
import { fallo, ok, type Resultado } from './resultado';
import { LENGUAJE_ORIGINAL } from './tipos';

export interface Elemento {
  frontmatter: FrontmatterComun;
  /** Notas del usuario en Markdown; puede ser vacío. */
  notas: string;
  /** El original intacto, o `null` si va como adjunto (`frontmatter.adjunto`). */
  original: string | null;
}

/** Orden canónico del Anexo B; el resto de claves va después, en su orden. */
const ORDEN = [
  'id',
  'ref',
  'tipo',
  'titulo',
  'creado',
  'modificado',
  'origen',
  'estado',
  'version',
  'colecciones',
  'investigaciones',
  'etiquetas',
  'sesion',
  'hilo',
  'fijado',
  'alias',
  'hash',
  'ocultados',
  'adjunto',
  'lector',
];

function ordenar(fm: Record<string, unknown>): Record<string, unknown> {
  const salida: Record<string, unknown> = {};
  for (const k of ORDEN) if (fm[k] !== undefined) salida[k] = fm[k];
  for (const [k, x] of Object.entries(fm)) if (!(k in salida) && x !== undefined) salida[k] = x;
  return salida;
}

/** Valida un frontmatter de elemento tal como se lee (los campos que se pueden deducir pueden faltar). */
export function validarFrontmatter(datos: unknown): Resultado<FrontmatterLeido> {
  const r = v.safeParse(frontmatterLeidoSchema, datos);
  if (r.success) return ok(r.output);
  const problema = r.issues[0];
  return fallo('formato.frontmatterInvalido', {
    campo: problema?.path?.map((p) => String(p.key)).join('.') ?? '',
    mensaje: problema?.message ?? '',
  });
}

/** Escribe el `.md` de un elemento. Con `previo` (el texto anterior), conserva su YAML (orden y comentarios). */
export function escribirElemento(el: Elemento, previo?: string): string {
  const yamlPrevio = previo === undefined ? undefined : separar(previo);
  const yaml = escribirYaml(ordenar(el.frontmatter), yamlPrevio?.ok ? yamlPrevio.valor.yaml : undefined);
  let cuerpo = '\n';
  if (el.notas) cuerpo += `${el.notas}\n`;
  if (el.original !== null) {
    const cerca = cercaPara(el.original);
    cuerpo += `\n${cerca}${LENGUAJE_ORIGINAL[el.frontmatter.tipo]}\n${el.original}\n${cerca}\n`;
  }
  return unir(yaml, cuerpo);
}

/** Separa notas y original del cuerpo. El original es el último bloque, que cierra el archivo. */
function partirCuerpo(cuerpo: string, conOriginal: boolean): { notas: string; original: string | null } | null {
  const sinPrimera = cuerpo.startsWith('\n') ? cuerpo.slice(1) : cuerpo;
  if (!conOriginal) return { notas: sinPrimera.replace(/\n$/, ''), original: null };
  const cierre = /\n(`{3,})[ \t]*\r?\n?\s*$/.exec(cuerpo);
  if (!cierre) return null;
  const cerca = cierre[1] ?? '```';
  const apertura = cuerpo.lastIndexOf(`\n${cerca}`, cierre.index - 1);
  const inicioLinea = apertura < 0 && cuerpo.startsWith(cerca) ? 0 : apertura + 1;
  if (apertura < 0 && inicioLinea !== 0) return null;
  const finLinea = cuerpo.indexOf('\n', inicioLinea);
  if (finLinea < 0 || finLinea > cierre.index) return null;
  const original = finLinea === cierre.index ? '' : cuerpo.slice(finLinea + 1, cierre.index);
  const antes = cuerpo.slice(0, Math.max(0, inicioLinea - 1));
  const notas = (antes.startsWith('\n') ? antes.slice(1) : antes).replace(/\n$/, '');
  return { notas, original };
}

/**
 * Completa lo que un archivo escrito a mano o por otra herramienta puede no traer: `modificado` toma
 * `creado`, `origen` es «importado», `ocultados` 0 y el `hash` se calcula del original (o del adjunto).
 */
export function completarFrontmatter(fm: FrontmatterLeido, original: string | null): FrontmatterComun {
  const hash = fm.hash ?? (fm.adjunto ? (`sha256:${fm.adjunto.hash}` as const) : hashOriginal(original ?? ''));
  return {
    ...fm,
    modificado: fm.modificado ?? fm.creado,
    origen: fm.origen ?? 'importado',
    hash,
    ocultados: fm.ocultados ?? 0,
  };
}

/** Lee el `.md` de un elemento y valida su frontmatter. */
export function leerElemento(texto: string): Resultado<Elemento> {
  const partes = separar(texto);
  if (!partes.ok) return partes;
  const datos = leerYaml(partes.valor.yaml);
  if (!datos.ok) return datos;
  const fm = validarFrontmatter(datos.valor);
  if (!fm.ok) return fm;
  const cuerpo = partirCuerpo(partes.valor.cuerpo, fm.valor.adjunto === undefined);
  if (!cuerpo) return fallo('formato.sinOriginal', { ref: fm.valor.ref });
  return ok({ frontmatter: completarFrontmatter(fm.valor, cuerpo.original), ...cuerpo });
}
