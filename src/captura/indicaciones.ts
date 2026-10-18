/**
 * Indicaciones del compositor (CAP-03, IN-015): `/tipo` al principio, `@colección` y `#etiqueta` al final y
 * `?texto` para buscar. TS puro. Lo que se parece pero no es una indicación (un correo, `#` en código, una
 * ruta `/var/log`, un color en hexadecimal) se deja en el cuerpo.
 */
import { esTipoElemento, type TipoElemento } from '@rimor/formato';

export interface Indicaciones {
  cuerpo: string;
  tipo?: TipoElemento;
  colecciones: string[];
  etiquetas: string[];
  busqueda?: string;
}

/** Palabras de `/tipo` además de los nombres de `TIPOS_ELEMENTO`. */
export const ALIAS_TIPO: Readonly<Record<string, TipoElemento>> = {
  err: 'error',
  med: 'mediciones',
  md: 'markdown',
  doc: 'markdown',
  url: 'enlace',
  csv: 'datos',
  code: 'codigo',
  cod: 'codigo',
  cmd: 'comando',
  yaml: 'json',
  toml: 'json',
  nota: 'texto',
  txt: 'texto',
};

export function tipoDePalabra(palabra: string): TipoElemento | undefined {
  const p = palabra.toLowerCase();
  return esTipoElemento(p) ? p : ALIAS_TIPO[p];
}

const NOMBRE = String.raw`[\p{L}\p{N}_](?:[\p{L}\p{N}_.\/-]*[\p{L}\p{N}_])?`;
/** Una indicación suelta: `@nombre` o `#nombre`. */
const UNA = new RegExp(`^[@#]${NOMBRE}$`, 'u');
/** Directivas de preprocesador que cierran código (no etiquetas). `#error` o `#region` sí pueden ser etiquetas. */
const PREPROCESADOR = /^#(?:include|define|undef|ifdef|ifndef|elif|endif|pragma|endregion)$/;

/** ¿Está el final del texto dentro de un bloque de código (cerca abierta) o es su cierre? */
function terminaEnCodigo(lineas: readonly string[]): boolean {
  let abiertas = 0;
  for (const l of lineas.slice(0, -1)) if (/^\s*(```|~~~)/.test(l)) abiertas ^= 1;
  return abiertas === 1;
}

const esIndicacion = (p: string) => UNA.test(p) && !PREPROCESADOR.test(p);

/** Separa en palabras una línea de indicaciones; `null` si alguna no lo es. */
function indicacionesDe(linea: string): string[] | null {
  const palabras = linea.trim().split(/\s+/).filter(Boolean);
  return palabras.length && palabras.every(esIndicacion) ? palabras : null;
}

/**
 * Las indicaciones seguidas al final de una línea, recorriendo sus palabras desde el final (lineal: un texto
 * enorme con muchas `@` en medio no se atasca). Devuelve dónde empiezan, o `null`.
 */
function indicacionesAlFinal(linea: string): { desde: number; palabras: string[] } | null {
  const fichas = [...linea.matchAll(/\S+/g)];
  let i = fichas.length;
  while (i > 0 && esIndicacion(fichas[i - 1]?.[0] ?? '')) i--;
  if (i === fichas.length) return null;
  return { desde: fichas[i]?.index ?? 0, palabras: fichas.slice(i).map((f) => f[0]) };
}

export function analizarIndicaciones(texto: string): Indicaciones {
  const vacio = { colecciones: [], etiquetas: [] };
  const recortado = texto.replace(/\s+$/, '');
  const inicio = recortado.trimStart();
  if (inicio.startsWith('?')) {
    const busqueda = inicio.slice(1).trim();
    if (busqueda) return { cuerpo: '', busqueda, ...vacio };
  }

  let cuerpo = recortado;
  let tipo: TipoElemento | undefined;
  const m = /^\s*\/([\p{L}]+)(?=\s|$)/u.exec(cuerpo);
  const delTipo = m?.[1] ? tipoDePalabra(m[1]) : undefined;
  if (m && delTipo) {
    tipo = delTipo;
    cuerpo = cuerpo.slice(m[0].length).replace(/^[ \t]*\n?/, '');
  }

  const lineas = cuerpo.split('\n');
  let palabras: string[] | null = null;
  // Tras «clave:» lo que sigue es un valor (un color en CSS), no una indicación.
  const esValor = (antes: string) => /:\s*$/.test(antes);
  if (lineas.length > 1) {
    const ultima = lineas[lineas.length - 1] ?? '';
    const previas = lineas.slice(0, -1).join('\n').replace(/\s+$/, '');
    if (!terminaEnCodigo(lineas) && !esValor(previas)) palabras = indicacionesDe(ultima);
    if (palabras) cuerpo = previas;
  } else {
    // Una sola línea: las indicaciones del final (o la línea entera, si solo tiene indicaciones).
    const fin = indicacionesAlFinal(cuerpo);
    const antes = fin ? cuerpo.slice(0, fin.desde) : '';
    if (fin && !esValor(antes)) {
      palabras = fin.palabras;
      cuerpo = antes.replace(/\s+$/, '');
    }
  }

  const colecciones: string[] = [];
  const etiquetas: string[] = [];
  for (const p of palabras ?? []) {
    const lista = p.startsWith('@') ? colecciones : etiquetas;
    const nombre = p.slice(1);
    if (!lista.includes(nombre)) lista.push(nombre);
  }
  return { cuerpo, ...(tipo ? { tipo } : {}), colecciones, etiquetas };
}
