/**
 * Lector Datos tabulares (LEC-11, IN-044): un CSV o un TSV pegado o soltado, o un Parquet soltado, perfilado con
 * DuckDB-WASM (en el Worker de derivados, con DuckDB en su propio Worker). Puesto 8 del Anexo D.
 */
import type { Elemento } from '@rimor/formato';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Fragmento } from '../../respuestas/tipos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { formaCsv, puntuarCsv } from './csv';
import { obtenerMotor, type Valor } from './motor';
import { type DatosTabla, type FormatoDatos, type PerfilColumna, perfilar } from './perfil';
import { textos } from './textos';

export type { DatosTabla } from './perfil';

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

/** El formato de un elemento: el de su resumen o, si no, el de su adjunto. */
export function formatoDe(el: Pick<Elemento, 'frontmatter'>): FormatoDatos {
  const r = el.frontmatter.lector.resumen.formato;
  if (r === 'csv' || r === 'tsv' || r === 'parquet') return r;
  const a = el.frontmatter.adjunto;
  if (a && (/\.parquet$/i.test(a.nombre ?? '') || /parquet/i.test(a.mime ?? ''))) return 'parquet';
  return a && /\.tsv$/i.test(a.nombre ?? '') ? 'tsv' : 'csv';
}

/** Un valor de una celda, como se lee. */
export function valorLegible(v: Valor | undefined, idioma: Idioma): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return fmtNumero(v, idioma);
  return String(v);
}

/** «latencia_ms» → «latencias» y el valor en su unidad («30 s»); sin unidad en el nombre, `null`. */
function conUnidad(c: PerfilColumna, idioma: Idioma): { nombre: string; valor: string } | null {
  const m = /^(.+?)_(ms|s)$/i.exec(c.nombre);
  if (!m || typeof c.max !== 'number') return null;
  const base = (m[1] ?? '').replace(/_/g, ' ');
  const plural = /[aeiouáéíóú]$/i.test(base) ? `${base}s` : `${base}es`;
  const enSegundos = m[2]?.toLowerCase() === 'ms' ? c.max / 1000 : c.max;
  const valor = enSegundos >= 1 ? `${fmtNumero(enSegundos, idioma)} s` : `${fmtNumero(c.max, idioma)} ms`;
  return { nombre: idioma === 'en' ? `${base}s` : plural, valor };
}

/**
 * Lo raro, para la respuesta: las filas en el máximo de la columna donde más se repite un máximo atípico
 * («17 latencias de 30 s») y la columna con más nulos («20 nulos en bytes»).
 */
export function loRaro(d: DatosTabla, idioma: Idioma): Fragmento[][] {
  const cosas: Fragmento[][] = [];
  // Primero las que dicen su unidad (`latencia_ms`): un código como `status` también tiene «máximos atípicos».
  const conNombreDeUnidad = (c: PerfilColumna) => (/_(?:ms|s)$/i.test(c.nombre) ? 1 : 0);
  const maximo = d.columnas
    .filter((c) => c.clase === 'numero' && c.maximoAtipico && (c.enMaximo ?? 0) >= 2)
    .sort((a, b) => conNombreDeUnidad(b) - conNombreDeUnidad(a) || (b.enMaximo ?? 0) - (a.enMaximo ?? 0))[0];
  if (maximo) {
    const u = conUnidad(maximo, idioma);
    cosas.push(
      u
        ? conColumna(
            t(idioma, 'respuesta.enMaximo', {
              n: fmtNumero(maximo.enMaximo ?? 0, idioma),
              nombre: HUECO,
              valor: u.valor,
            }),
            u.nombre,
          )
        : conColumna(
            t(idioma, 'respuesta.enMaximoFilas', {
              n: maximo.enMaximo ?? 0,
              columna: HUECO,
              valor: valorLegible(maximo.max, idioma),
            }),
            maximo.nombre,
          ),
    );
  }
  const nulos = [...d.columnas].filter((c) => c.nulos > 0).sort((a, b) => b.nulos - a.nulos)[0];
  if (nulos) cosas.push(conColumna(t(idioma, 'respuesta.nulos', { n: nulos.nulos, columna: HUECO }), nulos.nombre));
  return cosas;
}

/** Marca dónde va el nombre de una columna en una frase traducida. */
const HUECO = '\u0000';

/** La frase con el nombre de la columna en mono: es del usuario (no cuenta para las reglas de estilo). */
function conColumna(frase: string, columna: string): Fragmento[] {
  const [antes = '', despues = ''] = frase.split(HUECO);
  return [
    ...(antes ? [{ t: 'texto' as const, v: antes }] : []),
    { t: 'mono' as const, v: columna },
    ...(despues ? [{ t: 'texto' as const, v: despues }] : []),
  ];
}

export const lectorDatos: Lector<DatosTabla> = {
  nombre: 'datos',
  tipo: 'datos',
  version: 1,
  textos,
  necesitaBytes: true,

  // Un Parquet llega por el atajo de binarios del detector; un CSV o un TSV, por su forma.
  detectar: (e: Entrada) => (e.texto !== undefined ? puntuarCsv(e.texto) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const nombre = e.nombre ?? e.archivos?.[0]?.name ?? '';
    if (e.texto === undefined)
      return { titulo: nombre || t('es', 'titulo'), original: null, resumen: { formato: 'parquet' } };
    const forma = formaCsv(e.texto);
    const formato: FormatoDatos = forma?.separador === '\t' ? 'tsv' : 'csv';
    return {
      titulo: nombre || (forma ? t('es', 'tituloColumnas', { n: forma.columnas }) : t('es', 'titulo')),
      original: e.texto,
      resumen: { formato, ...(forma ? { filas: forma.filas, columnas: forma.columnas } : {}) },
    };
  },

  async derivar(el, o) {
    const bytes = o?.bytes ?? (el.original !== null ? new TextEncoder().encode(el.original) : null);
    if (!bytes) throw new Error('datos.sinBytes');
    return perfilar(await obtenerMotor(), bytes, formatoDe(el));
  },

  resumen: (d) => ({ formato: d.formato, filas: d.muestra?.aproximadas ?? d.filas, columnas: d.columnas.length }),

  resumenLegible(r, idioma) {
    const filas = typeof r.filas === 'number' ? t(idioma, 'filas', { n: r.filas }) : '';
    const columnas = typeof r.columnas === 'number' ? t(idioma, 'columnas', { n: r.columnas }) : '';
    return [filas, columnas].filter(Boolean).join(' · ');
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const forma = t(i, 'respuesta.forma', {
      filas: t(i, 'filas', { n: d.muestra?.aproximadas ?? d.filas }),
      columnas: t(i, 'columnas', { n: d.columnas.length }),
    });
    const cosas = loRaro(d, i);
    if (!cosas.length) return { texto: [{ t: 'texto', v: forma }] };
    // «Hay {cosas}.»: lo de antes y lo de después de las cosas, con cada una entre «y».
    const [antes = '', despues = ''] = t(i, 'respuesta.hay', { cosas: HUECO }).split(HUECO);
    const texto: Fragmento[] = [{ t: 'texto', v: `${forma} ${antes}` }];
    cosas.forEach((c, k) => {
      if (k > 0) texto.push({ t: 'texto', v: t(i, 'respuesta.y') });
      texto.push(...c);
    });
    texto.push({ t: 'texto', v: despues });
    // Los trozos de texto seguidos, en uno.
    return {
      texto: texto.reduce<Fragmento[]>((juntos, f) => {
        const ultimo = juntos.at(-1);
        if (f.t === 'texto' && ultimo?.t === 'texto') juntos[juntos.length - 1] = { t: 'texto', v: ultimo.v + f.v };
        else juntos.push(f);
        return juntos;
      }, []),
    };
  },

  cifras: {
    filas: (d) => ({ texto: fmtNumero(d.filas, 'es'), valor: d.filas }),
    columnas: (d) => ({ texto: fmtNumero(d.columnas.length, 'es'), valor: d.columnas.length }),
  },

  textoIndexable: (d) => d.columnas.map((c) => c.nombre).join('\n'),
};
