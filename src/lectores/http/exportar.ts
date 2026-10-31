/**
 * De una petición a texto (IN-046): el `curl` canónico y el `fetch` equivalente. Solo lo usa la vista (va en su trozo
 * diferido, no en la carga inicial con la detección). TS puro.
 */
import type { PeticionHttp } from './analisis';

/** Entre comillas simples para bash (`'` se escribe `'\''`). */
const comillas = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** Las opciones que hacen que curl se porte como `fetch` (o que solo cambian lo que enseña): no hace falta avisar. */
const COMO_FETCH = new Set([
  '-L',
  '--location',
  '--compressed',
  '-s',
  '--silent',
  '-S',
  '--show-error',
  '-v',
  '--verbose',
  '-i',
  '--include',
  '-#',
  '--progress-bar',
]);

/** ¿Sube un archivo (`-T`)? Entonces su método implícito es PUT. */
const sube = (p: PeticionHttp) => p.opciones.some((o) => o === '-T' || o === '--upload-file' || /^-T\S/.test(o));

/** El `curl` canónico, en varias líneas, con lo oculto tal cual. */
export function aCurl(p: PeticionHttp): string {
  // HEAD es `-I` (con `-X HEAD`, curl espera un cuerpo que no llega); los implícitos no se escriben.
  const implicito = p.cuerpo ? 'POST' : sube(p) ? 'PUT' : 'GET';
  const metodo = p.metodo === 'HEAD' ? ' -I' : p.metodo !== implicito ? ` -X ${p.metodo}` : '';
  const lineas = [`curl${metodo} ${comillas(p.url)}`];
  for (const [n, v] of p.cabeceras) lineas.push(`-H ${comillas(`${n}: ${v}`)}`);
  if (p.usuario !== undefined) lineas.push(`-u ${comillas(p.usuario)}`);
  if (p.cuerpo?.tipo === 'multipart')
    for (const [n, v] of p.cuerpo.partes ?? []) lineas.push(`-F ${comillas(`${n}=${v}`)}`);
  // De un archivo, que lo vuelva a leer (`--data-raw @x` mandaría el texto `@x`).
  else if (p.cuerpo?.archivo !== undefined) lineas.push(`--data-binary ${comillas(`@${p.cuerpo.archivo}`)}`);
  else if (p.cuerpo) lineas.push(`--data-raw ${comillas(p.cuerpo.texto)}`);
  if (p.opciones.length) lineas.push(p.opciones.map((o) => (/^[\w@%+=:,./-]+$/.test(o) ? o : comillas(o))).join(' '));
  const curl = lineas.join(' \\\n  ');
  return p.tuberia ? `${curl} ${p.tuberia}` : curl;
}

/** Lo que `fetch` no hace y se dice en un comentario (con los textos del idioma de quien copia). */
export interface NotasFetch {
  opciones: (lista: string) => string;
  tuberia: (resto: string) => string;
  usuarioOculto: (usuario: string) => string;
  usuarioSinClave: (usuario: string) => string;
  cookie: string;
  cuerpoConGet: (metodo: string) => string;
  archivo: (nombre: string) => string;
}

const PREFIJO_OCULTO = '‹oculto:';

/** Base64 de un texto en UTF-8 (`btoa` solo acepta Latin-1). */
const base64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

/**
 * El `fetch` equivalente (JavaScript válido), con lo oculto tal cual y, en comentarios, lo que no tiene equivalente:
 * las opciones de curl que fetch no tiene, la tubería, los archivos que curl leía, un cuerpo con GET (fetch no lo
 * admite) o la cabecera Cookie (el navegador no deja ponerla). Las cabeceras van como pares: se pueden repetir.
 */
export function aFetch(p: PeticionHttp, notas: NotasFetch): string {
  const url = /^[a-z][\w+.-]*:\/\//i.test(p.url) ? p.url : `http://${p.url}`;
  const cabeceras = [...p.cabeceras];
  const comentarios: string[] = [];
  if (p.usuario !== undefined) {
    const dos = p.usuario.indexOf(':');
    const usuario = dos < 0 ? p.usuario : p.usuario.slice(0, dos);
    if (p.usuario.includes(PREFIJO_OCULTO)) comentarios.push(notas.usuarioOculto(usuario));
    else if (dos < 0) comentarios.push(notas.usuarioSinClave(usuario));
    else cabeceras.push(['Authorization', `Basic ${base64(p.usuario)}`]);
  }
  const conCookie = cabeceras.some(([n]) => n.toLowerCase() === 'cookie');
  if (conCookie) comentarios.push(notas.cookie);
  const sinEquivalente = p.opciones.filter((o) => !COMO_FETCH.has(o));
  if (sinEquivalente.length) comentarios.push(notas.opciones(sinEquivalente.join(' ')));
  const sinCuerpo = p.metodo === 'GET' || p.metodo === 'HEAD';
  if (p.cuerpo && sinCuerpo) comentarios.push(notas.cuerpoConGet(p.metodo));
  if (p.cuerpo?.archivo !== undefined) comentarios.push(notas.archivo(p.cuerpo.archivo));
  const multipart = p.cuerpo?.tipo === 'multipart';
  for (const [, v] of multipart ? (p.cuerpo?.partes ?? []) : [])
    if (v.startsWith('@')) comentarios.push(notas.archivo(v.slice(1).split(';')[0] ?? ''));
  if (p.tuberia) comentarios.push(notas.tuberia(p.tuberia));
  const lineas: string[] = [];
  const conCuerpo = p.cuerpo && !sinCuerpo && p.cuerpo.archivo === undefined;
  if (multipart && conCuerpo) {
    lineas.push('const form = new FormData();');
    for (const [n, v] of p.cuerpo?.partes ?? [])
      lineas.push(`form.append(${JSON.stringify(n)}, ${JSON.stringify(v)});`);
  }
  const opciones: string[] = [`  method: ${JSON.stringify(p.metodo)},`];
  if (cabeceras.length) {
    opciones.push('  headers: [');
    for (const [n, v] of cabeceras) opciones.push(`    [${JSON.stringify(n)}, ${JSON.stringify(v)}],`);
    opciones.push('  ],');
  }
  if (conCuerpo) opciones.push(multipart ? '  body: form,' : `  body: ${JSON.stringify(p.cuerpo?.texto ?? '')},`);
  if (conCookie) opciones.push("  credentials: 'include',");
  lineas.push(`const respuesta = await fetch(${JSON.stringify(url)}, {`, ...opciones, '});');
  // Cada línea de cada nota, comentada (una tubería puede ocupar varias).
  const comentadas = comentarios.flatMap((c) => c.split(/\r?\n/).map((l) => `// ${l}`));
  return [...comentadas, ...lineas].join('\n');
}
