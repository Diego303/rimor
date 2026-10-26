/**
 * Reglas de detección de secretos (CAP-05), adaptadas de gitleaks. Cada regla busca el secreto y, si lleva
 * contexto (una cabecera, un usuario en una URL), oculta solo la parte secreta: el grupo `secreto` de su
 * expresión o el tramo que devuelve su función. Ninguna casa con un texto que ya empieza por «‹oculto:», así
 * que ocultar dos veces da lo mismo. Las expresiones evitan el retroceso costoso: cada una empieza por un
 * literal reconocible o un límite claro.
 */

export interface ReglaSecreto {
  id: string;
  /** Tipo que se escribe en la marca: `‹oculto:tipo›`. */
  tipo: string;
  /** Expresión global. Si tiene el grupo con nombre `secreto`, solo se oculta ese grupo. */
  patron?: RegExp;
  /** Alternativa a `patron` cuando una expresión no basta: tramos [inicio, fin) a ocultar. */
  buscar?: (texto: string) => [number, number][];
}

export const PREFIJO_MARCA = '‹oculto:';
const NO_OCULTO = '(?!‹oculto:)';

// «d» da la posición exacta del grupo `secreto`.
const r = (id: string, tipo: string, fuente: string, banderas = 'g'): ReglaSecreto => ({
  id,
  tipo,
  patron: new RegExp(fuente, `${banderas}d`),
});

/** Tramo de URL hasta un espacio, comilla doble o `<>`` (las comillas simples no: hay contraseñas que las llevan). */
const TRAMO_URL = /[^\s"<>`]{0,2048}/y;
const ESQUEMA = /[A-Za-z0-9+.-]/;

/**
 * Contraseñas en URL y cadenas de conexión: `esquema://usuario:CONTRASEÑA@host`. Analizador lineal: parte de
 * cada «://», toma la URL hasta un espacio o comilla doble y, si hay «@», el tramo de usuario es lo anterior al
 * último «@» (así una contraseña con «@», «/» o «+» sin codificar se oculta entera). Si ese tramo contiene «?» o
 * «#», el «@» es de la consulta y no hay contraseña. Los dos puntos de una marca ya puesta no cuentan.
 */
function contrasenasEnUrl(texto: string): [number, number][] {
  const tramos: [number, number][] = [];
  for (let i = texto.indexOf('://'); i >= 0; i = texto.indexOf('://', i + 3)) {
    let e = i;
    while (e > 0 && i - e < 32 && ESQUEMA.test(texto[e - 1] as string)) e--;
    if (e === i || !/[A-Za-z]/.test(texto[e] as string)) continue;
    const desde = i + 3;
    // Una URL de más de 2048 caracteres no es una URL: el corte mantiene el análisis lineal.
    TRAMO_URL.lastIndex = desde;
    const url = TRAMO_URL.exec(texto)?.[0] ?? '';
    const arroba = url.lastIndexOf('@');
    if (arroba < 0) {
      // Sin «@» en este tramo, ningún «://» de dentro tiene contraseña: se salta el tramo entero.
      i = desde + url.length - 3;
      continue;
    }
    if (arroba === 0 || !/[A-Za-z0-9[]/.test(url[arroba + 1] ?? '')) continue;
    const usuario = url.slice(0, arroba);
    if (/[?#]/.test(usuario)) continue;
    // Las marcas ya puestas («‹oculto:github›») se tratan como opacas al buscar los dos puntos.
    const opaco = usuario.replace(/‹oculto:[^›]*›/g, (m) => 'x'.repeat(m.length));
    const dosPuntos = opaco.indexOf(':');
    if (dosPuntos < 0) continue;
    const clave = usuario.slice(dosPuntos + 1);
    if (!clave || clave.startsWith(PREFIJO_MARCA)) continue;
    tramos.push([desde + dosPuntos + 1, desde + arroba]);
  }
  return tramos;
}

/** La cabecera Cookie (no Set-Cookie) hasta el final de la línea o una comilla. */
const COOKIE_CABECERA = /(?<![\w-])Cookie:[ \t]*([^\r\n'"]*)/gi;
/** `curl -b` o `--cookie` con su valor (con `=`: `-b cookies.txt` es un archivo). */
const COOKIE_CURL = /(?:^|\s)(?:-b|--cookie)(?:[ \t]+|=)['"]?([^\s'"]*=[^'"\r\n]*)/g;

/**
 * El valor de cada cookie (`sesion=VALOR; tema=VALOR`): los nombres se quedan. Así, si el valor es un JWT, se queda
 * esa regla (empiezan a la vez y va antes en la lista). Un valor que es una variable (`$SESION`) no se oculta.
 */
function valoresDeCookies(texto: string, patron: RegExp): [number, number][] {
  const tramos: [number, number][] = [];
  for (const m of texto.matchAll(patron)) {
    const valor = m[1] ?? '';
    let inicio = (m.index ?? 0) + m[0].length - valor.length;
    for (const par of valor.split(';')) {
      const igual = par.indexOf('=');
      const crudo = igual < 0 ? '' : par.slice(igual + 1);
      const desde = inicio + igual + 1 + (crudo.length - crudo.trimStart().length);
      const limpio = crudo.trim();
      if (limpio && !limpio.startsWith(PREFIJO_MARCA) && !/^(?:\$|\{\{)/.test(limpio))
        tramos.push([desde, desde + limpio.length]);
      inicio += par.length + 1;
    }
  }
  return tramos;
}

export const REGLAS_SECRETOS: readonly ReglaSecreto[] = [
  // Claves privadas: el bloque entero (PEM, PGP; también la de una cuenta de servicio de GCP dentro de su JSON)
  // y, si se pegó a medias sin la línea END, desde BEGIN hasta donde siguen las líneas en base64.
  r(
    'clave-privada',
    'clave-privada',
    String.raw`-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----`,
  ),
  r(
    'clave-privada-incompleta',
    'clave-privada',
    // Solo líneas en base64 de 16 caracteres o más, o cabeceras «Nombre: valor»; para antes de una línea END.
    String.raw`-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----(?:(?:\r?\n|\\n)(?:[A-Za-z0-9+/=]{16,}|[A-Za-z-]+: [^\r\n\\]*))+`,
  ),
  // Proveedores de IA (Anthropic y OpenRouter antes que OpenAI, que comparten «sk-»).
  r('anthropic', 'anthropic', String.raw`\bsk-ant-(?:api|admin|oat)\d{2}-[A-Za-z0-9_-]{20,}`),
  r('openrouter', 'openrouter', String.raw`\bsk-or-v1-[a-f0-9]{64}\b`),
  // OpenAI: la clave antigua son 48 alfanuméricos; las nuevas llevan su tipo (proj, svcacct, admin).
  r(
    'openai',
    'openai',
    String.raw`\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|[A-Za-z0-9]{48}(?![A-Za-z0-9_-]))`,
  ),
  // Nube.
  r('aws-id', 'aws', String.raw`\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b`),
  r(
    'aws-secreto',
    'aws',
    String.raw`(?:aws_?secret_?access_?key|aws_?secret_?key|secret_?access_?key)\\?["']?\s*[:=]\s*\\?["']?(?<secreto>${NO_OCULTO}[A-Za-z0-9/+]{40})(?![A-Za-z0-9/+])`,
    'gi',
  ),
  r('gcp-api', 'gcp', String.raw`\bAIza[0-9A-Za-z_-]{35}(?![0-9A-Za-z_-])`),
  r('azure-almacen', 'azure', `AccountKey=(?<secreto>${NO_OCULTO}[A-Za-z0-9+/]{86}==)`),
  r(
    'azure-cliente',
    'azure',
    String.raw`(?<![A-Za-z0-9_~.-])[A-Za-z0-9_~.]{3}\dQ~[A-Za-z0-9_~.-]{31,34}(?![A-Za-z0-9_~.-])`,
  ),
  // Forjas y mensajería.
  r('github', 'github', String.raw`\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{60,255})\b`),
  r('gitlab', 'gitlab', String.raw`\bglpat-[A-Za-z0-9_-]{20,}`),
  r('slack', 'slack', String.raw`\b(?:xox[abposre]|xapp)-[A-Za-z0-9-]{10,}`),
  r(
    'slack-webhook',
    'slack',
    String.raw`https://hooks\.slack\.com/services/(?<secreto>${NO_OCULTO}T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+)`,
  ),
  // JWT: cabecera y carga en base64url; la firma, también con el alfabeto estándar.
  r('jwt', 'jwt', String.raw`\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_+/-]{8,}=*`),
  // Cabeceras Authorization (Bearer, Basic, Token, Bot), también en JSON escapado: se oculta el valor (no una
  // variable, `$TOKEN` o `{{token}}`, que no es un secreto).
  r(
    'authorization',
    'authorization',
    String.raw`\bAuthorization\\?["']?\s*[:=]\s*\\?["']?(?:Bearer|Basic|Token|Bot)\s+(?<secreto>${NO_OCULTO}(?![$]|\{\{)[^\s"',;\\]+)`,
    'gi',
  ),
  { id: 'contrasena-url', tipo: 'contrasena', buscar: contrasenasEnUrl },
  // Lo que lleva una petición (IN-046). Un valor que es una variable (`$TOKEN`, `{{token}}`) no es un secreto.
  // La cabecera Cookie de una petición (la Set-Cookie de una respuesta no: suele ser un ajuste) y `curl -b 'a=b'`.
  { id: 'cookie', tipo: 'cookie', buscar: (texto) => valoresDeCookies(texto, COOKIE_CABECERA) },
  { id: 'cookie-curl', tipo: 'cookie', buscar: (texto) => valoresDeCookies(texto, COOKIE_CURL) },
  // Cabeceras de clave de API.
  r(
    'cabecera-clave',
    'clave-api',
    String.raw`\b(?:X-Api-Key|Api-Key|X-Api-Token|X-Auth-Token|X-Access-Token|Private-Token|X-Goog-Api-Key|Ocp-Apim-Subscription-Key)\\?["']?\s*:\s*\\?["']?(?<secreto>${NO_OCULTO}(?![$]|\{\{)[^\s'",;\\]+)`,
    'gi',
  ),
  // Claves en la consulta de una URL (`?api_key=…`, la firma de una URL prefirmada de S3).
  r(
    'clave-url',
    'clave-api',
    String.raw`[?&](?:api[_-]?key|access[_-]?token|token|client[_-]?secret|secret|password|x-amz-signature|x-amz-security-token)=(?<secreto>${NO_OCULTO}(?![$]|\{\{)[^&\s'"#]+)`,
    'gi',
  ),
  // La contraseña de `curl … -u usuario:contraseña` (no el usuario; solo en un curl: `docker -u 1000:1000` no lo es).
  r(
    'usuario-curl',
    'contrasena',
    String.raw`\bcurl\b(?:[^\n\\]|\\.|\\\n)*?\s(?:-u|--user)(?:[ \t]+|=)['"]?[^\s:'"]+:(?<secreto>${NO_OCULTO}(?![$]|\{\{)[^\s'"]+)`,
    'g',
  ),
  // Contraseñas en cadenas clave=valor (ADO.NET, JDBC); no «PWD=» en mayúsculas, que es el directorio actual.
  r(
    'contrasena-cadena',
    'contrasena',
    String.raw`(?<=^|[;\s"'])(?:Password|password|Pwd|pwd)\s*=\s*(?<secreto>${NO_OCULTO}[^;'"\s]+)`,
    'gm',
  ),
];
