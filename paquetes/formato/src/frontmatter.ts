/**
 * Archivos Markdown con frontmatter YAML: separar, unir y escribir el YAML conservando orden, comentarios,
 * estilo y claves desconocidas (con el `Document` de `yaml`). El cuerpo nunca se toca.
 */
import { Document, isMap, isScalar, isSeq, parseDocument, visit } from 'yaml';
import { fallo, ok, type Resultado } from './resultado';

const ABRE = '---\n';
// Sin escalares de bloque: `yaml` pierde el espacio inicial de un texto como « \n» en un bloque «|+»;
// entre comillas dobles cualquier texto vuelve idéntico.
const OPCIONES = { lineWidth: 0, flowCollectionPadding: false, blockQuote: false } as const;

export interface PartesMd {
  yaml: string;
  cuerpo: string;
}

/** Separa el frontmatter del cuerpo. Acepta `\r\n` en las líneas delimitadoras. */
export function separar(texto: string): Resultado<PartesMd> {
  const t = texto.startsWith('---\r\n') ? texto.replace(/^---\r\n/, ABRE) : texto;
  if (!t.startsWith(ABRE)) return fallo('formato.sinFrontmatter');
  // El YAML puede estar vacío («---\n---\n»).
  if (t.startsWith('---\n---\n') || t === '---\n---') return ok({ yaml: '', cuerpo: t.slice(8) });
  const fin = t.search(/\r?\n---\r?\n|\r?\n---$/);
  if (fin < 0) return fallo('formato.frontmatterSinCerrar');
  const resto = t.slice(fin).replace(/^\r?\n---(?:\r?\n)?/, '');
  return ok({ yaml: `${t.slice(ABRE.length, fin)}\n`, cuerpo: resto });
}

/** Une YAML y cuerpo en un archivo. */
export function unir(yaml: string, cuerpo: string): string {
  return `${ABRE}${yaml.endsWith('\n') ? yaml : `${yaml}\n`}---\n${cuerpo}`;
}

/** Lee el YAML del frontmatter como objeto. */
export function leerYaml(yaml: string): Resultado<Record<string, unknown>> {
  const doc = parseDocument(yaml);
  if (doc.errors.length) return fallo('formato.yamlInvalido', { mensaje: doc.errors[0]?.message ?? '' });
  const valor = doc.toJS() ?? {};
  if (typeof valor !== 'object' || Array.isArray(valor)) return fallo('formato.yamlNoEsObjeto');
  return ok(valor as Record<string, unknown>);
}

/** Listas de escalares y mapas pequeños en línea, como en los ejemplos del Anexo B: `colecciones: [gateway]`. */
function estiloCompacto(doc: Document): void {
  visit(doc, {
    Seq(_, nodo) {
      if (nodo.items.every((x) => isScalar(x))) nodo.flow = true;
    },
    Map(_, nodo) {
      // Solo los mapas anidados de escalares (resumen del lector, elementos de una investigación).
      if (
        nodo !== doc.contents &&
        nodo.items.length <= 8 &&
        nodo.items.every((p) => isScalar(p.value) || (isSeq(p.value) && p.value.flow))
      )
        nodo.flow = true;
    },
  });
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Lleva el nodo `nodo` al valor `valor` tocando lo mínimo: un escalar cambia su valor (y conserva su
 * comentario y estilo), un mapa se fusiona clave a clave y una lista de escalares del mismo largo se
 * actualiza elemento a elemento. Si la forma cambia, se sustituye el nodo. Devuelve el nodo a poner.
 */
function fusionar(doc: Document, nodo: unknown, valor: unknown): unknown {
  const esObjeto = (x: unknown): x is Record<string, unknown> =>
    typeof x === 'object' && x !== null && !Array.isArray(x);
  if (isScalar(nodo) && (valor === null || typeof valor !== 'object')) {
    nodo.value = valor;
    return nodo;
  }
  if (isMap(nodo) && esObjeto(valor)) {
    const anterior = (nodo.toJSON() ?? {}) as Record<string, unknown>;
    for (const clave of Object.keys(anterior)) if (!(clave in valor) || valor[clave] === undefined) nodo.delete(clave);
    for (const [clave, v] of Object.entries(valor)) {
      if (v === undefined || (clave in anterior && igual(anterior[clave], v))) continue;
      nodo.set(clave, clave in anterior ? fusionar(doc, nodo.get(clave, true), v) : nuevoNodo(doc, v));
    }
    return nodo;
  }
  if (
    isSeq(nodo) &&
    Array.isArray(valor) &&
    nodo.items.length === valor.length &&
    nodo.items.every((x) => isScalar(x))
  ) {
    valor.forEach((v, i) => {
      nodo.items[i] = fusionar(doc, nodo.items[i], v);
    });
    return nodo;
  }
  return nuevoNodo(doc, valor);
}

/** Nodo nuevo con el estilo compacto del Anexo B. */
function nuevoNodo(doc: Document, valor: unknown) {
  const nodo = doc.createNode(valor);
  const temporal = new Document(nodo);
  estiloCompacto(temporal);
  // Aquí el nodo es la raíz del documento temporal: se le aplica la misma regla que a un mapa anidado.
  if (
    isMap(temporal.contents) &&
    temporal.contents.items.length <= 8 &&
    temporal.contents.items.every((p) => isScalar(p.value))
  )
    temporal.contents.flow = true;
  return temporal.contents;
}

/**
 * Escribe un objeto como YAML. Sin `previo`, en el orden de sus claves; con `previo`, edita ese YAML:
 * cambia solo lo que cambió, borra lo que ya no está y añade lo nuevo al final, sin perder comentarios
 * ni el estilo de lo que no se toca.
 */
export function escribirYaml(valor: Record<string, unknown>, previo?: string): string {
  const base = previo === undefined ? undefined : parseDocument(previo);
  if (!base || base.errors.length || !isMap(base.contents)) {
    const doc = new Document(valor);
    estiloCompacto(doc);
    return doc.toString(OPCIONES);
  }
  base.contents = fusionar(base, base.contents, valor) as typeof base.contents;
  return base.toString(OPCIONES);
}
