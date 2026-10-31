/**
 * Secretos de una petición HTTP (IN-046) que una expresión sola no encuentra bien: el valor de cada cookie y la
 * contraseña de `curl -u`. Los dos se leen como argumentos de un shell (`'…'`, `$'…'`, `"…"`, el `^"…^"` del
 * «Copiar como cURL (cmd)» o sin comillas) para no cortar en una comilla de dentro ni comerse la de cierre. Lineales:
 * corren en cada captura.
 */

const PREFIJO_MARCA = '‹oculto:';
/** Una variable (`$SESION`, `{{token}}`) no es un secreto. */
const esVariable = (s: string) => /^(?:\$|\{\{)/.test(s);

type Comilla = "'" | "$'" | '"' | '^"' | null;

/** La comilla con la que empieza el argumento en `i` (y cuántos caracteres ocupa). */
function comillaEn(texto: string, i: number): { comilla: Comilla; largo: number } {
  if (texto.startsWith("$'", i)) return { comilla: "$'", largo: 2 };
  if (texto.startsWith('^"', i)) return { comilla: '^"', largo: 2 };
  if (texto[i] === "'" || texto[i] === '"') return { comilla: texto[i] as "'" | '"', largo: 1 };
  return { comilla: null, largo: 0 };
}

/** La comilla que abre el argumento que acaba justo antes de `i` (`-H 'Cookie: …`: la `'`). */
function comillaAntes(texto: string, i: number): Comilla {
  const c = texto[i - 1];
  if (c === "'") return texto[i - 2] === '$' ? "$'" : "'";
  if (c === '"') return texto[i - 2] === '^' ? '^"' : '"';
  return null;
}

/**
 * Dónde acaba (sin la comilla de cierre) el argumento que empieza en `i` con `comilla`: la misma comilla sin escapar,
 * o, sin comillas, el primer blanco. Sin cierre, el final de la línea.
 */
function finDeArgumento(texto: string, i: number, comilla: Comilla): number {
  const finLinea = () => {
    const n = texto.indexOf('\n', i);
    return n < 0 ? texto.length : n;
  };
  if (comilla === "'") {
    const fin = texto.indexOf("'", i);
    return fin < 0 ? finLinea() : fin;
  }
  if (comilla === '^"') {
    const fin = texto.indexOf('^"', i);
    return fin < 0 ? finLinea() : fin;
  }
  if (comilla === "$'" || comilla === '"') {
    const cierre = comilla === '"' ? '"' : "'";
    for (let j = i; j < texto.length; j++) {
      if (texto[j] === '\\') j++;
      else if (texto[j] === cierre) return j;
      else if (texto[j] === '\n') return j;
    }
    return texto.length;
  }
  const m = /[\s'"]/.exec(texto.slice(i, i + 8192));
  return m ? i + m.index : Math.min(texto.length, i + 8192);
}

/** Los tramos de los valores de las cookies de `valor` (`a=VALOR; b=VALOR`), que empieza en `desde`. */
function valoresDeCookies(valor: string, desde: number, soloElPrimero = false): [number, number][] {
  const tramos: [number, number][] = [];
  let inicio = desde;
  for (const par of valor.split(';')) {
    const igual = par.indexOf('=');
    const crudo = igual < 0 ? '' : par.slice(igual + 1);
    const posicion = inicio + igual + 1 + (crudo.length - crudo.trimStart().length);
    const limpio = crudo.trim();
    if (igual >= 0 && limpio && !limpio.startsWith(PREFIJO_MARCA) && !esVariable(limpio))
      tramos.push([posicion, posicion + limpio.length]);
    if (soloElPrimero) break;
    inicio += par.length + 1;
  }
  return tramos;
}

/** Lo que guarda una cookie de respuesta cuando es una sesión, no un ajuste (`tema=oscuro`): un valor largo. */
const LARGO_SESION = 16;

/**
 * El valor de cada cookie de la cabecera `Cookie:` (dentro de su argumento de shell si va en uno, o hasta el final de
 * la línea), y el de una `Set-Cookie:` si parece una sesión (16 caracteres o más; sus atributos, como `Path`, no).
 */
export function cookiesDeCabecera(texto: string): [number, number][] {
  const tramos: [number, number][] = [];
  for (const m of texto.matchAll(/(?<![\w-])(Set-)?Cookie:[ \t]*/gi)) {
    const inicio = (m.index ?? 0) + m[0].length;
    const fin = finDeArgumento(texto, inicio, comillaAntes(texto, m.index ?? 0));
    const valor = texto.slice(inicio, fin);
    if (!m[1]) tramos.push(...valoresDeCookies(valor, inicio));
    else for (const [a, b] of valoresDeCookies(valor, inicio, true)) if (b - a >= LARGO_SESION) tramos.push([a, b]);
  }
  return tramos;
}

/** El valor de cada cookie de `curl -b 'a=b'` o `--cookie` (con `=`: `-b cookies.txt` es un archivo). */
export function cookiesDeCurl(texto: string): [number, number][] {
  const tramos: [number, number][] = [];
  for (const m of texto.matchAll(/(?:^|\s)(?:-b|--cookie)(?:[ \t]+|=)/g)) {
    const desde = (m.index ?? 0) + m[0].length;
    const { comilla, largo } = comillaEn(texto, desde);
    const inicio = desde + largo;
    const valor = texto.slice(inicio, finDeArgumento(texto, inicio, comilla));
    if (valor.includes('=')) tramos.push(...valoresDeCookies(valor, inicio));
  }
  return tramos;
}

/**
 * Dónde acaba la orden `curl` que empieza en `i`: un salto de línea sin continuar (`\`, `^` o `` ` `` al final), o
 * una tubería o un encadenado fuera de comillas. Así `curl … | sh && docker run -u 1000:1000` no mira al `docker`.
 */
function finDeOrden(texto: string, i: number): number {
  let comilla: string | null = null;
  for (let j = i; j < texto.length; j++) {
    const c = texto[j];
    if (comilla) {
      if (c === '\\' && comilla === '"') j++;
      else if (c === comilla) comilla = null;
      continue;
    }
    if (c === "'" || c === '"') comilla = c;
    else if ((c === '\\' || c === '^' || c === '`') && (texto[j + 1] === '\n' || texto[j + 1] === '\r')) j++;
    else if (c === '\n' || c === '|' || c === ';' || (c === '&' && texto[j + 1] === '&')) return j;
  }
  return texto.length;
}

/**
 * La contraseña de `curl -u usuario:contraseña` (también `-uusuario:…`, `-su …`, `--user=…`, `-U` y `--proxy-user`):
 * solo dentro de una orden curl; el usuario se queda. Un recorrido por cada `curl`, sin volver atrás.
 */
export function contrasenasDeCurl(texto: string): [number, number][] {
  const tramos: [number, number][] = [];
  const curl = /\bcurl(?:\.exe)?\b/gi;
  for (let m = curl.exec(texto); m; m = curl.exec(texto)) {
    const fin = finDeOrden(texto, m.index + m[0].length);
    const orden = texto.slice(m.index, fin);
    for (const o of orden.matchAll(
      /(?:^|\s)(?:--user|--proxy-user|-[A-Za-z]*[uU])(?:=|[ \t]+(?:[\\^`]\r?\n[ \t]*)?|(?=[^\s=-]))/g,
    )) {
      const desde = m.index + (o.index ?? 0) + o[0].length;
      const { comilla, largo } = comillaEn(texto, desde);
      const inicio = desde + largo;
      const final = Math.min(finDeArgumento(texto, inicio, comilla), fin);
      const valor = texto.slice(inicio, final);
      const dos = valor.indexOf(':');
      const clave = dos < 0 ? '' : valor.slice(dos + 1);
      if (clave && !clave.startsWith(PREFIJO_MARCA) && !esVariable(clave)) tramos.push([inicio + dos + 1, final]);
    }
    curl.lastIndex = Math.max(fin, curl.lastIndex);
  }
  return tramos;
}
