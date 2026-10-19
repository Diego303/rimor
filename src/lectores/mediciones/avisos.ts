/** El texto de un aviso de método de una serie: lo usan la vista de Mediciones y la comparación de mediciones. */
import type { AvisoMetodo } from '@rimor/estadistica';
import { fmtCifra, type Idioma } from '../../i18n/formatos';
import { type Escala, formatosDe, type SerieDerivada } from './lector';
import { textos } from './textos';

/** Atípicos que se nombran en el aviso; el resto, «…». */
const MAX_ATIPICOS = 5;

export function textoAviso(a: AvisoMetodo, s: SerieDerivada, escala: Escala, idioma: Idioma): string {
  const t = textos.t.bind(textos, idioma) as (c: string, v?: Record<string, string | number>) => string;
  const f = formatosDe(s, idioma, escala);
  switch (a.tipo) {
    case 'pocas':
      return t('aviso.pocas', { mediciones: t('mediciones', { n: a.n }), minimo: a.minimo });
    case 'ruido':
      return t('aviso.ruido', { cv: f.porcentaje(a.cv), maximo: fmtCifra(a.maximo * 100, 0, '%', idioma) });
    case 'atipicos': {
      const nombrados = a.valores.slice(0, MAX_ATIPICOS).map(f.conUnidad).join(', ');
      const valores = a.valores.length > MAX_ATIPICOS ? `${nombrados}…` : nombrados;
      return t('aviso.atipicos', { n: a.valores.length, valores });
    }
  }
}
