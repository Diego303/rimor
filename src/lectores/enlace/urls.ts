/**
 * URL del lector Enlace (LEC-03): normalización (sin seguimiento, parámetros ordenados) y clasificación por
 * destino, sin red (D7). TS puro. Nada de aquí lanza: una URL rara se clasifica como «otro».
 */

export type ClaseEnlace =
  | 'repositorio'
  | 'issue'
  | 'pr'
  | 'paquete'
  | 'paper'
  | 'documentacion'
  | 'pregunta'
  | 'video'
  | 'otro';

export interface Destino {
  clase: ClaseEnlace;
  /** El sitio como se reconoce: «GitHub», «crates.io», «docs.rs»… o el dominio (legible, sin punycode). */
  sitio: string;
  /** Lo que nombra: `dueño/repo`, el paquete, el id del paper… */
  nombre?: string;
  /** Número de issue o PR. */
  numero?: number;
}

/** Parámetros de seguimiento: los de la ficha y los habituales de buscadores, redes y boletines. */
const SEGUIMIENTO =
  /^(?:utm_.+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|ref|ref_src|si|srsltid|share_id|_hsenc|_hsmi|mkt_tok|oly_enc_id|oly_anon_id|vero_id|wickedid)$/i;
const DOI = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i;

/** `decodeURIComponent` que no lanza: un `%` suelto o en Latin-1 se deja tal cual. */
export function decodificar(parte: string): string {
  try {
    return decodeURIComponent(parte);
  } catch {
    return parte;
  }
}

/** La URL normalizada del texto (o `null` si no es una URL ni un DOI). */
export function normalizar(texto: string): string | null {
  const t = texto.trim();
  // Un DOI en cualquiera de sus formas pasa a `https://doi.org/…` y se limpia como cualquier URL.
  const doi = DOI.exec(t);
  const enBruto = doi?.[1] ? `https://doi.org/${doi[1]}` : t;
  let u: URL;
  try {
    u = new URL(enBruto);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.username = '';
  u.password = '';
  if (u.hostname === 'dx.doi.org') u.hostname = 'doi.org';
  // La consulta se rehace a mano para no alterarla: `?flag` sigue siendo `?flag` (no `?flag=`).
  const pares = u.search
    .slice(1)
    .split('&')
    .filter(Boolean)
    .filter((p) => !SEGUIMIENTO.test(decodificar(p.split('=')[0] ?? '')));
  pares.sort((a, b) => {
    const [ka = '', kb = ''] = [a.split('=')[0], b.split('=')[0]];
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  u.search = pares.length ? `?${pares.join('&')}` : '';
  // Fragmentos que no señalan nada del contenido: vacíos o el resaltado de texto (`:~:text=`).
  const hash = u.hash.replace(/:~:.*$/, '');
  u.hash = hash === '#' ? '' : hash;
  // Sin barras al final (salvo en la raíz): `…/a//` y `…/a/` son `…/a`, y una segunda pasada no cambia nada.
  if (u.pathname !== '/') u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  // Un `#` sin nada detrás no lo quita `URL` (su `hash` ya es vacío): se quita aquí.
  return u.toString().replace(/#$/, '');
}

/** Punycode a Unicode (RFC 3492), para enseñar `münchen.de` y no `xn--mnchen-3ya.de`. */
function desdePunycode(etiqueta: string): string {
  const BASE = 36;
  const salida: number[] = [];
  const ultimo = etiqueta.lastIndexOf('-');
  for (let i = 0; i < Math.max(0, ultimo); i++) salida.push(etiqueta.charCodeAt(i));
  let n = 128;
  let i = 0;
  let sesgo = 72;
  const digito = (c: number) => (c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : BASE);
  for (let p = ultimo > 0 ? ultimo + 1 : 0; p < etiqueta.length; ) {
    const viejo = i;
    for (let w = 1, k = BASE; ; k += BASE) {
      if (p >= etiqueta.length) return etiqueta;
      const d = digito(etiqueta.charCodeAt(p++));
      if (d >= BASE) return etiqueta;
      i += d * w;
      const t = k <= sesgo ? 1 : k >= sesgo + 26 ? 26 : k - sesgo;
      if (d < t) break;
      w *= BASE - t;
    }
    const total = salida.length + 1;
    let delta = viejo === 0 ? Math.floor((i - viejo) / 700) : Math.floor((i - viejo) / 2);
    delta += Math.floor(delta / total);
    let k = 0;
    while (delta > ((BASE - 1) * 26) >> 1) {
      delta = Math.floor(delta / (BASE - 1));
      k += BASE;
    }
    sesgo = Math.floor(k + (BASE * delta) / (delta + 38));
    n += Math.floor(i / total);
    i %= total;
    salida.splice(i++, 0, n);
  }
  return String.fromCodePoint(...salida);
}

/** El dominio legible (cada etiqueta `xn--` en Unicode). */
export function hostLegible(host: string): string {
  return host
    .split('.')
    .map((e) => (e.startsWith('xn--') ? desdePunycode(e.slice(4)) : e))
    .join('.');
}

const FORJAS: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'codeberg.org': 'Codeberg',
  'bitbucket.org': 'Bitbucket',
};

/** Primeras partes de GitHub que no son un dueño (páginas propias del sitio). */
const RUTAS_DE_GITHUB = new Set([
  'about',
  'apps',
  'collections',
  'customer-stories',
  'enterprise',
  'explore',
  'features',
  'login',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'issues',
  'search',
  'security',
  'settings',
  'site',
  'sponsors',
  'topics',
  'trending',
]);

/** Partes de la ruta de un repositorio de GitLab que ya no son su nombre (sin el `/-/` moderno). */
const RUTAS_DE_REPO = new Set(['tree', 'blob', 'commits', 'commit', 'issues', 'merge_requests', 'wikis', 'raw']);

const PAQUETES: [RegExp, string][] = [
  [/^npmjs\.com$/, 'npm'],
  [/^crates\.io$/, 'crates.io'],
  [/^pypi\.org$/, 'PyPI'],
  [/^pkg\.go\.dev$/, 'pkg.go.dev'],
  [/^central\.sonatype\.com$|^search\.maven\.org$|^mvnrepository\.com$/, 'Maven Central'],
  [/^rubygems\.org$/, 'RubyGems'],
  [/^packagist\.org$/, 'Packagist'],
  [/^nuget\.org$/, 'NuGet'],
  [/^hex\.pm$/, 'Hex'],
];

/** Nombre del paquete según la ruta de cada registro. */
function nombrePaquete(sitio: string, partes: string[]): string | undefined {
  switch (sitio) {
    case 'npm':
      return partes[0] === 'package'
        ? partes[1]?.startsWith('@')
          ? `${partes[1]}/${partes[2] ?? ''}`
          : partes[1]
        : undefined;
    case 'crates.io':
      return partes[0] === 'crates' ? partes[1] : undefined;
    case 'PyPI':
      return partes[0] === 'project' ? partes[1] : undefined;
    case 'pkg.go.dev':
      // `search`, `about`… son páginas del sitio; un módulo tiene un punto en su primera parte (`github.com/…`).
      return partes[0]?.includes('.') || partes[0] === 'std' ? partes.join('/') : undefined;
    case 'Maven Central':
      return partes[0] === 'artifact' && partes[1] && partes[2] ? `${partes[1]}:${partes[2]}` : undefined;
    case 'RubyGems':
      return partes[0] === 'gems' ? partes[1] : undefined;
    case 'Packagist':
      return partes[0] === 'packages' && partes[1] ? `${partes[1]}/${partes[2] ?? ''}` : undefined;
    case 'NuGet':
    case 'Hex':
      return partes[0] === 'packages' ? partes[1] : undefined;
    default:
      return undefined;
  }
}

/** Una forja: repositorio, issue o PR (GitLab con subgrupos y `/-/`). */
function deForja(sitio: string, host: string, partes: string[]): Destino | null {
  if (host === 'github.com' && RUTAS_DE_GITHUB.has(partes[0] ?? '')) return null;
  let repo: string[];
  let resto: string[];
  const guion = partes.indexOf('-');
  if (host === 'gitlab.com') {
    const corte = guion >= 0 ? guion : partes.findIndex((p, i) => i >= 2 && RUTAS_DE_REPO.has(p));
    repo = corte >= 0 ? partes.slice(0, corte) : partes;
    resto = corte >= 0 ? partes.slice(guion >= 0 ? corte + 1 : corte) : [];
  } else {
    repo = partes.slice(0, 2);
    resto = partes.slice(2);
  }
  if (repo.length < 2) return null;
  const nombre = repo.join('/');
  const [tipo, num] = [resto[0], Number(resto[1])];
  if (tipo === 'issues' && Number.isInteger(num)) return { clase: 'issue', sitio, nombre, numero: num };
  if (['pull', 'pulls', 'merge_requests', 'pull-requests'].includes(tipo ?? '') && Number.isInteger(num))
    return { clase: 'pr', sitio, nombre, numero: num };
  return { clase: 'repositorio', sitio, nombre };
}

const STACK =
  /^(?:(?:[a-z]{2}\.)?stackoverflow\.com|superuser\.com|serverfault\.com|askubuntu\.com|mathoverflow\.net|[a-z0-9-]+\.stackexchange\.com)$/;

function deStack(host: string, partes: string[]): Destino | null {
  if (!STACK.test(host)) return null;
  const sitio = host === 'stackoverflow.com' ? 'Stack Overflow' : host;
  // `/questions/ID/titulo`, y los enlaces de «Compartir»: `/q/ID` y `/a/ID/usuario`.
  if (partes[0] === 'questions' && /^\d+$/.test(partes[1] ?? ''))
    return { clase: 'pregunta', sitio, ...(partes[2] ? { nombre: partes[2].replace(/-/g, ' ') } : {}) };
  if ((partes[0] === 'q' || partes[0] === 'a') && /^\d+$/.test(partes[1] ?? '')) return { clase: 'pregunta', sitio };
  return null;
}

function deVideo(host: string, partes: string[]): Destino | null {
  if (
    /^(?:youtube\.com|music\.youtube\.com)$/.test(host) &&
    ['watch', 'shorts', 'live', 'embed'].includes(partes[0] ?? '')
  )
    return { clase: 'video', sitio: 'YouTube' };
  if (host === 'youtu.be' && partes[0]) return { clase: 'video', sitio: 'YouTube' };
  if (host === 'vimeo.com' && /^\d+$/.test(partes[0] ?? '')) return { clase: 'video', sitio: 'Vimeo' };
  // En Twitch, un vídeo (`/videos/ID`) o el canal de alguien (su emisión).
  if (
    host === 'twitch.tv' &&
    (partes[0] === 'videos' || (partes.length === 1 && !['directory', 'settings', 'search'].includes(partes[0] ?? '')))
  )
    return { clase: 'video', sitio: 'Twitch' };
  return null;
}

function dePaper(host: string, partes: string[]): Destino | null {
  if (host === 'arxiv.org' && ['abs', 'pdf', 'html'].includes(partes[0] ?? '') && partes[1])
    // También los identificadores antiguos con categoría: `math/0211159`, `hep-th/9901001v2`.
    return {
      clase: 'paper',
      sitio: 'arXiv',
      nombre: partes
        .slice(1)
        .join('/')
        .replace(/\.pdf$/, ''),
    };
  if (host === 'doi.org' && partes.length) return { clase: 'paper', sitio: 'DOI', nombre: partes.join('/') };
  if (host === 'dl.acm.org' && partes[0] === 'doi') {
    // `/doi/10.1145/…` y también `/doi/abs/…`, `/doi/pdf/…`, `/doi/full/…`.
    const id = partes.slice(1).filter((p, i) => !(i === 0 && ['abs', 'pdf', 'full', 'epdf', 'fullHtml'].includes(p)));
    return { clase: 'paper', sitio: 'ACM DL', nombre: id.join('/') };
  }
  if (/^(?:aclanthology\.org|openreview\.net|semanticscholar\.org|biorxiv\.org|medrxiv\.org)$/.test(host))
    return { clase: 'paper', sitio: host };
  return null;
}

function deDocumentacion(host: string, partes: string[]): Destino | null {
  if (host === 'docs.rs') {
    // `/ureq/…` o `/crate/ureq/…`; la raíz es solo el sitio.
    const nombre = partes[0] === 'crate' ? partes[1] : partes[0];
    return { clase: 'documentacion', sitio: 'docs.rs', ...(nombre ? { nombre } : {}) };
  }
  // Google Docs no es documentación técnica: un documento compartido.
  if (host === 'docs.google.com') return { clase: 'otro', sitio: 'Google Docs' };
  if (/^docs\./.test(host) || /\.readthedocs\.(?:io|org)$/.test(host)) {
    const nombre = host.replace(/^docs\.|\.readthedocs\.(?:io|org)$/g, '').split('.')[0];
    return { clase: 'documentacion', sitio: host, ...(nombre ? { nombre } : {}) };
  }
  if (
    /^(?:developer\.mozilla\.org|learn\.microsoft\.com|devdocs\.io|readthedocs\.org)$/.test(host) ||
    partes.includes('docs')
  )
    return { clase: 'documentacion', sitio: host };
  return null;
}

export function clasificar(url: string): Destino {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return { clase: 'otro', sitio: '' };
  }
  const host = hostLegible(u.hostname.replace(/^(?:www|m)\./, ''));
  const partes = u.pathname.split('/').filter(Boolean).map(decodificar);

  const forja = FORJAS[host];
  if (forja) {
    const d = deForja(forja, host, partes);
    if (d) return d;
  }
  for (const [patron, sitio] of PAQUETES) {
    if (!patron.test(host)) continue;
    const nombre = nombrePaquete(sitio, partes);
    if (nombre) return { clase: 'paquete', sitio, nombre };
  }
  return (
    dePaper(host, partes) ??
    deStack(host, partes) ??
    deVideo(host, partes) ??
    deDocumentacion(host, partes) ?? { clase: 'otro', sitio: host }
  );
}

/** Palabras legibles de una ruta: sin guiones, barras ni extensiones. */
export function rutaLegible(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return '';
  }
  return u.pathname
    .split('/')
    .filter(Boolean)
    .map((p) =>
      decodificar(p)
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/[-_+]+/g, ' '),
    )
    .join(' · ');
}

/** Título provisional desde la URL. */
export function tituloDe(url: string, d: Destino): string {
  switch (d.clase) {
    case 'repositorio':
      return d.nombre ?? d.sitio;
    case 'issue':
    case 'pr':
      return `${d.nombre} #${d.numero}`;
    case 'paquete':
      return `${d.nombre} en ${d.sitio}`;
    case 'paper':
      return d.nombre ? `${d.sitio} ${d.nombre}` : `${d.sitio} · ${rutaLegible(url)}`;
    case 'documentacion':
      return d.nombre ? `${d.nombre} en ${d.sitio}` : `${d.sitio} · ${rutaLegible(url)}`;
    case 'pregunta':
      return d.nombre ?? `${d.sitio} · ${rutaLegible(url)}`;
    default: {
      const ruta = rutaLegible(url);
      return ruta ? `${d.sitio} · ${ruta}` : d.sitio;
    }
  }
}
