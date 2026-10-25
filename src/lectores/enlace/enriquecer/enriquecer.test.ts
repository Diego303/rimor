import { describe, expect, it } from 'vitest';
import { DOMINIOS_ENRIQUECIMIENTO } from '../../../../scripts/csp.mjs';
import { comprobarEstilo } from '../../../respuestas/reglas';
import { analizar, type DatosEnlace } from '../lector';
import { type Consulta, FalloConsulta } from './contrato';
import { DOMINIOS, guardarTokenGithub, tokenValido } from './dominios';
import { cambiosDeFicha, consultarFicha, dominiosDe, ENRIQUECEDORES, sePuedeConsultar } from './enriquecer';
import { fraseDeFicha } from './frase';
import { nombresParaDepsDev } from './paquetes';

type Respuesta = { status?: number; json?: unknown; headers?: Record<string, string> } | 'sin-red';

/** Un `fetch` falso: responde por URL (sin la consulta) y apunta cada petición. */
function pedirFalso(rutas: Record<string, Respuesta>) {
  const pedidas: { url: string; init?: RequestInit }[] = [];
  const pedir = async (url: string, init?: RequestInit) => {
    pedidas.push({ url, ...(init ? { init } : {}) });
    const r = rutas[url.split('?')[0] ?? url];
    if (r === 'sin-red') throw new TypeError('Failed to fetch');
    if (!r) return new Response('no', { status: 404 });
    return new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200, headers: r.headers ?? {} });
  };
  return { pedir, pedidas };
}

const todos = new Set(DOMINIOS);
const consulta = (pedir: Consulta['pedir'], activos: ReadonlySet<string> = todos, token?: string): Consulta => ({
  pedir,
  activos,
  ...(token ? { token } : {}),
});
const enlace = (url: string) => analizar(url) as DatosEnlace;
const AHORA = () => '2026-10-25T10:00:00+02:00';

const REPO = {
  description: 'Cliente HTTP para Rust',
  stargazers_count: 1290,
  license: { spdx_id: 'MIT' },
  open_issues_count: 41,
  pushed_at: '2026-10-20T08:00:00Z',
  archived: false,
};

describe('dominios', () => {
  it('todos los que se pueden activar están en la CSP (connect-src)', () => {
    for (const d of DOMINIOS) expect(DOMINIOS_ENRIQUECIMIENTO).toContain(`https://${d}`);
  });

  it('cada enlace, su proveedor y sus dominios (el primero, el imprescindible)', () => {
    expect(dominiosDe(enlace('https://github.com/algesten/ureq'))).toEqual(['api.github.com']);
    expect(dominiosDe(enlace('https://gitlab.com/grupo/sub/proyecto'))).toEqual(['gitlab.com']);
    expect(dominiosDe(enlace('https://crates.io/crates/serde'))).toEqual(['api.deps.dev', 'api.osv.dev', 'crates.io']);
    expect(dominiosDe(enlace('https://pkg.go.dev/github.com/spf13/cobra'))).toEqual(['api.deps.dev', 'api.osv.dev']);
    expect(dominiosDe(enlace('https://doi.org/10.1038/nature14539'))).toEqual(['api.crossref.org', 'api.datacite.org']);
    // Un DOI de arXiv va por DataCite, como su enlace.
    expect(dominiosDe(enlace('https://doi.org/10.48550/arXiv.2301.00001'))).toEqual(['api.datacite.org']);
    // La biblioteca estándar de Go no está en deps.dev.
    expect(dominiosDe(enlace('https://pkg.go.dev/std'))).toEqual([]);
    expect(dominiosDe(enlace('https://arxiv.org/abs/1706.03762v5'))).toEqual(['api.datacite.org']);
    // Sin proveedor: ni Stack Overflow ni una web cualquiera.
    expect(dominiosDe(enlace('https://stackoverflow.com/questions/1/x'))).toEqual([]);
    expect(dominiosDe(enlace('https://example.com/a'))).toEqual([]);
    expect(ENRIQUECEDORES.map((e) => e.id)).toEqual(['github', 'gitlab', 'paquete', 'crossref', 'arxiv']);
  });

  it('solo se consulta con el dominio imprescindible activado', async () => {
    const d = enlace('https://github.com/algesten/ureq');
    expect(sePuedeConsultar(d, new Set())).toBe(false);
    const { pedir, pedidas } = pedirFalso({});
    expect(await consultarFicha(d, consulta(pedir, new Set(['crates.io'])), AHORA)).toBeNull();
    expect(pedidas).toEqual([]);
  });
});

describe('GitHub', () => {
  it('repositorio: campos, último lanzamiento y el token en la cabecera', async () => {
    const { pedir, pedidas } = pedirFalso({
      'https://api.github.com/repos/algesten/ureq': { json: REPO },
      'https://api.github.com/repos/algesten/ureq/releases/latest': {
        json: { tag_name: '2.10.1', published_at: '2026-10-13T12:00:00Z' },
      },
    });
    const ficha = await consultarFicha(
      enlace('https://github.com/algesten/ureq'),
      consulta(pedir, todos, 'ghp_x'),
      AHORA,
    );
    expect(ficha).toEqual({
      fuente: 'github',
      consultada: AHORA(),
      campos: {
        descripcion: 'Cliente HTTP para Rust',
        estrellas: 1290,
        licencia: 'MIT',
        issuesAbiertas: 41,
        ultimoPush: '2026-10-20T08:00:00Z',
        archivado: false,
        ultimoLanzamiento: '2.10.1',
        fechaLanzamiento: '2026-10-13T12:00:00Z',
      },
    });
    expect(new Headers(pedidas[0]?.init?.headers).get('Authorization')).toBe('Bearer ghp_x');
  });

  it('sin lanzamientos (404) y sin licencia: la ficha va sin ellos; una respuesta rara no rompe', async () => {
    const { pedir } = pedirFalso({
      'https://api.github.com/repos/a/b': { json: { stargazers_count: 'muchas', license: { spdx_id: 'NOASSERTION' } } },
    });
    const ficha = await consultarFicha(enlace('https://github.com/a/b'), consulta(pedir), AHORA);
    expect(ficha?.campos).toEqual({});
  });

  it('issue y PR: título, estado (fusionado si se fusionó) y comentarios', async () => {
    const { pedir } = pedirFalso({
      'https://api.github.com/repos/a/b/issues/12': {
        json: {
          title: 'Timeout en streaming',
          state: 'closed',
          comments: 4,
          pull_request: { merged_at: '2026-10-01T00:00:00Z' },
        },
      },
    });
    const ficha = await consultarFicha(enlace('https://github.com/a/b/pull/12'), consulta(pedir), AHORA);
    expect(ficha?.campos).toMatchObject({ titulo: 'Timeout en streaming', estado: 'fusionado', comentarios: 4 });
  });

  it('límite de consultas, no encontrado y sin red: fallos con nombre', async () => {
    const d = enlace('https://github.com/a/b');
    const limite = pedirFalso({
      'https://api.github.com/repos/a/b': {
        status: 403,
        headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1792936800' },
      },
    });
    const error = await consultarFicha(d, consulta(limite.pedir), AHORA).catch((e) => e);
    expect(error).toBeInstanceOf(FalloConsulta);
    expect(error).toMatchObject({ codigo: 'limite', hasta: new Date(1792936800 * 1000).toISOString() });
    await expect(consultarFicha(d, consulta(pedirFalso({}).pedir), AHORA)).rejects.toMatchObject({
      codigo: 'no-encontrado',
    });
    const sinRed = pedirFalso({ 'https://api.github.com/repos/a/b': 'sin-red' });
    await expect(consultarFicha(d, consulta(sinRed.pedir), AHORA)).rejects.toMatchObject({ codigo: 'sin-red' });
  });
});

describe('GitLab', () => {
  it('con subgrupos, su licencia como SPDX', async () => {
    const { pedir, pedidas } = pedirFalso({
      'https://gitlab.com/api/v4/projects/grupo%2Fsub%2Fproyecto': {
        json: {
          star_count: 7,
          license: { key: 'apache-2.0' },
          last_activity_at: '2026-09-01T00:00:00Z',
          archived: true,
        },
      },
    });
    const ficha = await consultarFicha(enlace('https://gitlab.com/grupo/sub/proyecto'), consulta(pedir), AHORA);
    expect(ficha?.campos).toEqual({
      estrellas: 7,
      licencia: 'Apache-2.0',
      ultimoPush: '2026-09-01T00:00:00Z',
      archivado: true,
    });
    expect(pedidas[0]?.url).toContain('?license=true');
  });
});

describe('paquetes', () => {
  const DEPS = 'https://api.deps.dev/v3/systems/cargo/packages/serde';
  const rutas = (extra: Record<string, Respuesta> = {}): Record<string, Respuesta> => ({
    [DEPS]: {
      json: {
        versions: [
          { versionKey: { version: '1.0.209' }, isDefault: false },
          { versionKey: { version: '1.0.210' }, isDefault: true, publishedAt: '2026-10-22T00:00:00Z' },
        ],
      },
    },
    [`${DEPS}/versions/1.0.210`]: { json: { licenses: ['MIT', 'Apache-2.0'], advisoryKeys: [{ id: 'GHSA-1' }] } },
    'https://api.osv.dev/v1/query': { json: { vulns: [] } },
    ...extra,
  });

  it('deps.dev (versión por defecto, fecha y licencias) y OSV (vulnerabilidades de esa versión)', async () => {
    const { pedir, pedidas } = pedirFalso(rutas());
    const ficha = await consultarFicha(enlace('https://crates.io/crates/serde'), consulta(pedir), AHORA);
    expect(ficha?.campos).toEqual({
      version: '1.0.210',
      fechaVersion: '2026-10-22T00:00:00Z',
      licencia: 'MIT · Apache-2.0',
      vulnerabilidades: 0,
    });
    const osv = pedidas.find((p) => p.url.includes('osv'));
    expect(JSON.parse(String(osv?.init?.body))).toEqual({
      version: '1.0.210',
      package: { name: 'serde', ecosystem: 'crates.io' },
    });
  });

  it('sin OSV activado, los avisos de deps.dev; sin fecha en deps.dev, la del registro (si está activado)', async () => {
    const sinFecha = rutas({
      [DEPS]: { json: { versions: [{ versionKey: { version: '1.0.210' }, isDefault: true }] } },
      'https://crates.io/api/v1/crates/serde/1.0.210': { json: { version: { created_at: '2026-10-21T00:00:00Z' } } },
    });
    const { pedir, pedidas } = pedirFalso(sinFecha);
    const ficha = await consultarFicha(
      enlace('https://crates.io/crates/serde'),
      consulta(pedir, new Set(['api.deps.dev', 'crates.io'])),
      AHORA,
    );
    expect(ficha?.campos).toMatchObject({ fechaVersion: '2026-10-21T00:00:00Z', vulnerabilidades: 1 });
    expect(pedidas.some((p) => p.url.includes('osv'))).toBe(false);
  });

  it('un paquete npm con ámbito y Maven por deps.dev', async () => {
    const npm = pedirFalso({});
    await consultarFicha(enlace('https://www.npmjs.com/package/@scope/nombre'), consulta(npm.pedir), AHORA).catch(
      () => null,
    );
    expect(npm.pedidas[0]?.url).toBe('https://api.deps.dev/v3/systems/npm/packages/%40scope%2Fnombre');
    const maven = pedirFalso({});
    await consultarFicha(
      enlace('https://central.sonatype.com/artifact/org.slf4j/slf4j-api'),
      consulta(maven.pedir),
      AHORA,
    ).catch(() => null);
    expect(maven.pedidas[0]?.url).toBe('https://api.deps.dev/v3/systems/maven/packages/org.slf4j%3Aslf4j-api');
  });
});

describe('papers', () => {
  it('Crossref por DOI: título, autores, año y revista', async () => {
    const { pedir, pedidas } = pedirFalso({
      'https://api.crossref.org/works/10.1038/nature14539': {
        json: {
          message: {
            title: ['Deep learning'],
            author: [
              { given: 'Yann', family: 'LeCun' },
              { given: 'Yoshua', family: 'Bengio' },
              { given: 'Geoffrey', family: 'Hinton' },
              { name: 'Otro' },
            ],
            issued: { 'date-parts': [[2015, 5, 27]] },
            'container-title': ['Nature'],
          },
        },
      },
    });
    const ficha = await consultarFicha(enlace('https://doi.org/10.1038/nature14539'), consulta(pedir), AHORA);
    expect(ficha?.campos).toEqual({
      titulo: 'Deep learning',
      autores: 'Yann LeCun · Yoshua Bengio · Geoffrey Hinton · …',
      anio: 2015,
      revista: 'Nature',
    });
    expect(pedidas[0]?.url).toBe('https://api.crossref.org/works/10.1038/nature14539');
  });

  it('arXiv por su DOI de DataCite (sin la versión)', async () => {
    const { pedir } = pedirFalso({
      'https://api.datacite.org/dois/10.48550/arXiv.1706.03762': {
        json: {
          data: {
            attributes: {
              titles: [{ title: 'Attention Is All You Need' }],
              creators: [{ givenName: 'Ashish', familyName: 'Vaswani' }],
              publicationYear: 2017,
            },
          },
        },
      },
    });
    const ficha = await consultarFicha(enlace('https://arxiv.org/abs/1706.03762v5'), consulta(pedir), AHORA);
    expect(ficha?.campos).toEqual({ titulo: 'Attention Is All You Need', autores: 'Ashish Vaswani', anio: 2017 });
  });
});

describe('cambios entre fichas', () => {
  it('lo que cambió, en el orden de la nueva, y lo que desapareció al final', () => {
    expect(
      cambiosDeFicha(
        { estrellas: 1204, licencia: 'MIT', ultimoLanzamiento: '2.9.0', archivado: false },
        { estrellas: 1290, licencia: 'MIT', ultimoLanzamiento: '2.10.1', issuesAbiertas: 3 },
      ),
    ).toEqual([
      { campo: 'estrellas', antes: 1204, despues: 1290 },
      { campo: 'ultimoLanzamiento', antes: '2.9.0', despues: '2.10.1' },
      { campo: 'issuesAbiertas', despues: 3 },
      { campo: 'archivado', antes: false },
    ]);
    expect(cambiosDeFicha({ a: 1 }, { a: 1 })).toEqual([]);
  });
});

describe('frases con la ficha', () => {
  const ahora = new Date('2026-10-25T12:00:00+02:00');
  const ficha = (fuente: 'github' | 'paquete' | 'crossref', campos: Record<string, string | number | boolean>) => ({
    fuente,
    consultada: '2026-10-25T10:00:00+02:00',
    campos,
  });
  const repo = enlace('https://github.com/algesten/ureq');

  it('repositorio activo, sin actividad o archivado', () => {
    const activo = ficha('github', {
      ultimoPush: '2026-10-20T08:00:00Z',
      fechaLanzamiento: '2026-10-13T12:00:00Z',
      licencia: 'MIT',
    });
    expect(fraseDeFicha(repo, activo, 'es', ahora)).toBe(
      'Repositorio activo: último lanzamiento hace 12 días, licencia MIT.',
    );
    expect(fraseDeFicha(repo, activo, 'en', ahora)).toBe('Active repository: latest release 12 days ago, MIT license.');
    expect(fraseDeFicha(repo, ficha('github', { ultimoPush: '2026-03-03T08:00:00Z' }), 'es', ahora)).toBe(
      'Repositorio sin actividad desde el 3 mar.',
    );
    expect(fraseDeFicha(repo, ficha('github', { archivado: true, licencia: 'MIT' }), 'es', ahora)).toBe(
      'Repositorio archivado: licencia MIT.',
    );
    // Sin lo bastante, la respuesta de siempre.
    expect(fraseDeFicha(repo, ficha('github', { estrellas: 3 }), 'es', ahora)).toBeNull();
  });

  it('paquete con y sin vulnerabilidades; paper', () => {
    const serde = enlace('https://crates.io/crates/serde');
    const campos = { version: '1.0.210', fechaVersion: '2026-10-22T00:00:00Z', licencia: 'MIT' };
    expect(fraseDeFicha(serde, ficha('paquete', { ...campos, vulnerabilidades: 0 }), 'es', ahora)).toBe(
      'serde 1.0.210, publicado hace 3 días, licencia MIT; sin vulnerabilidades conocidas.',
    );
    expect(fraseDeFicha(serde, ficha('paquete', { ...campos, vulnerabilidades: 2 }), 'en', ahora)).toBe(
      'serde 1.0.210, published 3 days ago, MIT license; 2 known vulnerabilities.',
    );
    const paper = enlace('https://doi.org/10.1038/nature14539');
    expect(
      fraseDeFicha(paper, ficha('crossref', { titulo: 'Deep learning', anio: 2015, revista: 'Nature' }), 'es', ahora),
    ).toBe('Paper de 2015 en Nature: «Deep learning».');
  });
});

describe('frases con la ficha y las reglas de estilo', () => {
  it('ninguna incumple las reglas, en es ni en en', () => {
    const ahora = new Date('2026-10-25T12:00:00+02:00');
    const casos: [string, Parameters<typeof fraseDeFicha>[1]][] = [
      [
        'https://github.com/a/b',
        {
          fuente: 'github',
          consultada: '2026-10-25T10:00:00+02:00',
          campos: { ultimoPush: '2026-10-20T08:00:00Z', fechaLanzamiento: '2026-10-24T08:00:00Z', licencia: 'MIT' },
        },
      ],
      [
        'https://github.com/a/b/issues/3',
        { fuente: 'github', consultada: '2026-10-25T10:00:00+02:00', campos: { titulo: 'Falla', estado: 'open' } },
      ],
      [
        'https://crates.io/crates/serde',
        {
          fuente: 'paquete',
          consultada: '2026-10-25T10:00:00+02:00',
          campos: { version: '1.0.0', vulnerabilidades: 1 },
        },
      ],
      [
        'https://arxiv.org/abs/1706.03762',
        {
          fuente: 'arxiv',
          consultada: '2026-10-25T10:00:00+02:00',
          campos: { titulo: 'Attention Is All You Need', anio: 2017 },
        },
      ],
    ];
    for (const [url, ficha] of casos)
      for (const idioma of ['es', 'en'] as const) {
        const frase = fraseDeFicha(enlace(url), ficha, idioma, ahora);
        expect(frase, url).toBeTruthy();
        expect(comprobarEstilo({ texto: [{ t: 'texto', v: frase ?? '' }] }), url).toEqual([]);
      }
  });
});

describe('correcciones de la revisión', () => {
  it('GitHub: un token rechazado (401) es «token»; el último lanzamiento que falla no estropea la ficha', async () => {
    const d = enlace('https://github.com/a/b');
    const rechazado = pedirFalso({ 'https://api.github.com/repos/a/b': { status: 401 } });
    await expect(consultarFicha(d, consulta(rechazado.pedir, todos, 'ghp_viejo'), AHORA)).rejects.toMatchObject({
      codigo: 'token',
    });
    const roto = pedirFalso({
      'https://api.github.com/repos/a/b': { json: { stargazers_count: 2 } },
      'https://api.github.com/repos/a/b/releases/latest': { status: 500 },
    });
    expect((await consultarFicha(d, consulta(roto.pedir), AHORA))?.campos).toEqual({ estrellas: 2 });
  });

  it('una redirección a un dominio no activado no se lee; sin respuesta en el plazo cuenta como sin red', async () => {
    const d = enlace('https://github.com/a/b');
    const redirigida = async () => {
      const r = new Response(JSON.stringify({ stargazers_count: 1 }));
      Object.defineProperty(r, 'url', { value: 'https://otro.example/repos/a/b' });
      return r;
    };
    await expect(consultarFicha(d, consulta(redirigida), AHORA)).rejects.toMatchObject({ codigo: 'fallo' });
    const lenta = async () => {
      throw new DOMException('plazo', 'TimeoutError');
    };
    await expect(consultarFicha(d, consulta(lenta), AHORA)).rejects.toMatchObject({ codigo: 'sin-red' });
  });

  it('Go: sin la versión y recortando hasta el módulo si deps.dev no conoce el paquete', async () => {
    expect(nombresParaDepsDev('go', 'golang.org/x/net/http2')).toEqual(['golang.org/x/net/http2', 'golang.org/x/net']);
    expect(nombresParaDepsDev('go', 'github.com/gin-gonic/gin@v1.9.1')).toEqual(['github.com/gin-gonic/gin']);
    expect(nombresParaDepsDev('npm', 'a/b/c')).toEqual(['a/b/c']);
    const base = 'https://api.deps.dev/v3/systems/go/packages/golang.org%2Fx%2Fnet';
    const { pedir, pedidas } = pedirFalso({
      [base]: { json: { versions: [{ versionKey: { version: 'v0.30.0' }, isDefault: true }] } },
      [`${base}/versions/v0.30.0`]: { json: { licenses: ['BSD-3-Clause'] } },
      'https://api.osv.dev/v1/query': { json: {} },
    });
    const ficha = await consultarFicha(enlace('https://pkg.go.dev/golang.org/x/net/http2'), consulta(pedir), AHORA);
    expect(ficha?.campos).toMatchObject({ version: 'v0.30.0', licencia: 'BSD-3-Clause', vulnerabilidades: 0 });
    expect(JSON.parse(String(pedidas.find((p) => p.url.includes('osv'))?.init?.body)).package.name).toBe(
      'golang.org/x/net',
    );
  });

  it('OSV con una respuesta que no se entiende o con más páginas: cuentan los avisos de deps.dev', async () => {
    const base = 'https://api.deps.dev/v3/systems/pypi/packages/requests';
    for (const osv of [[], { vulns: [{}], next_page_token: 'x' }]) {
      const { pedir } = pedirFalso({
        [base]: { json: { versions: [{ versionKey: { version: '2.32.3' }, isDefault: true }] } },
        [`${base}/versions/2.32.3`]: { json: { advisoryKeys: [{ id: 'A' }, { id: 'B' }] } },
        'https://api.osv.dev/v1/query': { json: osv },
      });
      const ficha = await consultarFicha(
        enlace('https://pypi.org/project/requests'),
        consulta(pedir, new Set(['api.deps.dev', 'api.osv.dev'])),
        AHORA,
      );
      expect(ficha?.campos.vulnerabilidades).toBe(2);
    }
  });

  it('un DOI que Crossref no conoce (Zenodo) se busca en DataCite si está activado', async () => {
    const { pedir } = pedirFalso({
      'https://api.datacite.org/dois/10.5281/zenodo.123': {
        json: {
          data: {
            attributes: { titles: [{ title: 'Datos del ensayo' }], publicationYear: '2024', publisher: 'Zenodo' },
          },
        },
      },
    });
    const d = enlace('https://doi.org/10.5281/zenodo.123');
    expect((await consultarFicha(d, consulta(pedir), AHORA))?.campos).toEqual({
      titulo: 'Datos del ensayo',
      anio: 2024,
      revista: 'Zenodo',
    });
    await expect(consultarFicha(d, consulta(pedir, new Set(['api.crossref.org'])), AHORA)).rejects.toMatchObject({
      codigo: 'no-encontrado',
    });
  });

  it('el token solo se guarda si vale (ASCII visible)', () => {
    expect(tokenValido('github_pat_11ABC')).toBe(true);
    expect(tokenValido('ghp_\u200bx')).toBe(false);
    expect(guardarTokenGithub('ghp_\u200bx')).toBe(false);
  });
});
