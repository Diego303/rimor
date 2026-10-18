/**
 * Trazas de error (LEC-05, plan §8.2): Rust, Python, JavaScript y Node, Java y Kotlin, Go y .NET. Tipo, mensaje,
 * dónde y marcos de pila, separando los de tu código de los de librerías y del sistema. TS puro.
 */

export type Lenguaje = 'rust' | 'python' | 'javascript' | 'java' | 'go' | 'dotnet';

export interface Marco {
  funcion: string;
  ruta: string;
  linea?: number;
  /** De tu código (no de una librería ni del sistema). */
  propio: boolean;
}

export interface Traza {
  lenguaje: Lenguaje;
  tipo: string;
  mensaje: string;
  /** Dónde pasó: `ruta:línea` del primer marco propio (o lo que diga la cabecera). */
  donde?: string | undefined;
  marcos: Marco[];
}

/** Rutas de librerías y del sistema (heurísticas del plan). */
const RUTA_DE_LIBRERIA =
  /node_modules|site-packages|dist-packages|\/usr\/lib\/python|\/lib\/python\d|<frozen|\.cargo\/registry|\/rustc\/|\/usr\/local\/go\/|\/go\/pkg\/mod\/|\/pkg\/mod\/|^node:|\binternal\/|^<anonymous>$|^native$/;

/** Funciones de librerías y del sistema, por su espacio de nombres. */
const FUNCION_DE_LIBRERIA =
  /^(?:java\.|javax\.|jdk\.|sun\.|com\.sun\.|kotlin\.|kotlinx\.|android\.|androidx\.|org\.springframework\.|org\.apache\.|org\.hibernate\.|com\.fasterxml\.|com\.zaxxer\.|io\.netty\.|reactor\.|scala\.|org\.junit\.|org\.gradle\.|System\.|Microsoft\.|Newtonsoft\.|Npgsql\.|std::|core::|alloc::|tokio::|futures::|hyper::|rust_begin_unwind|__rust|<core::|<alloc::|<std::|runtime\.|net\/http\.|sync\.|reflect\.|testing\.|JSON\.parse|process\.processTicksAndRejections)/;

const esDeLibreria = (funcion: string, ruta: string) =>
  RUTA_DE_LIBRERIA.test(ruta) || FUNCION_DE_LIBRERIA.test(funcion);

const lineas = (texto: string) => texto.replace(/\r\n?/g, '\n').split('\n');

/** `ruta:línea` del primer marco propio, si lo hay. */
function dondeDe(marcos: Marco[]): string | undefined {
  const m = marcos.find((x) => x.propio && x.ruta);
  return m ? `${m.ruta}${m.linea !== undefined ? `:${m.linea}` : ''}` : undefined;
}

// ---------- Rust ----------

const RUST_CABECERA = /^thread '([^']*)' panicked at (?:'(.*)', )?([^\s]+?:\d+:\d+):?\s*$/;
const RUST_MARCO = /^\s*(\d+): (.+)$/;
const RUST_EN = /^\s+at (.+?)(?::(\d+):\d+)?$/;

function rust(texto: string): Traza | null {
  const ls = lineas(texto);
  const i = ls.findIndex((l) => RUST_CABECERA.test(l.trim()));
  if (i < 0) return null;
  const cab = RUST_CABECERA.exec(ls[i]?.trim() ?? '');
  // Formato antiguo: el mensaje va entre comillas en la cabecera; el nuevo, en las líneas siguientes.
  const resto: string[] = [];
  for (let k = i + 1; k < ls.length; k++) {
    const l = ls[k] ?? '';
    if (/^(?:stack backtrace:|note: )/.test(l.trim()) || RUST_MARCO.test(l)) break;
    resto.push(l.trim());
  }
  const mensaje = (cab?.[2] ?? resto.join(' ')).trim();
  const marcos: Marco[] = [];
  const bt = ls.findIndex((l, k) => k > i && l.trim() === 'stack backtrace:');
  for (let k = bt < 0 ? ls.length : bt + 1; k < ls.length; k++) {
    const m = RUST_MARCO.exec(ls[k] ?? '');
    if (!m) continue;
    const funcion = (m[2] ?? '').trim();
    const en = RUST_EN.exec(ls[k + 1] ?? '');
    const ruta = en?.[1]?.trim() ?? '';
    if (en) k++;
    // En Rust, solo es propio un marco con ruta (los de la librería estándar a menudo no la tienen).
    marcos.push({
      funcion,
      ruta,
      ...(en?.[2] ? { linea: Number(en[2]) } : {}),
      propio: ruta !== '' && !esDeLibreria(funcion, ruta),
    });
  }
  const errValor = /on an `Err` value: ([A-Z][A-Za-z0-9_]*)/.exec(mensaje);
  return {
    lenguaje: 'rust',
    tipo: errValor?.[1] ?? 'panic',
    mensaje,
    donde: dondeDe(marcos) ?? cab?.[3],
    marcos,
  };
}

// ---------- Python ----------

const PY_MARCO = /^\s*File "(.+?)", line (\d+), in (.+)$/;
const PY_FINAL = /^([A-Za-z_][\w.]*)(?:: ?(.*))?$/;

function python(texto: string): Traza | null {
  const ls = lineas(texto);
  const inicio = ls.findIndex((l) => l.trim() === 'Traceback (most recent call last):');
  if (inicio < 0) return null;
  const marcos: Marco[] = [];
  let tipo = '';
  let mensaje = '';
  for (let k = inicio + 1; k < ls.length; k++) {
    const l = ls[k] ?? '';
    const m = PY_MARCO.exec(l);
    if (m) {
      const ruta = m[1] ?? '';
      const funcion = m[3] ?? '';
      marcos.push({ funcion, ruta, linea: Number(m[2]), propio: !esDeLibreria(funcion, ruta) });
      continue;
    }
    // La última línea sin sangría es `Tipo: mensaje` (la de la excepción que se lanzó).
    if (!/^\s/.test(l) && l.trim()) {
      const f = PY_FINAL.exec(l.trim());
      if (f) {
        tipo = f[1] ?? '';
        mensaje = f[2] ?? '';
      }
    }
  }
  if (!tipo) return null;
  // El marco más interno es el último: «dónde» es el último propio.
  const propio = [...marcos].reverse().find((m) => m.propio);
  return {
    lenguaje: 'python',
    tipo,
    mensaje,
    ...(propio ? { donde: `${propio.ruta}:${propio.linea}` } : {}),
    marcos,
  };
}

// ---------- JavaScript y Node ----------

const JS_CABECERA =
  /^(?:Uncaught (?:\(in promise\) )?)?([A-Za-z_$][\w$.]*(?:Error|Exception)|Error)(?: \[[\w-]+\])?: (.*)$/;
const JS_MARCO = /^\s+at (?:async )?(?:(.+?) \((.+?)\)|(.+))$/;

function partirRutaJs(s: string): { ruta: string; linea?: number } {
  const m = /^(.*?):(\d+):(\d+)$/.exec(s);
  return m ? { ruta: m[1] ?? '', linea: Number(m[2]) } : { ruta: s };
}

function javascript(texto: string): Traza | null {
  const ls = lineas(texto);
  const i = ls.findIndex((l) => JS_CABECERA.test(l.trim()));
  if (i < 0) return null;
  const cab = JS_CABECERA.exec(ls[i]?.trim() ?? '');
  const marcos: Marco[] = [];
  for (let k = i + 1; k < ls.length; k++) {
    const m = JS_MARCO.exec(ls[k] ?? '');
    if (!m) continue;
    const funcion = m[1]?.trim() ?? '';
    const { ruta, linea } = partirRutaJs((m[2] ?? m[3] ?? '').trim());
    marcos.push({ funcion, ruta, ...(linea !== undefined ? { linea } : {}), propio: !esDeLibreria(funcion, ruta) });
  }
  // Sin ningún marco `at …` no es una traza de JavaScript (sería un mensaje suelto).
  if (!marcos.length) return null;
  return { lenguaje: 'javascript', tipo: cab?.[1] ?? 'Error', mensaje: cab?.[2] ?? '', donde: dondeDe(marcos), marcos };
}

// ---------- Java y Kotlin ----------

const JAVA_TIPO = String.raw`((?:[a-z_][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error|Throwable))`;
const JAVA_CABECERA = new RegExp(String.raw`^(?:Exception in thread "[^"]*" )?${JAVA_TIPO}(?:: (.*))?$`);
const JAVA_CAUSA = new RegExp(String.raw`^Caused by: ${JAVA_TIPO}(?:: (.*))?$`);
const JAVA_MARCO = /^\s*at (?:[\w.]+\/)?([\w$.<>]+)\.([\w$<>]+)\(([^)]*)\)/;

function java(texto: string): Traza | null {
  const ls = lineas(texto);
  const i = ls.findIndex((l) => JAVA_CABECERA.test(l.trim()));
  if (i < 0) return null;
  const cab = JAVA_CABECERA.exec(ls[i]?.trim() ?? '');
  let tipo = cab?.[1] ?? '';
  let mensaje = cab?.[2] ?? '';
  const marcos: Marco[] = [];
  for (let k = i + 1; k < ls.length; k++) {
    const l = ls[k] ?? '';
    const causa = JAVA_CAUSA.exec(l.trim());
    if (causa) {
      // La causa más profunda es la que explica el error.
      tipo = causa[1] ?? tipo;
      mensaje = causa[2] ?? '';
      continue;
    }
    const m = JAVA_MARCO.exec(l);
    if (!m) continue;
    const clase = m[1] ?? '';
    const funcion = `${clase}.${m[2] ?? ''}`;
    const archivo = /^(.+?):(\d+)$/.exec(m[3] ?? '');
    const ruta = archivo?.[1] ?? m[3] ?? '';
    marcos.push({
      funcion,
      ruta,
      ...(archivo ? { linea: Number(archivo[2]) } : {}),
      propio: !esDeLibreria(funcion, ''),
    });
  }
  if (!marcos.length && !/^Exception in thread/.test(ls[i]?.trim() ?? '')) return null;
  return { lenguaje: 'java', tipo, mensaje, donde: dondeDe(marcos), marcos };
}

// ---------- Go ----------

const GO_CABECERA = /^(panic|fatal error): (.*)$/;
const GO_FUNCION = /^([\w./*()-]+?)\((?:.*)\)$|^created by (.+)$/;
const GO_RUTA = /^\t(.+?\.go):(\d+)(?: \+0x[0-9a-f]+)?$/;

/** En Go, la librería estándar no lleva punto en la primera parte de su ruta (`net/http`); un módulo, sí. */
function goPropio(funcion: string, ruta: string): boolean {
  if (esDeLibreria(funcion, ruta)) return false;
  const primera = funcion.split('/')[0] ?? '';
  return (
    funcion.startsWith('main.') || (primera.includes('.') && !/^(?:runtime|sync|net|reflect|internal)\b/.test(primera))
  );
}

function go(texto: string): Traza | null {
  const ls = lineas(texto);
  const i = ls.findIndex((l) => GO_CABECERA.test(l.trim()));
  if (i < 0 || !ls.some((l) => /^goroutine \d+ \[/.test(l))) return null;
  const cab = GO_CABECERA.exec(ls[i]?.trim() ?? '');
  const clase = cab?.[1] ?? 'panic';
  const mensaje = cab?.[2]?.replace(/ \[recovered\]$/, '') ?? '';
  const marcos: Marco[] = [];
  for (let k = i + 1; k < ls.length; k++) {
    const f = GO_FUNCION.exec(ls[k] ?? '');
    const r = GO_RUTA.exec(ls[k + 1] ?? '');
    if (!f || !r) continue;
    const funcion = (f[1] ?? f[2] ?? '').trim();
    const ruta = r[1] ?? '';
    marcos.push({ funcion, ruta, linea: Number(r[2]), propio: goPropio(funcion, ruta) });
    k++;
  }
  const tipo =
    clase === 'fatal error' ? 'fatal error' : mensaje.startsWith('runtime error:') ? 'runtime error' : 'panic';
  return { lenguaje: 'go', tipo, mensaje, donde: dondeDe(marcos), marcos };
}

// ---------- .NET ----------

const NET_CABECERA = /^(?:Unhandled exception\. )?((?:[A-Z][\w]*\.)+[A-Z]\w*(?:Exception|Error))(?: \(\d+\))?: (.*)$/;
const NET_MARCO = /^\s+at (.+?)\((.*?)\)(?: in (.+?):line (\d+))?\s*$/;

function dotnet(texto: string): Traza | null {
  const ls = lineas(texto);
  const i = ls.findIndex((l) => NET_CABECERA.test(l.trim()));
  if (i < 0) return null;
  const cab = NET_CABECERA.exec(ls[i]?.trim() ?? '');
  const marcos: Marco[] = [];
  for (let k = i + 1; k < ls.length; k++) {
    const m = NET_MARCO.exec(ls[k] ?? '');
    if (!m) continue;
    // Un marco de Java (`(Archivo.java:12)`) no es de .NET.
    if (/\.(?:java|kt|scala):\d+$|^(?:Native Method|Unknown Source)$/.test(m[2] ?? '')) return null;
    const funcion = m[1] ?? '';
    const ruta = m[3] ?? '';
    marcos.push({ funcion, ruta, ...(m[4] ? { linea: Number(m[4]) } : {}), propio: !esDeLibreria(funcion, ruta) });
  }
  if (!marcos.length && !/^Unhandled exception\./.test(ls[i]?.trim() ?? '')) return null;
  return { lenguaje: 'dotnet', tipo: cab?.[1] ?? '', mensaje: cab?.[2] ?? '', donde: dondeDe(marcos), marcos };
}

/** Analiza una traza de cualquiera de los lenguajes; `null` si no se reconoce. */
export function analizarTraza(texto: string): Traza | null {
  return rust(texto) ?? python(texto) ?? go(texto) ?? java(texto) ?? dotnet(texto) ?? javascript(texto);
}

/** Un mensaje de error suelto, sin traza («TypeError: x is not a function», «panic: …»). */
export const ERROR_SUELTO =
  /^(?:Uncaught )?(?:[A-Za-z_$][\w$.]*(?:Error|Exception)|panic|fatal error|Traceback)(?: \[[\w-]+\])?:\s*\S/;
