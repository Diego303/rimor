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
  /** El archivo del que lo lee curl (`-d @peticion.json`, `--data-binary @objeto.txt`): el texto es `@archivo`. */
  archivo?: string;
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
/** Lo que corta la orden fuera de comillas (también pegado a una palabra: `x.org|jq`). */
const CORTE = /^(?:\|\|?|&&|;|>>?|<|2>)/;

export interface Palabras {
  palabras: string[];
  /** Lo que va tras una tubería, un encadenado o una redirección, hasta el final de la orden. */
  tuberia?: string;
}

/**
 * Las palabras de una orden como las parte su shell, y lo que va tras una tubería. `null` si hay más de una orden
 * (otra línea sin continuar) o una comilla sin cerrar. Las líneas de comentario de delante (`# Lista los pagos`) no
 * cuentan. El «Copiar como cURL (cmd)» de Windows (`curl ^"…^"` o líneas que acaban en ` ^`) va por `palabrasCmd`.
 */
export function palabrasShell(texto: string): Palabras | null {
  const t = texto
    .replace(/^(?:[ \t]*(?:#[^\n]*)?\r?\n)+/, '')
    .replace(PROMPT, '')
    .trim();
  return /^curl(?:\.exe)?\s+\^"|[ \t]\^\r?\n/i.test(t) ? palabrasCmd(t) : palabrasBash(t);
}

/** Lo que queda tras el corte: hasta el final de la orden (sus continuaciones, juntas); otra orden detrás, `null`. */
function tuberiaDe(resto: string, continuacion: RegExp): string | null {
  const unido = resto.replace(continuacion, ' ');
  const salto = unido.search(/\r?\n/);
  if (salto >= 0 && unido.slice(salto).trim()) return null;
  return unido.trim();
}

/** bash (y zsh): comillas simples, dobles con sus escapes, `$'…'`, `\` y, de PowerShell, `` ` `` al final de línea. */
function palabrasBash(t: string): Palabras | null {
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
    if (c === '\\' || (c === '`' && /^`\r?\n/.test(t.slice(i)))) {
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
    if (c === "'") {
      const fin = t.indexOf("'", i + 1);
      if (fin < 0) return null;
      actual += t.slice(i + 1, fin);
      enPalabra = true;
      i = fin;
      continue;
    }
    if (c === '$' && t[i + 1] === "'") {
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
        if (d === '\\' && '"\\$`\n'.includes(t[j + 1] ?? '')) {
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
    if ((!enPalabra || c !== '2') && CORTE.test(t.slice(i, i + 2))) {
      cerrar();
      const tuberia = tuberiaDe(t.slice(i), /[ \t]*[\\`]\r?\n[ \t]*/g);
      return tuberia === null ? null : { palabras, tuberia };
    }
    actual += c;
    enPalabra = true;
  }
  cerrar();
  return { palabras };
}

/**
 * El «Copiar como cURL (cmd)» de Windows, en dos capas como lo lee Windows: primero cmd (`^x` es `x`, `^` al final
 * de línea continúa, y entre comillas dobles sin escapar nada se escapa; `|`, `&`, `>` sin escapar cortan), y después
 * curl.exe parte la línea con las reglas de MS CRT (las comillas agrupan; `\"` es una comilla; las barras, solo antes
 * de una comilla).
 */
function palabrasCmd(t: string): Palabras | null {
  let linea = '';
  let entreComillas = false;
  let tuberia: string | undefined;
  for (let i = 0; i < t.length; i++) {
    const c = t[i] ?? '';
    if (entreComillas) {
      if (c === '"') entreComillas = false;
      linea += c;
      continue;
    }
    if (c === '^') {
      const siguiente = t[i + 1];
      if (siguiente === '\r' && t[i + 2] === '\n') i += 2;
      else if (siguiente === '\n') i++;
      else {
        linea += siguiente ?? '';
        i++;
      }
      continue;
    }
    if (c === '"') {
      entreComillas = true;
      linea += c;
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (t.slice(i).trim()) return null;
      break;
    }
    if (c === '|' || c === '&' || c === '>' || c === '<') {
      const resto = tuberiaDe(t.slice(i), /[ \t]*\^\r?\n[ \t]*/g);
      if (resto === null) return null;
      tuberia = resto;
      break;
    }
    linea += c;
  }
  if (entreComillas) return null;
  const palabras = partirCrt(linea);
  return tuberia ? { palabras, tuberia } : { palabras };
}

/** Una línea de órdenes partida como lo hace MS CRT (lo que hace curl.exe con la suya). */
function partirCrt(linea: string): string[] {
  const palabras: string[] = [];
  let actual = '';
  let enPalabra = false;
  let entreComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i] ?? '';
    if (c === '\\') {
      let barras = 0;
      while (linea[i] === '\\') {
        barras++;
        i++;
      }
      if (linea[i] === '"') {
        actual += '\\'.repeat(Math.floor(barras / 2));
        if (barras % 2) actual += '"';
        else entreComillas = !entreComillas;
      } else {
        actual += '\\'.repeat(barras);
        i--;
      }
      enPalabra = true;
    } else if (c === '"') {
      entreComillas = !entreComillas;
      enPalabra = true;
    } else if (/\s/.test(c) && !entreComillas) {
      if (enPalabra) palabras.push(actual);
      actual = '';
      enPalabra = false;
    } else {
      actual += c;
      enPalabra = true;
    }
  }
  if (enPalabra) palabras.push(actual);
  return palabras;
}

/**
 * Un texto `$'…'` de bash desde `i` (con `\n`, `\t`, `\'`, `\\`, `\xHH`, `\uHHHH`, `\UHHHHHHHH`, `\nnn` octal y
 * `\cX`, que el «Copiar como cURL» de Chrome usa para `!` y los caracteres de control); `fin` es su comilla.
 */
function ansiC(t: string, i: number): { texto: string; fin: number } | null {
  const ESCAPES: Record<string, string> = {
    n: '\n',
    t: '\t',
    r: '\r',
    "'": "'",
    '"': '"',
    '\\': '\\',
    '?': '?',
    a: '\x07',
    b: '\b',
    e: '\x1b',
    E: '\x1b',
    f: '\f',
    v: '\v',
  };
  let texto = '';
  for (let j = i; j < t.length; j++) {
    const c = t[j] ?? '';
    if (c === "'") return { texto, fin: j };
    if (c !== '\\') {
      texto += c;
      continue;
    }
    const resto = t.slice(j + 1, j + 11);
    const numerico =
      /^x([0-9a-fA-F]{1,2})/.exec(resto) ??
      /^u([0-9a-fA-F]{1,4})/.exec(resto) ??
      /^U([0-9a-fA-F]{1,8})/.exec(resto) ??
      /^([0-7]{1,3})/.exec(resto);
    if (numerico) {
      const base = /^[0-7]/.test(numerico[0]) ? 8 : 16;
      const codigo = Number.parseInt(numerico[1] ?? '0', base);
      texto += codigo <= 0x10ffff ? String.fromCodePoint(codigo) : '';
      j += numerico[0].length;
    } else if (resto[0] === 'c' && resto[1]) {
      texto += String.fromCharCode(resto.charCodeAt(1) & 0x1f);
      j += 2;
    } else {
      const d = resto[0] ?? '';
      texto += ESCAPES[d] ?? `\\${d}`;
      j++;
    }
  }
  return null;
}

// ---------- Opciones de curl ----------

/** Las cortas que llevan valor (`-X POST`, `-XPOST`), según `curl --help all`. */
const CORTAS_CON_VALOR = new Set('AbcCdDeEFHKmoPQrtTuUwxXyYz'.split(''));
/** Las largas que llevan valor (las que `curl --help all` escribe con `<…>`). */
const LARGAS_CON_VALOR = new Set(
  `abstract-unix-socket alt-svc aws-sigv4 cacert capath cert cert-type ciphers config connect-timeout connect-to
continue-at cookie cookie-jar create-file-mode crlfile curves data data-ascii data-binary data-raw data-urlencode
delegation dns-interface dns-ipv4-addr dns-ipv6-addr dns-servers doh-url dump-header egd-file engine etag-compare
etag-save expect100-timeout form form-string ftp-account ftp-alternative-to-user ftp-method ftp-port ftp-ssl-ccc-mode
happy-eyeballs-timeout-ms haproxy-clientip header hostpubmd5 hostpubsha256 hsts interface ip-tos ipfs-gateway json
keepalive-time keepalive-cnt key key-type krb libcurl limit-rate local-port login-options mail-auth mail-from mail-rcpt
max-filesize max-redirs max-time netrc-file noproxy oauth2-bearer output output-dir pass pinnedpubkey preproxy proto
proto-default proto-redir proxy proxy-cacert proxy-capath proxy-cert proxy-cert-type proxy-ciphers proxy-crlfile
proxy-header proxy-key proxy-key-type proxy-pass proxy-pinnedpubkey proxy-service-name proxy-tls13-ciphers
proxy-tlsauthtype proxy-tlspassword proxy-tlsuser proxy-user proxy1.0 pubkey quote random-file range rate referer
request request-target resolve retry retry-delay retry-max-time sasl-authzid service-name socks4 socks4a socks5
socks5-gssapi-service socks5-hostname speed-limit speed-time stderr telnet-option tftp-blksize tls-max tls13-ciphers
tlsauthtype tlspassword tlsuser trace trace-ascii trace-config unix-socket upload-file url url-query user user-agent
variable write-out`.split(/\s+/),
);
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
  T: 'upload-file',
  U: 'proxy-user',
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

/**
 * `--data-urlencode` como lo manda curl: `nombre=valor` con el valor codificado; `=valor`, solo el valor codificado;
 * `valor` a secas, codificado; `nombre@archivo` y `@archivo` leen un archivo (se dejan como están).
 */
function urlencode(valor: string): string {
  const igual = valor.indexOf('=');
  const arroba = valor.indexOf('@');
  if (arroba >= 0 && (igual < 0 || arroba < igual)) return valor;
  if (igual < 0) return encodeURIComponent(valor);
  const nombre = valor.slice(0, igual);
  return nombre ? `${nombre}=${encodeURIComponent(valor.slice(igual + 1))}` : encodeURIComponent(valor.slice(1));
}

/**
 * ¿Parece una URL? Con esquema (`https://`), o un servidor (`api.example.org`, `localhost`, una IP) seguido de su
 * puerto, una ruta o nada. «Curl no funciona» o `--max-redirs 5` no dan una URL.
 */
export const pareceUrl = (s: string) =>
  /^[a-z][\w+.-]*:\/\/\S/i.test(s) ||
  /^(?:localhost|[\w-]+(?:\.[\w-]+)*\.[a-z][\w-]*|\d{1,3}(?:\.\d{1,3}){3}|\[[\da-f:]+\])(?::\d+)?(?:[/?#]\S*)?$/i.test(
    s,
  );

/** Un método HTTP (`GET`, `PROPFIND`): una palabra en mayúsculas. Lo demás no se repite en la respuesta como tal. */
export const esMetodo = (s: string) => /^[A-Z][A-Z0-9_-]{0,19}$/.test(s);

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
  let subida = false;
  const cabeceras: [string, string][] = [];
  const datos: string[] = [];
  /** De un archivo (`-d @x`; `--data-raw @x` es el texto `@x`). */
  const archivos: string[] = [];
  const formulario: [string, string][] = [];
  const otras: string[] = [];
  for (const o of opciones) {
    const v = o.valor ?? '';
    if (!o.nombre) {
      // La URL es la primera palabra suelta que lo parece (curl aceptaría varias; las demás quedan como opciones).
      if (url === undefined && pareceUrl(v)) url = v;
      else otras.push(...o.original);
    } else if (o.nombre === 'request') metodo = v.toUpperCase();
    else if (o.nombre === 'header') {
      const dos = v.indexOf(':');
      if (dos > 0) cabeceras.push([v.slice(0, dos).trim(), v.slice(dos + 1).trim()]);
      else otras.push(...o.original);
    } else if (DATOS.has(o.nombre)) {
      datos.push(o.nombre === 'data-urlencode' ? urlencode(v) : v);
      if (v.startsWith('@') && o.nombre !== 'data-raw' && o.nombre !== 'data-urlencode') archivos.push(v.slice(1));
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
    else {
      // `-T archivo` sube un archivo (PUT): se queda como opción para volver a escribirlo.
      if (o.nombre === 'upload-file') subida = true;
      otras.push(...o.original);
    }
  }
  if (!url) return null;
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
    const archivo = datos.length === 1 && archivos.length === 1 ? archivos[0] : undefined;
    cuerpo = {
      tipo,
      texto: unidos,
      ...(tipo === 'formulario' && !archivo ? { partes: pares(unidos) } : {}),
      ...(archivo ? { archivo } : {}),
    };
  } else if (formulario.length)
    cuerpo = { tipo: 'multipart', texto: formulario.map(([n, v]) => `${n}=${v}`).join('\n'), partes: formulario };
  const implicito = head ? 'HEAD' : cuerpo ? 'POST' : subida ? 'PUT' : 'GET';
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
