/**
 * Repositorios (IN-041): GitHub (repositorio, issue o PR; con token opcional para no chocar con el límite de 60
 * consultas por hora) y GitLab. CORS comprobado en F0-7.
 */
import type { DatosEnlace } from '../lector';
import {
  booleano,
  type Consulta,
  campos,
  type Enriquecedor,
  FalloConsulta,
  fecha,
  numero,
  objeto,
  pedirJson,
  texto,
} from './contrato';

const GITHUB = 'api.github.com';
const GITLAB = 'gitlab.com';

const deGithub = (d: DatosEnlace) =>
  d.sitio === 'GitHub' && (d.clase === 'repositorio' || d.clase === 'issue' || d.clase === 'pr') && !!d.nombre;

export const github: Enriquecedor = {
  id: 'github',
  acepta: deGithub,
  dominios: () => [GITHUB],
  async consultar(d, c) {
    const base = `https://${GITHUB}/repos/${d.nombre}`;
    const init: RequestInit = {
      headers: { Accept: 'application/vnd.github+json', ...(c.token ? { Authorization: `Bearer ${c.token}` } : {}) },
    };
    if ((d.clase === 'issue' || d.clase === 'pr') && d.numero !== undefined) {
      // Los PR también se leen como issues (título, estado, comentarios); `pull_request.merged_at` dice si se fusionó.
      const i = objeto(await pedirJson(`${base}/issues/${d.numero}`, c, init)) ?? {};
      const pr = objeto(i.pull_request);
      return campos({
        titulo: texto(i.title),
        estado: pr && fecha(pr.merged_at) ? 'fusionado' : texto(i.state),
        comentarios: numero(i.comments),
        actualizado: fecha(i.updated_at),
      });
    }
    const r = objeto(await pedirJson(base, c, init)) ?? {};
    const lanzamiento = await ultimoLanzamiento(base, c, init);
    const licencia = texto(objeto(r.license)?.spdx_id);
    return campos({
      descripcion: texto(r.description),
      estrellas: numero(r.stargazers_count),
      licencia: licencia && licencia !== 'NOASSERTION' ? licencia : undefined,
      issuesAbiertas: numero(r.open_issues_count),
      ultimoPush: fecha(r.pushed_at),
      archivado: booleano(r.archived),
      ultimoLanzamiento: lanzamiento?.version,
      fechaLanzamiento: lanzamiento?.fecha,
    });
  },
};

/** El último lanzamiento, o nada si no tiene (404): no es un fallo de la ficha. */
async function ultimoLanzamiento(base: string, c: Consulta, init: RequestInit) {
  try {
    const l = objeto(await pedirJson(`${base}/releases/latest`, c, init)) ?? {};
    const version = texto(l.tag_name);
    return version ? { version, fecha: fecha(l.published_at) } : undefined;
  } catch (e) {
    if (e instanceof FalloConsulta && e.codigo === 'no-encontrado') return undefined;
    throw e;
  }
}

/** GitLab da la clave de choosealicense.com (`mit`, `apache-2.0`): las habituales, con su nombre SPDX. */
const SPDX: Record<string, string> = {
  mit: 'MIT',
  'apache-2.0': 'Apache-2.0',
  'gpl-2.0': 'GPL-2.0',
  'gpl-3.0': 'GPL-3.0',
  'lgpl-2.1': 'LGPL-2.1',
  'lgpl-3.0': 'LGPL-3.0',
  'agpl-3.0': 'AGPL-3.0',
  'mpl-2.0': 'MPL-2.0',
  'bsd-2-clause': 'BSD-2-Clause',
  'bsd-3-clause': 'BSD-3-Clause',
  unlicense: 'Unlicense',
};
const spdxDeGitlab = (clave?: string) => (clave ? (SPDX[clave.toLowerCase()] ?? clave) : undefined);

export const gitlab: Enriquecedor = {
  id: 'gitlab',
  acepta: (d) => d.sitio === 'GitLab' && d.clase === 'repositorio' && !!d.nombre,
  dominios: () => [GITLAB],
  async consultar(d, c) {
    const r = objeto(
      await pedirJson(`https://${GITLAB}/api/v4/projects/${encodeURIComponent(d.nombre ?? '')}?license=true`, c),
    );
    if (!r) throw new FalloConsulta('fallo');
    return campos({
      descripcion: texto(r.description),
      estrellas: numero(r.star_count),
      licencia: spdxDeGitlab(texto(objeto(r.license)?.key)),
      ultimoPush: fecha(r.last_activity_at),
      archivado: booleano(r.archived),
    });
  },
};
