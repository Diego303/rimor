/**
 * Papers (IN-041): Crossref para un DOI (título, autores, año y revista) y, como arXiv no admite CORS (F0-7), su DOI
 * de DataCite `10.48550/arXiv.{id}` para un enlace de arXiv.
 */
import type { DatosEnlace } from '../lector';
import { campos, type Enriquecedor, FalloConsulta, numero, objeto, pedirJson, texto } from './contrato';

const CROSSREF = 'api.crossref.org';
const DATACITE = 'api.datacite.org';

/** Hasta tres autores separados por « · », y «…» si hay más. */
export function autoresDe(nombres: string[]): string | undefined {
  return nombres.length ? nombres.slice(0, 3).join(' · ') + (nombres.length > 3 ? ' · …' : '') : undefined;
}

/** Cada parte codificada, con sus barras (los DOI y los id antiguos de arXiv las llevan). */
const ruta = (s: string) => s.split('/').map(encodeURIComponent).join('/');

const doiDe = (d: DatosEnlace) =>
  d.clase === 'paper' && d.nombre && (d.sitio === 'DOI' || /^10\.\d{4,9}\//.test(d.nombre)) ? d.nombre : undefined;

export const crossref: Enriquecedor = {
  id: 'crossref',
  acepta: (d) => !!doiDe(d),
  dominios: () => [CROSSREF],
  async consultar(d, c) {
    const m = objeto(objeto(await pedirJson(`https://${CROSSREF}/works/${ruta(doiDe(d) ?? '')}`, c))?.message);
    if (!m) throw new FalloConsulta('fallo');
    const lista = (x: unknown) => (Array.isArray(x) ? x : []);
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

export const arxiv: Enriquecedor = {
  id: 'arxiv',
  acepta: (d) => d.clase === 'paper' && d.sitio === 'arXiv' && !!d.nombre,
  dominios: () => [DATACITE],
  async consultar(d, c) {
    // Sin la versión (`2301.00001v2`): el DOI de DataCite es el del artículo.
    const id = (d.nombre ?? '').replace(/v\d+$/, '');
    const a = objeto(
      objeto(objeto(await pedirJson(`https://${DATACITE}/dois/10.48550/arXiv.${ruta(id)}`, c))?.data)?.attributes,
    );
    if (!a) throw new FalloConsulta('fallo');
    const lista = (x: unknown) => (Array.isArray(x) ? x : []);
    const autores = lista(a.creators)
      .map(objeto)
      .map((p) => [texto(p?.givenName), texto(p?.familyName)].filter(Boolean).join(' ') || texto(p?.name))
      .filter((n): n is string => !!n);
    return campos({
      titulo: texto(objeto(lista(a.titles)[0])?.title),
      autores: autoresDe(autores),
      anio: numero(a.publicationYear) ?? numero(Number(a.publicationYear) || undefined),
    });
  },
};
