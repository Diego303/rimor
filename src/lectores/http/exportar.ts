/**
 * De una petición a texto (IN-046): el `curl` canónico y el `fetch` equivalente. Solo lo usa la vista (va en su trozo
 * diferido, no en la carga inicial con la detección). TS puro.
 */
import type { PeticionHttp } from './analisis';

/** Entre comillas simples para bash (`'` se escribe `'\''`). */
const comillas = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;

/** El `curl` canónico, en varias líneas, con lo oculto tal cual. */
export function aCurl(p: PeticionHttp): string {
  // HEAD es `-I` (con `-X HEAD`, curl espera un cuerpo que no llega); los implícitos no se escriben.
  const implicito = p.cuerpo ? 'POST' : 'GET';
  const metodo = p.metodo === 'HEAD' ? ' -I' : p.metodo !== implicito ? ` -X ${p.metodo}` : '';
  const lineas = [`curl${metodo} ${comillas(p.url)}`];
  for (const [n, v] of p.cabeceras) lineas.push(`-H ${comillas(`${n}: ${v}`)}`);
  if (p.usuario !== undefined) lineas.push(`-u ${comillas(p.usuario)}`);
  if (p.cuerpo?.tipo === 'multipart')
    for (const [n, v] of p.cuerpo.partes ?? []) lineas.push(`-F ${comillas(`${n}=${v}`)}`);
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
  cookie: string;
}

const PREFIJO_OCULTO = '‹oculto:';

/** Base64 de un texto en UTF-8 (`btoa` solo acepta Latin-1). */
const base64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

/** El `fetch` equivalente (JavaScript), con lo oculto tal cual y lo que no tiene equivalente en comentarios. */
export function aFetch(p: PeticionHttp, notas: NotasFetch): string {
  const url = /^[a-z][\w+.-]*:\/\//i.test(p.url) ? p.url : `http://${p.url}`;
  const cabeceras = [...p.cabeceras];
  const comentarios: string[] = [];
  if (p.usuario !== undefined) {
    const [usuario = ''] = p.usuario.split(':');
    if (p.usuario.includes(PREFIJO_OCULTO)) comentarios.push(notas.usuarioOculto(usuario));
    else cabeceras.push(['Authorization', `Basic ${base64(p.usuario)}`]);
  }
  const conCookie = cabeceras.some(([n]) => n.toLowerCase() === 'cookie');
  if (conCookie) comentarios.push(notas.cookie);
  if (p.opciones.length) comentarios.push(notas.opciones(p.opciones.join(' ')));
  if (p.tuberia) comentarios.push(notas.tuberia(p.tuberia));
  const lineas: string[] = [];
  const multipart = p.cuerpo?.tipo === 'multipart';
  if (multipart) {
    lineas.push('const form = new FormData();');
    for (const [n, v] of p.cuerpo?.partes ?? [])
      lineas.push(`form.append(${JSON.stringify(n)}, ${JSON.stringify(v)});`);
  }
  const opciones: string[] = [`  method: ${JSON.stringify(p.metodo)},`];
  if (cabeceras.length) {
    opciones.push('  headers: {');
    for (const [n, v] of cabeceras) opciones.push(`    ${JSON.stringify(n)}: ${JSON.stringify(v)},`);
    opciones.push('  },');
  }
  if (multipart) opciones.push('  body: form,');
  else if (p.cuerpo) opciones.push(`  body: ${JSON.stringify(p.cuerpo.texto)},`);
  if (conCookie) opciones.push("  credentials: 'include',");
  lineas.push(`const respuesta = await fetch(${JSON.stringify(url)}, {`, ...opciones, '});');
  return [...comentarios.map((c) => `// ${c}`), ...lineas].join('\n');
}
