/**
 * Lector Mediciones (LEC-06, plan §8.3): una serie de tiempos con su mediana, el intervalo de confianza del 95 %
 * de la mediana, la variación y los avisos de método de `@rimor/estadistica`. Varias series en un pegado (varios
 * benchmarks o comandos) se guardan todas; la respuesta y las cifras hablan de la primera.
 */

import { type AvisoMetodo, avisosDeMetodo, type Descriptiva, describir, MINIMO_REPETICIONES } from '@rimor/estadistica';
import type { Elemento } from '@rimor/formato';
import { fmtCifra, fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Borrador, Cifra, Entrada, Lector } from '../contrato';
import { confianzaMediciones, type FormatoMediciones, leerSeries, type Serie, type UnidadSerie } from './series';
import { textos } from './textos';

export interface SerieDerivada extends Serie {
  d: Descriptiva;
  avisos: AvisoMetodo[];
}

export interface DatosMediciones {
  formato: FormatoMediciones;
  series: SerieDerivada[];
}

const LARGO_TITULO = 100;

/**
 * Decimales para mostrar valores del orden de `v`: unas cuatro cifras significativas («38,54», «410,2», «1234»,
 * «0,001234»), entre 0 y 6.
 */
export function decimalesPara(v: number): number {
  if (!Number.isFinite(v) || v === 0) return 2;
  return Math.min(6, Math.max(0, 3 - Math.floor(Math.log10(Math.abs(v)))));
}

/** Formateadores de una serie: todos sus valores con los mismos decimales, los de su mediana. */
export function formatosDe(s: Pick<SerieDerivada, 'd' | 'unidad'>, idioma: Idioma) {
  const dec = decimalesPara(s.d.mediana);
  return {
    numero: (v: number) => fmtNumero(v, idioma, dec),
    conUnidad: (v: number) => fmtCifra(v, dec, s.unidad, idioma),
    porcentaje: (f: number) => fmtCifra(f * 100, 1, '%', idioma),
  };
}

/** Cifra de la primera serie; sin series, «—». */
function cifraDe(d: DatosMediciones, f: (s: SerieDerivada) => Cifra): Cifra {
  const s = d.series[0];
  return s ? f(s) : { texto: '—' };
}

const valorCon = (s: SerieDerivada, v: number, unidad: UnidadSerie | '%' = s.unidad): Cifra => ({
  texto: unidad === '%' ? fmtCifra(v, 1, '%', 'es') : formatosDe(s, 'es').conUnidad(v),
  ...(Number.isFinite(v) ? { valor: v, unidad } : {}),
});

export const lectorMediciones: Lector<DatosMediciones> = {
  nombre: 'mediciones',
  tipo: 'mediciones',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto !== undefined ? confianzaMediciones(e.texto) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const { series } = leerSeries(texto);
    const etiqueta = series.find((s) => s.etiqueta)?.etiqueta;
    const titulo = etiqueta ? etiqueta.slice(0, LARGO_TITULO) : textos.t('es', 'titulo');
    return { titulo, original: texto, resumen: { n: series[0]?.valores.length ?? 0 } };
  },

  async derivar(el: Elemento): Promise<DatosMediciones> {
    if (el.original === null) throw new Error('mediciones.sinOriginal');
    const { formato, series } = leerSeries(el.original);
    return {
      formato,
      series: series.map((s) => ({ ...s, d: describir(s.valores), avisos: avisosDeMetodo(s.valores) })),
    };
  },

  resumen: (d) => {
    const s = d.series[0];
    if (!s) return { n: 0, series: 0 };
    return { n: s.d.n, mediana: s.d.mediana, unidad: s.unidad, series: d.series.length };
  },

  resumenLegible(r, idioma) {
    if (typeof r.n !== 'number') return '';
    const mediciones = textos.t(idioma, 'mediciones', { n: r.n });
    if (typeof r.mediana !== 'number' || !Number.isFinite(r.mediana) || typeof r.unidad !== 'string') {
      return mediciones;
    }
    const mediana = fmtCifra(r.mediana, decimalesPara(r.mediana), r.unidad, idioma);
    return textos.t(idioma, 'legible', { mediciones, mediana });
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const s = d.series[0];
    if (!s || !s.d.n) return { texto: [{ t: 'texto', v: textos.t(i, 'respuesta.vacia') }] };
    const f = formatosDe(s, i);
    const mediciones = textos.t(i, 'mediciones', { n: s.d.n });
    // Con una sola medición no hay intervalo que dar.
    const inicio =
      s.d.n > 1
        ? textos.t(i, 'respuesta.serie', {
            mediciones,
            mediana: f.conUnidad(s.d.mediana),
            bajo: f.numero(s.d.icBajo),
            alto: f.numero(s.d.icAlto),
          })
        : textos.t(i, 'respuesta.una', { mediciones, mediana: f.conUnidad(s.d.mediana) });
    const mas = d.series.length > 1 ? textos.t(i, 'respuesta.masSeries', { n: d.series.length - 1 }) : '';
    const pocas =
      s.d.n < MINIMO_REPETICIONES ? ` ${textos.t(i, 'respuesta.pocas', { minimo: MINIMO_REPETICIONES })}` : '';
    return { texto: [{ t: 'texto', v: `${inicio}${mas}${textos.t(i, 'respuesta.fin')}${pocas}` }] };
  },

  cifras: {
    mediana: (d) => cifraDe(d, (s) => valorCon(s, s.d.mediana)),
    ic_bajo: (d) => cifraDe(d, (s) => valorCon(s, s.d.icBajo)),
    ic_alto: (d) => cifraDe(d, (s) => valorCon(s, s.d.icAlto)),
    n: (d) => cifraDe(d, (s) => ({ texto: fmtNumero(s.d.n, 'es'), valor: s.d.n })),
    cv: (d) => cifraDe(d, (s) => valorCon(s, s.d.cv * 100, '%')),
  },

  textoIndexable: (d) =>
    d.series
      .map((s) => s.etiqueta)
      .filter(Boolean)
      .join('\n'),
};
