/**
 * Análisis de un fragmento de código (LEC-09): ¿parece código?, su lenguaje, sus líneas y sus definiciones
 * (funciones, clases, tipos), para el título y la búsqueda. TS puro.
 */

import { confianzaLog } from '../log/lector';
import {
  esLineaDeLenguaje,
  type Lenguaje,
  lenguajePorExtension,
  lenguajePorSintaxis,
  lineasDeCodigo,
} from './lenguajes';

export interface DatosCodigo {
  lenguaje: Lenguaje | null;
  comoSeSupo: 'extension' | 'sintaxis' | 'ninguno';
  lineas: number;
  caracteres: number;
  /** Nombres de funciones, clases y tipos, en orden y sin repetir (hasta `MAX_DEFINICIONES`). */
  definiciones: string[];
}

export const MAX_DEFINICIONES = 50;

/** Una definición al principio de la línea, en cualquiera de los lenguajes. */
const DEFINICION =
  /^(?:export |pub(?:\(crate\))? |public |private |protected |internal |static |async |abstract |final |default )*(?:function\*? ?|def |fn |func (?:\(\w+ \*?\w+\) )?|class |interface |struct |enum class |enum struct |enum |trait |impl |type |module )([A-Za-z_$][\w$]*)/;
/** Funciones como valor: `const nombre = (…) =>` o `= function`. */
const FUNCION_COMO_VALOR =
  /^(?:export )?(?:const|let|var) ([A-Za-z_$][\w$]*) ?= ?(?:async )?(?:\(|function\b|[A-Za-z_$][\w$]* ?=>)/;

/** Lo que delata que una línea es código: puntuación de cierre, asignaciones, llamadas, comentarios de código… */
// Además: atributos de Ruby (`@id = id`), aperturas (`CREATE TABLE x (`), propiedades de un objeto literal
// (`clave: 'valor',`, `clave: {`), y de Python decoradores, campos anotados (`vida: int`), `assert`, `raise`… y
// los nombres de un `import` en varias líneas (`EXTENSIONES,`).
const LINEA_DE_CODIGO =
  /[;{}([]$|^@[\w.]+(?:\(.*\))?$|^\w+: ?[\w.[\], |]+(?: = .+)?$|^(?:assert|raise|yield|pass|break|continue|await)\b|^\w+,$|^['"]?[\w$-]+['"]? ?: ?.+,$|^@\w+ ?=|^[})\]]|\):$|^(?:\/\/|\/\*|\*|#include|#define|import |from \S+ import|package |use |using |return\b|if ?\(|for ?\(|while ?\(|def |class |fn |func |end$|fi$|done$)|^[\w$.[\]]+ ?(?:[+\-*/%]|\?\?|\|\|)?= ?\S|^\w[\w.]*\(.*\);?$|=>|::|:=|->/;

/**
 * Una línea de prosa (empieza en mayúscula, acaba en punto, cinco palabras o más y sin puntuación de código) no
 * cuenta como código. A mano: con una expresión, las palabras y los espacios retrocederían.
 */
function esProsa(l: string): boolean {
  if (!/^[\p{Lu}¿¡]/u.test(l) || !/[.?!]$/.test(l) || /[;{}=<>()]/.test(l)) return false;
  return l.split(/\s+/).filter((p) => /\p{L}/u.test(p)).length >= 5;
}

/** Lo que no es código aunque tenga su pinta: trazas, logs, JSON (lo leen otros lectores). */
const TRAZA = /^(?:Traceback \(most recent call last\)|at [\w$.<>]+ \(.*:\d+:\d+\)$|File ".+", line \d+)/;
const LOG = /^\[?\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}|^\d{2}:\d{2}:\d{2}[.,]?\d* /;

const MINIMO_LINEAS = 3;
const FRACCION_CODIGO = 0.6;

/** ¿Es JSON válido? (Lo leerá el lector JSON.) */
function esJson(texto: string): boolean {
  const t = texto.trim();
  if (!/^[[{]/.test(t)) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
}

/** Fracción de líneas que parecen código (sin contar las vacías), o 0 si no es código. */
function fraccionDeCodigo(lineas: readonly string[]): number {
  let codigo = 0;
  let cuentan = 0;
  let enDocstring = false;
  for (const l of lineas) {
    if (TRAZA.test(l) || LOG.test(l)) return 0;
    // Docstrings de Python: la línea de las comillas triples es código; lo de dentro, documentación (no cuenta).
    const comillas = l.match(TRIPLES)?.length ?? 0;
    if (enDocstring) {
      if (comillas % 2) enDocstring = false;
      continue;
    }
    if (comillas % 2) enDocstring = true;
    // Los comentarios no dicen nada (ni a favor ni en contra): un script muy comentado sigue siendo código.
    if (COMENTARIO.test(l) && !l.startsWith('#!')) continue;
    cuentan++;
    if (esProsa(l)) continue;
    if (LINEA_DE_CODIGO.test(l) || esLineaDeLenguaje(l)) codigo++;
  }
  return cuentan >= MINIMO_LINEAS ? codigo / cuentan : 0;
}

/** Una línea de comentario en cualquiera de los 12 lenguajes. */
const COMENTARIO = /^(?:#|\/\/|\/\*|\*|--)/;
/** Comillas triples de Python. */
const TRIPLES = /"{3}|'{3}/g;

/**
 * Configuración (TOML, INI, `.env`): casi todo son `clave = valor`, `CLAVE=valor` o `[sección]`. Es del lector de
 * JSON, YAML y TOML (puesto 7 del Anexo D), no de Código.
 */
function esConfiguracion(lineas: readonly string[]): boolean {
  const datos = lineas.filter((l) => !/^[#;]/.test(l));
  if (!datos.length) return false;
  const deConfiguracion = datos.filter(
    (l) => /^\[[\w.\- "']+\]$/.test(l) || /^(?:export )?["']?[\w.-]+["']? ?= ?[^;(){}]*$/.test(l),
  ).length;
  return deConfiguracion / datos.length >= 0.7;
}

/** JSON con comentarios y comas finales (`tsconfig.json`, VS Code): ¿es JSON sin ellos? */
function esJsonConComentarios(texto: string): boolean {
  if (!/^\s*[[{]/.test(texto)) return false;
  const limpio = texto
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1');
  return esJson(limpio);
}

/** Caracteres que se miran para detectar. */
const MUESTRA = 50_000;

/**
 * Confianza de que un texto es código: 0,95 con una extensión de código; 0,8 si casi todo son líneas de código y
 * el lenguaje se reconoce; 0,7 si parece código sin lenguaje claro. Un texto con vallas de Markdown es un
 * documento; JSON, trazas y logs, de sus lectores.
 */
export function confianzaCodigo(texto: string, nombreArchivo?: string): number {
  if (!texto.trim()) return 0;
  if (lenguajePorExtension(nombreArchivo)) return 0.95;
  const t = texto.slice(0, MUESTRA);
  // Un log (también de JSON por línea o logfmt, que se parecen a código) es del lector Log.
  if (esJson(t) || /^[ \t]*(?:```|~~~)/m.test(t) || confianzaLog(t) > 0) return 0;
  const lineas = lineasDeCodigo(t);
  if (esJsonConComentarios(t) || esConfiguracion(lineas)) return 0;
  if (fraccionDeCodigo(lineas) < FRACCION_CODIGO) return 0;
  return lenguajePorSintaxis(t) ? 0.8 : 0.7;
}

export function analizarCodigo(texto: string, nombreArchivo?: string): DatosCodigo {
  const porExtension = lenguajePorExtension(nombreArchivo);
  const porSintaxis = porExtension ? null : lenguajePorSintaxis(texto);
  const definiciones = new Set<string>();
  for (const l of lineasDeCodigo(texto)) {
    if (definiciones.size >= MAX_DEFINICIONES) break;
    const nombre = DEFINICION.exec(l)?.[1] ?? FUNCION_COMO_VALOR.exec(l)?.[1];
    if (nombre) definiciones.add(nombre);
  }
  const normalizado = texto.replace(/\r\n?/g, '\n');
  return {
    lenguaje: porExtension ?? porSintaxis,
    comoSeSupo: porExtension ? 'extension' : porSintaxis ? 'sintaxis' : 'ninguno',
    lineas: normalizado ? normalizado.replace(/\n$/, '').split('\n').length : 0,
    caracteres: texto.length,
    definiciones: [...definiciones],
  };
}
