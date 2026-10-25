/**
 * Paquetes (IN-041): deps.dev como fuente principal (versión por defecto, su fecha, licencias y avisos) para npm,
 * PyPI, crates.io, Go y Maven; OSV para las vulnerabilidades de esa versión; y el registro (npm, crates.io o PyPI)
 * solo si deps.dev no trae la fecha. Maven y Go, solo por deps.dev (F0-7).
 */
import type { DatosEnlace } from '../lector';
import { type Consulta, campos, type Enriquecedor, FalloConsulta, fecha, objeto, pedirJson, texto } from './contrato';

const DEPS_DEV = 'api.deps.dev';
const OSV = 'api.osv.dev';

interface Sistema {
  /** En deps.dev. */
  depsDev: string;
  /** En OSV. */
  osv: string;
  /** El registro que sabe la fecha de una versión, si admite CORS. */
  registro?: { dominio: string; fecha: (nombre: string, version: string, c: Consulta) => Promise<string | undefined> };
}

const SISTEMAS: Record<string, Sistema> = {
  npm: {
    depsDev: 'npm',
    osv: 'npm',
    registro: {
      dominio: 'registry.npmjs.org',
      // El documento entero (con `time`): solo se pide si deps.dev no trae la fecha.
      fecha: async (n, v, c) =>
        fecha(objeto(objeto(await pedirJson(`https://registry.npmjs.org/${n.replace('/', '%2f')}`, c))?.time)?.[v]),
    },
  },
  'crates.io': {
    depsDev: 'cargo',
    osv: 'crates.io',
    registro: {
      dominio: 'crates.io',
      fecha: async (n, v, c) =>
        fecha(objeto(objeto(await pedirJson(`https://crates.io/api/v1/crates/${n}/${v}`, c))?.version)?.created_at),
    },
  },
  PyPI: {
    depsDev: 'pypi',
    osv: 'PyPI',
    registro: {
      dominio: 'pypi.org',
      fecha: async (n, v, c) => {
        const urls = objeto(await pedirJson(`https://pypi.org/pypi/${n}/${v}/json`, c))?.urls;
        return Array.isArray(urls) ? fecha(objeto(urls[0])?.upload_time_iso_8601) : undefined;
      },
    },
  },
  'pkg.go.dev': { depsDev: 'go', osv: 'Go' },
  'Maven Central': { depsDev: 'maven', osv: 'Maven' },
};

/** La biblioteca estándar de Go (`pkg.go.dev/std`) no está en deps.dev. */
const sistemaDe = (d: DatosEnlace) =>
  d.clase === 'paquete' && d.nombre && !(d.sitio === 'pkg.go.dev' && d.nombre === 'std')
    ? SISTEMAS[d.sitio]
    : undefined;

/**
 * Los nombres que se prueban en deps.dev: tal cual o, en Go, sin la versión (`…/gin@v1.9.1`) y, si es un paquete de
 * un módulo (`golang.org/x/net/http2`), recortando la ruta hasta el módulo (como mucho hasta `dominio/dueño/repo`).
 */
export function nombresParaDepsDev(sistema: string, nombre: string): string[] {
  if (sistema !== 'go') return [nombre];
  const partes = nombre
    .replace(/@[^/]*/g, '')
    .split('/')
    .filter(Boolean);
  const nombres: string[] = [];
  for (let n = partes.length; n >= Math.min(3, partes.length); n--) nombres.push(partes.slice(0, n).join('/'));
  return nombres;
}

export const paquete: Enriquecedor = {
  id: 'paquete',
  acepta: (d) => !!sistemaDe(d),
  dominios: (d) => {
    const s = sistemaDe(d);
    return s ? [DEPS_DEV, OSV, ...(s.registro ? [s.registro.dominio] : [])] : [];
  },
  async consultar(d, c) {
    const s = sistemaDe(d);
    if (!s) throw new FalloConsulta('fallo');
    const { nombre, base, versiones } = await paqueteEnDepsDev(s, d.nombre ?? '', c);
    const porDefecto = Array.isArray(versiones)
      ? (versiones.map(objeto).find((v) => v?.isDefault === true) ?? objeto(versiones.at(-1)))
      : undefined;
    const version = texto(objeto(porDefecto?.versionKey)?.version);
    if (!version) throw new FalloConsulta('fallo');
    const detalle = objeto(await pedirJson(`${base}/versions/${encodeURIComponent(version)}`, c)) ?? {};
    const licencias = Array.isArray(detalle.licenses) ? detalle.licenses.map(texto).filter(Boolean) : [];
    const avisos = Array.isArray(detalle.advisoryKeys) ? detalle.advisoryKeys.length : undefined;
    let publicada = fecha(detalle.publishedAt) ?? fecha(porDefecto?.publishedAt);
    if (!publicada && s.registro && c.activos.has(s.registro.dominio))
      publicada = await s.registro.fecha(nombre, version, c).catch(() => undefined);
    return campos({
      version,
      fechaVersion: publicada,
      licencia: licencias.length ? licencias.join(' · ') : undefined,
      vulnerabilidades: (await vulnerabilidades(s.osv, nombre, version, c)) ?? avisos,
    });
  },
};

/** El primero de sus nombres posibles que deps.dev conoce (o `no-encontrado`, si ninguno). */
async function paqueteEnDepsDev(s: Sistema, nombreEnlace: string, c: Consulta) {
  const nombres = nombresParaDepsDev(s.depsDev, nombreEnlace);
  for (const [i, nombre] of nombres.entries()) {
    const base = `https://${DEPS_DEV}/v3/systems/${s.depsDev}/packages/${encodeURIComponent(nombre)}`;
    try {
      return { nombre, base, versiones: objeto(await pedirJson(base, c))?.versions };
    } catch (e) {
      if (!(e instanceof FalloConsulta && e.codigo === 'no-encontrado') || i === nombres.length - 1) throw e;
    }
  }
  throw new FalloConsulta('no-encontrado');
}

/**
 * Las vulnerabilidades conocidas de esa versión según OSV; sin OSV activado, si falla, si responde algo que no se
 * entiende o si hay más páginas (el recuento no sería exacto), `undefined` (y cuentan los avisos de deps.dev).
 */
async function vulnerabilidades(ecosistema: string, nombre: string, version: string, c: Consulta) {
  if (!c.activos.has(OSV)) return undefined;
  try {
    const r = objeto(
      await pedirJson(`https://${OSV}/v1/query`, c, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, package: { name: nombre, ecosystem: ecosistema } }),
      }),
    );
    if (!r || r.next_page_token) return undefined;
    if (r.vulns === undefined) return 0;
    return Array.isArray(r.vulns) ? r.vulns.length : undefined;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    return undefined;
  }
}
