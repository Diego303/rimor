/**
 * URL del lector Enlace (LEC-03): normalización (sin seguimiento, parámetros ordenados) y clasificación por
 * destino, sin red (D7). TS puro.
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
  /** El sitio como se reconoce: «GitHub», «crates.io», «docs.rs»… o el dominio. */
  sitio: string;
  /** Lo que nombra: `dueño/repo`, el paquete, el id del paper… */
  nombre?: string;
  /** Número de issue o PR. */
  numero?: number;
}

const SEGUIMIENTO = /^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|yclid|ref|ref_src)$/i;
const DOI = /^(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)?(10\.\d{4,9}\/\S+)$/i;

/** La URL normalizada del texto (o `null` si no es una URL ni un DOI). */
export function normalizar(texto: string): string | null {
  const t = texto.trim();
  const doi = DOI.exec(t);
  if (doi?.[1]) return `https://doi.org/${doi[1]}`;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.username = '';
  u.password = '';
  u.hostname = u.hostname.toLowerCase();
  if (u.hostname === 'dx.doi.org') u.hostname = 'doi.org';
  const params = [...u.searchParams]
    .filter(([k]) => !SEGUIMIENTO.test(k))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  // Fragmentos que no señalan nada del contenido: vacíos o de texto resaltado.
  if (u.hash === '#' || u.hash.startsWith('#:~:')) u.hash = '';
  // Un `#` sin nada detrás no lo quita `URL` (su `hash` ya es vacío): se quita aquí.
  let s = u.toString().replace(/#$/, '');
  if (u.pathname !== '/' && u.pathname.endsWith('/')) s = s.replace(/\/(?=$|[?#])/, '');
  return s;
}

const FORJAS: Record<string, string> = {
  'github.com': 'GitHub',
  'gitlab.com': 'GitLab',
  'codeberg.org': 'Codeberg',
  'bitbucket.org': 'Bitbucket',
};

const PAQUETES: [RegExp, string, (m: RegExpExecArray) => string][] = [
  [/^(?:www\.)?npmjs\.com$/, 'npm', (m) => m[0]],
  [/^crates\.io$/, 'crates.io', (m) => m[0]],
  [/^pypi\.org$/, 'PyPI', (m) => m[0]],
  [/^pkg\.go\.dev$/, 'pkg.go.dev', (m) => m[0]],
  [/^central\.sonatype\.com$|^search\.maven\.org$|^mvnrepository\.com$/, 'Maven Central', (m) => m[0]],
  [/^rubygems\.org$/, 'RubyGems', (m) => m[0]],
  [/^packagist\.org$/, 'Packagist', (m) => m[0]],
  [/^(?:www\.)?nuget\.org$/, 'NuGet', (m) => m[0]],
  [/^hex\.pm$/, 'Hex', (m) => m[0]],
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
      return partes.length ? partes.join('/') : undefined;
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

const STACK =
  /^(?:stackoverflow\.com|superuser\.com|serverfault\.com|askubuntu\.com|[a-z0-9-]+\.stackexchange\.com|stackexchange\.com)$/;

export function clasificar(url: string): Destino {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, '');
  const partes = u.pathname
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));

  const forja = FORJAS[host];
  if (forja && partes.length >= 2) {
    const sinGuion = partes.filter((p) => p !== '-');
    const repo = `${sinGuion[0]}/${sinGuion[1]}`;
    const [tipo, num] = [sinGuion[2], Number(sinGuion[3])];
    if (tipo === 'issues' && Number.isInteger(num)) return { clase: 'issue', sitio: forja, nombre: repo, numero: num };
    if (
      (tipo === 'pull' || tipo === 'pulls' || tipo === 'merge_requests' || tipo === 'pull-requests') &&
      Number.isInteger(num)
    )
      return { clase: 'pr', sitio: forja, nombre: repo, numero: num };
    return { clase: 'repositorio', sitio: forja, nombre: repo };
  }

  for (const [patron, sitio] of PAQUETES) {
    if (!patron.test(u.hostname)) continue;
    const nombre = nombrePaquete(sitio, partes);
    if (nombre) return { clase: 'paquete', sitio, nombre };
  }

  if (host === 'arxiv.org' && (partes[0] === 'abs' || partes[0] === 'pdf') && partes[1])
    return { clase: 'paper', sitio: 'arXiv', nombre: partes[1].replace(/\.pdf$/, '') };
  if (host === 'doi.org' && partes.length) return { clase: 'paper', sitio: 'DOI', nombre: partes.join('/') };
  if (host === 'dl.acm.org' && partes[0] === 'doi')
    return { clase: 'paper', sitio: 'ACM DL', nombre: partes.slice(1).join('/') };
  if (/^(?:aclanthology\.org|openreview\.net|semanticscholar\.org|biorxiv\.org|medrxiv\.org)$/.test(host))
    return { clase: 'paper', sitio: host };

  if (STACK.test(host) && partes[0] === 'questions' && /^\d+$/.test(partes[1] ?? ''))
    return {
      clase: 'pregunta',
      sitio: host === 'stackoverflow.com' ? 'Stack Overflow' : host,
      ...(partes[2] ? { nombre: partes[2].replace(/-/g, ' ') } : {}),
    };

  if ((host === 'youtube.com' && (partes[0] === 'watch' || partes[0] === 'shorts')) || host === 'youtu.be')
    return { clase: 'video', sitio: 'YouTube' };
  if ((host === 'vimeo.com' && /^\d+$/.test(partes[0] ?? '')) || (host === 'twitch.tv' && partes[0] === 'videos'))
    return { clase: 'video', sitio: host === 'vimeo.com' ? 'Vimeo' : 'Twitch' };

  if (host === 'docs.rs' && partes[0]) return { clase: 'documentacion', sitio: 'docs.rs', nombre: partes[0] };
  if (/^docs\./.test(host) || /\.readthedocs\.(?:io|org)$/.test(host) || host === 'readthedocs.org')
    return {
      clase: 'documentacion',
      sitio: host,
      nombre: host.replace(/^docs\.|\.readthedocs\.(?:io|org)$/g, '').split('.')[0] ?? host,
    };
  if (/^(?:developer\.mozilla\.org|learn\.microsoft\.com|devdocs\.io)$/.test(host) || partes.includes('docs'))
    return { clase: 'documentacion', sitio: host };

  return { clase: 'otro', sitio: host };
}

/** Palabras legibles de una ruta: sin guiones, barras ni extensiones. */
export function rutaLegible(url: string): string {
  const u = new URL(url);
  return u.pathname
    .split('/')
    .filter(Boolean)
    .map((p) =>
      decodeURIComponent(p)
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
      return d.nombre ?? d.sitio;
    default: {
      const ruta = rutaLegible(url);
      return ruta ? `${d.sitio} · ${ruta}` : d.sitio;
    }
  }
}
