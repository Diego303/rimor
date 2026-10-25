/**
 * Papers (IN-041): Crossref para un DOI (título, autores, año y revista) y, como arXiv no admite CORS (F0-7), su DOI
 * de DataCite `10.48550/arXiv.{id}` para un enlace de arXiv.
 */
import type { DatosEnlace } from '../lector';
import { type Consulta, campos, type Enriquecedor, FalloConsulta, numero, objeto, pedirJson, texto } from './contrato';

const CROSSREF = 'api.crossref.org';
const DATACITE = 'api.datacite.org';

/** Hasta tres autores separados por « · », y «…» si hay más. */
export function autoresDe(nombres: string[]): string | undefined {
  return nombres.length ? nombres.slice(0, 3).join(' · ') + (nombres.length > 3 ? ' · …' : '') : undefined;
}

/** Cada parte codificada, con sus barras (los DOI y los id antiguos de arXiv las llevan). */
const ruta = (s: string) => s.split('/').map(encodeURIComponent).join('/');

/** Los DOI de arXiv (`10.48550/arXiv.…`) los registra DataCite: van por su proveedor. */
const ARXIV_DOI = /^10\.48550\/arxiv\.(.+)$/i;

const doiDe = (d: DatosEnlace) =>
  d.clase === 'paper' && d.nombre && (d.sitio === 'DOI' || /^10\.\d{4,9}\//.test(d.nombre)) && !ARXIV_DOI.test(d.nombre)
    ? d.nombre
    : undefined;

const lista = (x: unknown) => (Array.isArray(x) ? x : []);

/** Los campos de un DOI de DataCite (arXiv, Zenodo…). */
async function deDatacite(doi: string, c: Consulta) {
  const a = objeto(objeto(objeto(await pedirJson(`https://${DATACITE}/dois/${ruta(doi)}`, c))?.data)?.attributes);
  if (!a) throw new FalloConsulta('fallo');
  const autores = lista(a.creators)
    .map(objeto)
    .map((p) => [texto(p?.givenName), texto(p?.familyName)].filter(Boolean).join(' ') || texto(p?.name))
    .filter((n): n is string => !!n);
  return campos({
    titulo: texto(objeto(lista(a.titles)[0])?.title),
    autores: autoresDe(autores),
    anio: numero(a.publicationYear) ?? numero(Number(a.publicationYear) || undefined),
    revista: texto(a.publisher),
  });
}

/** Crossref; si no conoce el DOI (lo registró otra agencia, como DataCite para Zenodo) y DataCite está activado, él. */
export const crossref: Enriquecedor = {
  id: 'crossref',
  acepta: (d) => !!doiDe(d),
  dominios: () => [CROSSREF, DATACITE],
  async consultar(d, c) {
    const doi = doiDe(d) ?? '';
    let respuesta: unknown;
    try {
      respuesta = await pedirJson(`https://${CROSSREF}/works/${ruta(doi)}`, c);
    } catch (e) {
      if (e instanceof FalloConsulta && e.codigo === 'no-encontrado' && c.activos.has(DATACITE))
        return deDatacite(doi, c);
      throw e;
    }
    const m = objeto(objeto(respuesta)?.message);
    if (!m) throw new FalloConsulta('fallo');
    const autores = lista(m.author)
      .map(objeto)
      .map((a) => [texto(a?.given), texto(a?.family)].filter(Boolean).join(' ') || texto(a?.name))
      .filter((n): n is string => !!n);
    const partes = lista(objeto(m.issued)?.['date-parts'])[0];
    return campos({
      titulo: texto(lista(m.title)[0]),
      autores: autoresDe(autores),
      anio: numero(Array.isArray(partes) ? partes[0] : undefined),
      revista: texto(lista(m['container-title'])[0]),
    });
  },
};

/** Un enlace de arXiv, o su DOI, por DataCite (arXiv no admite CORS, F0-7). */
export const arxiv: Enriquecedor = {
  id: 'arxiv',
  acepta: (d) => d.clase === 'paper' && !!d.nombre && (d.sitio === 'arXiv' || ARXIV_DOI.test(d.nombre)),
  dominios: () => [DATACITE],
  consultar(d, c) {
    // Sin la versión (`2301.00001v2`): el DOI de DataCite es el del artículo.
    const id = (ARXIV_DOI.exec(d.nombre ?? '')?.[1] ?? d.nombre ?? '').replace(/v\d+$/, '');
    return deDatacite(`10.48550/arXiv.${id}`, c);
  },
};
