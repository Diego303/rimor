/**
 * Lector Petición HTTP (LEC-13, IN-046): un `curl` pegado, con su método, su URL, sus cabeceras y su cuerpo
 * separados (los secretos ya ocultos al capturar), para copiarlo otra vez como cURL o como `fetch`. Puesto 9 del
 * Anexo D («empieza por `curl`»).
 */
import type { Elemento } from '@rimor/formato';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Fragmento } from '../../respuestas/tipos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { analizarCurl, esMetodo, hostDe, type PeticionHttp, urlCorta } from './analisis';
import { textos } from './textos';

/** La petición, o `ilegible` si el original ya no se analiza (editado a mano, o pedido con `/http` sin serlo). */
export type DatosHttp = PeticionHttp | { ilegible: true };

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

/** Largo máximo del título. */
const LARGO_TITULO = 80;

export const esPeticion = (d: DatosHttp): d is PeticionHttp => !('ilegible' in d);

/**
 * «POST a `api.example.org/v1/pagos` con 3 cabeceras y un cuerpo JSON.»: la URL en mono (es del usuario), y también
 * un método que no lo parece (`-X 'GET. Y luego!'` no puede romper las reglas de estilo de la respuesta).
 */
function frase(p: PeticionHttp, idioma: Idioma): Fragmento[] {
  const cosas = [
    p.cabeceras.length ? t(idioma, 'cabeceras', { n: p.cabeceras.length }) : '',
    p.cuerpo ? t(idioma, `respuesta.cuerpos.${p.cuerpo.tipo}`) : '',
  ].filter(Boolean);
  const [HUECO_METODO, HUECO_URL] = ['\u0001', '\u0000'];
  const vars = { metodo: HUECO_METODO, url: HUECO_URL };
  const plantilla = cosas.length
    ? t(idioma, 'respuesta.con', { ...vars, cosas: cosas.join(t(idioma, 'respuesta.y')) })
    : t(idioma, 'respuesta.sola', vars);
  const metodo: Fragmento = esMetodo(p.metodo) ? { t: 'texto', v: p.metodo } : { t: 'mono', v: p.metodo };
  const fragmentos: Fragmento[] = [];
  // Los huecos, en su sitio: la URL en mono y el método como texto (o en mono, si no lo parece).
  plantilla.split(HUECO_URL).forEach((trozoUrl, i) => {
    if (i > 0) fragmentos.push({ t: 'mono', v: urlCorta(p.url) });
    trozoUrl.split(HUECO_METODO).forEach((trozo, j) => {
      if (j > 0) fragmentos.push(metodo);
      if (trozo) fragmentos.push({ t: 'texto', v: trozo });
    });
  });
  // Los trozos de texto seguidos, en uno (el método como texto va con lo que le rodea).
  return fragmentos.reduce<Fragmento[]>((juntos, f) => {
    const ultimo = juntos.at(-1);
    if (f.t === 'texto' && ultimo?.t === 'texto') juntos[juntos.length - 1] = { t: 'texto', v: ultimo.v + f.v };
    else juntos.push(f);
    return juntos;
  }, []);
}

export const lectorHttp: Lector<DatosHttp> = {
  nombre: 'http',
  tipo: 'http',
  version: 1,
  textos,

  // Un único `curl` con URL (con sus continuaciones y su tubería); varios comandos siguen siendo un Comando.
  detectar: (e: Entrada) => (e.texto !== undefined && analizarCurl(e.texto) ? 0.92 : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const p = analizarCurl(texto);
    const titulo = p ? `${p.metodo} ${urlCorta(p.url, LARGO_TITULO)}` : t('es', 'titulo');
    return {
      titulo,
      original: texto,
      resumen: p ? { metodo: p.metodo, host: hostDe(p.url), cabeceras: p.cabeceras.length } : {},
    };
  },

  async derivar(el: Elemento) {
    return analizarCurl(el.original ?? '') ?? { ilegible: true as const };
  },

  resumen: (d) => (esPeticion(d) ? { metodo: d.metodo, host: hostDe(d.url), cabeceras: d.cabeceras.length } : {}),

  resumenLegible(r, idioma) {
    const metodo = typeof r.metodo === 'string' ? `${r.metodo} ${typeof r.host === 'string' ? r.host : ''}`.trim() : '';
    const cabeceras = typeof r.cabeceras === 'number' && r.cabeceras ? t(idioma, 'cabeceras', { n: r.cabeceras }) : '';
    return [metodo, cabeceras].filter(Boolean).join(' · ');
  },

  respuesta: (_el, d, ctx) => ({
    texto: esPeticion(d) ? frase(d, ctx.idioma) : [{ t: 'texto', v: t(ctx.idioma, 'respuesta.ilegible') }],
  }),

  cifras: {
    cabeceras: (d) => {
      const n = esPeticion(d) ? d.cabeceras.length : 0;
      return { texto: fmtNumero(n, 'es'), valor: n };
    },
  },

  // Para buscar: el método, la URL y los nombres de las cabeceras.
  textoIndexable: (d) => (esPeticion(d) ? [d.metodo, d.url, ...d.cabeceras.map(([n]) => n)].join('\n') : ''),
};
