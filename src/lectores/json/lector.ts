/**
 * Lector JSON, YAML y TOML (LEC-12, IN-045): una configuración o un documento de datos pegado o soltado, con su
 * árbol, su esquema inferido y, si es la versión nueva de uno que ya estaba, las claves que cambian. Puesto 7 del
 * Anexo D («se analiza sin errores»).
 */
import type { Elemento } from '@rimor/formato';
import { fmtDia, fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Fragmento, Respuesta } from '../../respuestas/tipos';
import type { Borrador, Entrada, Lector } from '../contrato';
import type { EntradaEsquema } from './analisis';
import { confianzaJson, esMapa, type FormatoJson, type ValorJson } from './formas';
import { textos } from './textos';

export interface DatosJson {
  formato: FormatoJson;
  /** Las claves de todos los mapas, a cualquier profundidad. */
  claves: number;
  primerNivel: string[];
  profundidad: number;
  esquema: EntradaEsquema[];
  /** El valor, ya como JSON (las fechas de YAML y TOML, como texto ISO). */
  valor: ValorJson;
  /** Si el original ya no se analiza (editado a mano, o pedido con `/json` sin serlo): la vista enseña el original. */
  ilegible?: true;
}

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

/** Claves de primer nivel que dan nombre a lo pegado (`"name": "rimor"` de un `package.json`). */
const CLAVES_NOMBRE = ['name', 'nombre', 'title', 'titulo', 'título'];
/** Cuántas claves de primer nivel van en el título. */
const CLAVES_EN_TITULO = 3;
/** Cuántas claves que cambian se nombran en la respuesta de una versión (las demás, «y N más»). */
export const CLAVES_EN_RESPUESTA = 3;

export const nombreFormato = (f: FormatoJson, idioma: Idioma) => t(idioma, `formatos.${f}`);

/** El título sin nombre de archivo: su `name` si lo tiene; si no, el formato y sus primeras claves. */
export function tituloDe(formato: FormatoJson, valor: ValorJson): string {
  const nombre = nombreFormato(formato, 'es');
  if (!esMapa(valor)) return nombre;
  const propio = CLAVES_NOMBRE.map((k) => valor[k]).find((v) => typeof v === 'string' && v.trim());
  if (typeof propio === 'string') return `${propio.trim()} · ${nombre}`;
  const claves = Object.keys(valor);
  if (!claves.length) return nombre;
  const mas = claves.length > CLAVES_EN_TITULO ? '…' : '';
  return `${nombre} · ${claves.slice(0, CLAVES_EN_TITULO).join(', ')}${mas}`;
}

/** «TOML con 34 claves.», «JSON con una lista de 12 elementos.» */
function frase(formato: FormatoJson, valor: ValorJson, claves: number, idioma: Idioma): string {
  const vars = { formato: nombreFormato(formato, idioma) };
  if (Array.isArray(valor) && !claves) return t(idioma, 'respuesta.lista', { ...vars, n: valor.length });
  if (!esMapa(valor) && !Array.isArray(valor)) return t(idioma, 'respuesta.valor', vars);
  return t(idioma, 'respuesta.mapa', { ...vars, n: claves });
}

/** Marca dónde va la lista de claves en una frase traducida. */
const HUECO = '\u0000';

/** «`a`», «`a` y `b`», «`a`, `b` y `c`», «`a`, `b`, `c` y 2 más»: las claves en mono (son del usuario). */
function listaDeClaves(claves: readonly string[], idioma: Idioma): Fragmento[] {
  const nombradas = claves.slice(0, CLAVES_EN_RESPUESTA);
  const resto = claves.length - nombradas.length;
  const fragmentos: Fragmento[] = [];
  nombradas.forEach((c, i) => {
    if (i > 0)
      fragmentos.push({
        t: 'texto',
        v: i === nombradas.length - 1 && !resto ? t(idioma, 'respuesta.y') : t(idioma, 'respuesta.coma'),
      });
    fragmentos.push({ t: 'mono', v: c });
  });
  if (resto) fragmentos.push({ t: 'texto', v: t(idioma, 'respuesta.mas', { n: resto }) });
  return fragmentos;
}

/** Los trozos de texto seguidos, en uno. */
const juntar = (fragmentos: Fragmento[]): Fragmento[] =>
  fragmentos.reduce<Fragmento[]>((juntos, f) => {
    const ultimo = juntos.at(-1);
    if (f.t === 'texto' && ultimo?.t === 'texto') juntos[juntos.length - 1] = { t: 'texto', v: ultimo.v + f.v };
    else if (f.t !== 'texto' || f.v) juntos.push(f);
    return juntos;
  }, []);

const nombreArchivo = (el: Pick<Elemento, 'frontmatter'>) => el.frontmatter.adjunto?.nombre ?? el.frontmatter.titulo;

export const lectorJson: Lector<DatosJson> = {
  nombre: 'json',
  tipo: 'json',
  version: 1,
  textos,
  senal: 'leyendo-datos',

  detectar: (e: Entrada) => (e.texto !== undefined ? confianzaJson(e.texto, e.nombre) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const { analizar, contarClaves } = await import('./analisis');
    const a = analizar(texto, e.nombre);
    const nombre = e.nombre ?? e.archivos?.[0]?.name ?? '';
    return {
      titulo: nombre || (a ? tituloDe(a.formato, a.valor) : t('es', 'titulo')),
      original: texto,
      resumen: a ? { formato: a.formato, claves: contarClaves(a.valor) } : {},
    };
  },

  async derivar(el) {
    // El análisis (con `smol-toml`), solo al derivar: no va en la carga inicial.
    const { analizar, contarClaves, esquemaDe, profundidad } = await import('./analisis');
    const a = analizar(el.original ?? '', nombreArchivo(el), { estricto: false });
    if (!a) {
      const r = el.frontmatter.lector.resumen.formato;
      const formato = r === 'yaml' || r === 'toml' ? r : 'json';
      return { formato, claves: 0, primerNivel: [], profundidad: 0, esquema: [], valor: null, ilegible: true };
    }
    return {
      formato: a.formato,
      claves: contarClaves(a.valor),
      primerNivel: esMapa(a.valor) ? Object.keys(a.valor) : [],
      profundidad: profundidad(a.valor),
      esquema: esquemaDe(a.valor),
      valor: a.valor,
    };
  },

  resumen: (d) => ({ formato: d.formato, claves: d.claves }),

  resumenLegible(r, idioma) {
    const formato = r.formato === 'json' || r.formato === 'yaml' || r.formato === 'toml' ? r.formato : null;
    const claves = typeof r.claves === 'number' ? t(idioma, 'claves', { n: r.claves }) : '';
    return [formato ? nombreFormato(formato, idioma) : '', claves].filter(Boolean).join(' · ');
  },

  respuesta: (_el, d, ctx) => ({
    texto: [
      {
        t: 'texto',
        v: d.ilegible ? t(ctx.idioma, 'respuesta.ilegible') : frase(d.formato, d.valor, d.claves, ctx.idioma),
      },
    ],
  }),

  async respuestaVersion(actual, anterior, idioma, ahora = new Date()): Promise<Respuesta | null> {
    const { analizar, compararValores, contarClaves, rutasCambiadas, rutasCortas, totalCambios } = await import(
      './analisis'
    );
    const b = analizar(actual.original ?? '', nombreArchivo(actual), { estricto: false });
    const a = analizar(anterior.original ?? '', nombreArchivo(anterior), { estricto: false });
    if (!a || !b) return null;
    const cambios = compararValores(a.valor, b.valor);
    const n = totalCambios(cambios);
    const fecha = fmtDia(new Date(anterior.frontmatter.modificado), ahora, idioma);
    const primera = `${frase(b.formato, b.valor, contarClaves(b.valor), idioma)} `;
    if (!n) return { texto: [{ t: 'texto', v: primera + t(idioma, 'respuesta.sinCambios', { fecha }) }] };
    const [antes = '', despues = ''] = t(idioma, 'respuesta.version', { fecha, n, claves: HUECO }).split(HUECO);
    return {
      texto: juntar([
        { t: 'texto', v: primera + antes },
        ...listaDeClaves(rutasCortas(rutasCambiadas(cambios)), idioma),
        { t: 'texto', v: despues },
      ]),
    };
  },

  cifras: {
    claves: (d) => ({ texto: fmtNumero(d.claves, 'es'), valor: d.claves }),
    profundidad: (d) => ({ texto: fmtNumero(d.profundidad, 'es'), valor: d.profundidad }),
  },

  // Para buscar: las rutas del esquema (las claves, con su contexto).
  textoIndexable: (d) => d.esquema.map((e) => e.ruta).join('\n'),
};
