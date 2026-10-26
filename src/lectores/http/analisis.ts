/**
 * Análisis de una petición `curl` (LEC-13, IN-046): las palabras como las parte un shell (bash, o el «Copiar como
 * cURL (cmd)» de Windows), el método, la URL con su consulta, las cabeceras, el cuerpo, el usuario y las opciones; lo
 * que va tras una tubería, aparte. Lo de vuelta (cURL y `fetch`) está en `exportar.ts`, que solo carga la vista. TS
 * puro.
 */

export type TipoCuerpo = 'json' | 'formulario' | 'multipart' | 'texto';

export interface CuerpoHttp {
  tipo: TipoCuerpo;
  texto: string;
  /** Las partes de un multipart (`-F nombre=valor`) o los campos de un formulario. */
  partes?: [string, string][];
}

export interface PeticionHttp {
  metodo: string;
  url: string;
  consulta: [string, string][];
  cabeceras: [string, string][];
  cuerpo?: CuerpoHttp;
  /** `usuario:contraseña` de `-u` (la contraseña, normalmente oculta). */
  usuario?: string;
  /** Las opciones que no cambian la petición (`-L`, `--compressed`, `-o salida.json`), como se escribieron. */
  opciones: string[];
  /** Lo que va tras la petición: `| jq '.x'`, `> salida.json`. */
  tuberia?: string;
}

// ---------- Palabras ----------

/** Un prompt delante (`$ `, `% `, `❯ `). */
const PROMPT = /^\s*(?:\$|%|❯)\s+/;
/** Lo que corta la orden fuera de comillas: tuberías, encadenados y redirecciones. */
const CORTE = /^(?:\|\|?|&&|;|>>?|<|2>)/;

/**
 * Las palabras de una orden como las parte un shell, y lo que va tras una tubería o un encadenado. `null` si hay
 * más de una orden (otra línea sin continuar) o una comilla sin cerrar. En `cmd` (el «Copiar como cURL» de Windows),
 * `^` escapa y continúa la línea, y solo cuentan las comillas dobles.
 */
export function palabrasShell(texto: string): { palabras: string[]; tuberia?: string } | null {
  const t = texto.replace(PROMPT, '').trim();
  const cmd = /\^\r?\n|\^"/.test(t);
  const palabras: string[] = [];
  let actual = '';
  let enPalabra = false;
  const cerrar = () => {
    if (enPalabra) palabras.push(actual);
    actual = '';
    enPalabra = false;
  };
  for (let i = 0; i < t.length; i++) {
    const c = t[i] ?? '';
    if (cmd && c === '^') {
      // `^` + salto de línea continúa; `^x` es `x`.
      const siguiente = t[i + 1];
      if (siguiente === '\r' && t[i + 2] === '\n') i += 2;
      else if (siguiente === '\n') i++;
      else {
        actual += siguiente ?? '';
        enPalabra = true;
        i++;
      }
      continue;
    }
    if (!cmd && c === '\\') {
      const siguiente = t[i + 1];
      if (siguiente === '\r' && t[i + 2] === '\n') i += 2;
      else if (siguiente === '\n') i++;
      else {
        actual += siguiente ?? '';
        enPalabra = true;
        i++;
      }
      continue;
    }
    if (c === "'" && !cmd) {
      const fin = t.indexOf("'", i + 1);
      if (fin < 0) return null;
      actual += t.slice(i + 1, fin);
      enPalabra = true;
      i = fin;
      continue;
    }
    if (c === '$' && t[i + 1] === "'" && !cmd) {
      const r = ansiC(t, i + 2);
      if (!r) return null;
      actual += r.texto;
      enPalabra = true;
      i = r.fin;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      for (; j < t.length && t[j] !== '"'; j++) {
        const d = t[j] ?? '';
        if (cmd && d === '^') {
          actual += t[++j] ?? '';
        } else if (!cmd && d === '\\' && '"\\$`\n'.includes(t[j + 1] ?? '')) {
          if (t[j + 1] !== '\n') actual += t[j + 1];
          j++;
        } else actual += d;
      }
      if (j >= t.length) return null;
      enPalabra = true;
      i = j;
      continue;
    }
    if (c === '\n' || c === '\r') {
      cerrar();
      // Otra orden detrás: no es una sola petición.
      if (t.slice(i).trim()) return null;
      break;
    }
    if (/\s/.test(c)) {
      cerrar();
      continue;
    }
    if (!enPalabra && CORTE.test(t.slice(i))) {
      cerrar();
      const tuberia = t
        .slice(i)
        .replace(/\s*\\\r?\n\s*/g, ' ')
        .trim();
      return { palabras, tuberia };
    }
    actual += c;
    enPalabra = true;
  }
  cerrar();
  return { palabras };
}

/** Un texto `$'…'` de bash (con `\n`, `\t`, `\'`, `\\`, `\xHH`) desde `i`; `fin` es su comilla de cierre. */
function ansiC(t: string, i: number): { texto: string; fin: number } | null {
  const ESCAPES: Record<string, string> = {
    n: '\n',
    t: '\t',
    r: '\r',
    "'": "'",
    '"': '"',
    '\\': '\\',
    a: '\x07',
    e: '\x1b',
  };
  let texto = '';
  for (let j = i; j < t.length; j++) {
    const c = t[j] ?? '';
    if (c === "'") return { texto, fin: j };
    if (c !== '\\') {
      texto += c;
      continue;
    }
    const d = t[j + 1] ?? '';
    const hex = /^x([0-9a-fA-F]{1,2})/.exec(t.slice(j + 1));
    if (hex) {
      texto += String.fromCharCode(Number.parseInt(hex[1] ?? '0', 16));
      j += hex[0].length;
    } else {
      texto += ESCAPES[d] ?? `\\${d}`;
      j++;
    }
  }
  return null;
}

// ---------- Opciones de curl ----------

/** Las cortas que llevan valor (`-X POST`, `-XPOST`). */
const CORTAS_CON_VALOR = new Set('XHdFubAeoTxwmrcKECUyYzQt'.split(''));
/** Las largas que llevan valor. */
const LARGAS_CON_VALOR = new Set([
  'request',
  'header',
  'data',
  'data-raw',
  'data-binary',
  'data-ascii',
  'data-urlencode',
  'json',
  'form',
  'form-string',
  'user',
  'cookie',
  'user-agent',
  'referer',
  'url',
  'output',
  'upload-file',
  'proxy',
  'write-out',
  'max-time',
  'connect-timeout',
  'range',
  'cookie-jar',
  'config',
  'cert',
  'cacert',
  'key',
  'retry',
  'resolve',
  'interface',
  'limit-rate',
  'oauth2-bearer',
]);
const CORTA_A_LARGA: Record<string, string> = {
  X: 'request',
  H: 'header',
  d: 'data',
  F: 'form',
  u: 'user',
  b: 'cookie',
  A: 'user-agent',
  e: 'referer',
  I: 'head',
  G: 'get',
};

/** `-sSL` → `-s`, `-S`, `-L`; `-XPOST` → `-X`, `POST`; `--data=x` → `--data`, `x`. */
function opcionesDe(palabras: readonly string[]): { nombre: string; valor?: string; original: string[] }[] | null {
  const fuera: { nombre: string; valor?: string; original: string[] }[] = [];
  for (let i = 1; i < palabras.length; i++) {
    const p = palabras[i] ?? '';
    if (p.startsWith('--') && p.length > 2) {
      const igual = p.indexOf('=');
      const nombre = igual > 0 ? p.slice(2, igual) : p.slice(2);
      if (igual > 0) fuera.push({ nombre, valor: p.slice(igual + 1), original: [p] });
      else if (LARGAS_CON_VALOR.has(nombre)) {
        if (i + 1 >= palabras.length) return null;
        fuera.push({ nombre, valor: palabras[i + 1] ?? '', original: [p, palabras[i + 1] ?? ''] });
        i++;
      } else fuera.push({ nombre, original: [p] });
    } else if (p.startsWith('-') && p.length > 1) {
      for (let k = 1; k < p.length; k++) {
        const letra = p[k] ?? '';
        const nombre = CORTA_A_LARGA[letra] ?? letra;
        if (CORTAS_CON_VALOR.has(letra)) {
          const pegado = p.slice(k + 1);
          if (pegado) fuera.push({ nombre, valor: pegado, original: [`-${letra}${pegado}`] });
          else {
            if (i + 1 >= palabras.length) return null;
            fuera.push({ nombre, valor: palabras[i + 1] ?? '', original: [`-${letra}`, palabras[i + 1] ?? ''] });
            i++;
          }
          break;
        }
        fuera.push({ nombre, original: [`-${letra}`] });
      }
    } else fuera.push({ nombre: '', valor: p, original: [p] });
  }
  return fuera;
}

const DATOS = new Set(['data', 'data-raw', 'data-binary', 'data-ascii', 'data-urlencode', 'json']);

/** `nombre=valor` de `--data-urlencode`: el valor, codificado (`=valor` o `valor` solos, también). */
function urlencode(valor: string): string {
  const igual = valor.indexOf('=');
  if (igual < 0) return encodeURIComponent(valor);
  return `${valor.slice(0, igual)}=${encodeURIComponent(valor.slice(igual + 1))}`;
}

/** Los pares `a=1&b=2` (sin descodificar lo que no se puede). */
export function pares(texto: string): [string, string][] {
  const des = (s: string) => {
    try {
      return decodeURIComponent(s.replace(/\+/g, ' '));
    } catch {
      return s;
    }
  };
  return texto
    .split('&')
    .filter(Boolean)
    .map((p) => {
      const igual = p.indexOf('=');
      return igual < 0 ? [des(p), ''] : [des(p.slice(0, igual)), des(p.slice(igual + 1))];
    });
}

/** La consulta de una URL (`?a=1&b=2`), sin el fragmento. */
export function consultaDe(url: string): [string, string][] {
  const q = url.indexOf('?');
  if (q < 0) return [];
  return pares(url.slice(q + 1).split('#')[0] ?? '');
}

const esJson = (texto: string) => {
  const t = texto.trim();
  if (!/^[[{]/.test(t)) return false;
  try {
    JSON.parse(t);
    return true;
  } catch {
    return false;
  }
};

const cabecera = (cabeceras: readonly [string, string][], nombre: string) =>
  cabeceras.find(([n]) => n.toLowerCase() === nombre.toLowerCase())?.[1];

/** La petición de un único `curl` con URL, o `null`. */
export function analizarCurl(texto: string): PeticionHttp | null {
  const partido = palabrasShell(texto);
  if (!partido || !/^curl(?:\.exe)?$/i.test(partido.palabras[0] ?? '')) return null;
  const opciones = opcionesDe(partido.palabras);
  if (!opciones) return null;
  let metodo: string | undefined;
  let url: string | undefined;
  let usuario: string | undefined;
  let get = false;
  let head = false;
  let json = false;
  const cabeceras: [string, string][] = [];
  const datos: string[] = [];
  const formulario: [string, string][] = [];
  const otras: string[] = [];
  for (const o of opciones) {
    const v = o.valor ?? '';
    if (!o.nombre) {
      if (url === undefined) url = v;
      else otras.push(...o.original);
    } else if (o.nombre === 'request') metodo = v.toUpperCase();
    else if (o.nombre === 'header') {
      const dos = v.indexOf(':');
      if (dos > 0) cabeceras.push([v.slice(0, dos).trim(), v.slice(dos + 1).trim()]);
      else otras.push(...o.original);
    } else if (DATOS.has(o.nombre)) {
      datos.push(o.nombre === 'data-urlencode' ? urlencode(v) : v);
      if (o.nombre === 'json') json = true;
    } else if (o.nombre === 'form' || o.nombre === 'form-string') {
      const igual = v.indexOf('=');
      formulario.push(igual < 0 ? [v, ''] : [v.slice(0, igual), v.slice(igual + 1)]);
    } else if (o.nombre === 'user') usuario = v;
    else if (o.nombre === 'cookie' && v.includes('=')) cabeceras.push(['Cookie', v]);
    else if (o.nombre === 'user-agent') cabeceras.push(['User-Agent', v]);
    else if (o.nombre === 'referer') cabeceras.push(['Referer', v]);
    else if (o.nombre === 'oauth2-bearer') cabeceras.push(['Authorization', `Bearer ${v}`]);
    else if (o.nombre === 'url') url = v;
    else if (o.nombre === 'get') get = true;
    else if (o.nombre === 'head') head = true;
    else otras.push(...o.original);
  }
  if (!url || /^-/.test(url)) return null;
  let cuerpo: CuerpoHttp | undefined;
  const unidos = datos.join('&');
  if (get && datos.length) url += (url.includes('?') ? '&' : '?') + unidos;
  else if (datos.length) {
    if (json) {
      if (!cabecera(cabeceras, 'Content-Type')) cabeceras.push(['Content-Type', 'application/json']);
      if (!cabecera(cabeceras, 'Accept')) cabeceras.push(['Accept', 'application/json']);
    }
    const tipoContenido = cabecera(cabeceras, 'Content-Type') ?? '';
    const tipo: TipoCuerpo =
      json || /json/i.test(tipoContenido) || esJson(unidos)
        ? 'json'
        : /^(?:$|application\/x-www-form-urlencoded)/i.test(tipoContenido) && /^[^\s=&]+=/.test(unidos)
          ? 'formulario'
          : 'texto';
    cuerpo = { tipo, texto: unidos, ...(tipo === 'formulario' ? { partes: pares(unidos) } : {}) };
  } else if (formulario.length)
    cuerpo = { tipo: 'multipart', texto: formulario.map(([n, v]) => `${n}=${v}`).join('\n'), partes: formulario };
  const implicito = head ? 'HEAD' : cuerpo ? 'POST' : 'GET';
  return {
    metodo: metodo || implicito,
    url,
    consulta: consultaDe(url),
    cabeceras,
    ...(cuerpo ? { cuerpo } : {}),
    ...(usuario !== undefined ? { usuario } : {}),
    opciones: otras,
    ...(partido.tuberia ? { tuberia: partido.tuberia } : {}),
  };
}

/** `api.example.org/v1/pagos` (sin esquema ni consulta), recortada a `largo`. */
export function urlCorta(url: string, largo = 60): string {
  const sin = url.replace(/^[a-z][\w+.-]*:\/\//i, '').split(/[?#]/)[0] ?? '';
  return sin.length > largo ? `${sin.slice(0, largo - 1)}…` : sin;
}

/** El servidor de la URL (`api.example.org`). */
export const hostDe = (url: string) => urlCorta(url, 200).split('/')[0] ?? '';
