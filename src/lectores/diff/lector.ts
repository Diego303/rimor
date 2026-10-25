/**
 * Lector Diff (LEC-09b, IN-042): un diff o un parche (`git diff`, `git format-patch`, diff unificado) es código
 * (`COD-`) con su propio lector, en el puesto 10 del Anexo D. Qué archivos toca y cuánto añade y quita cada uno; la
 * vista los enseña lado a lado.
 */
import type { Elemento } from '@rimor/formato';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { analizarDiff, type DatosDiff, puntuarDiff } from './analisis';
import { textos } from './textos';

export type { DatosDiff } from './analisis';

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

const LARGO_TITULO = 80;

/**
 * «Serie de 3 parches» (varios `format-patch` juntos); el asunto del parche; o «Cambios en src/x.ts» (un archivo) o
 * «Parche de 4 archivos».
 */
export function tituloDeDiff(d: Pick<DatosDiff, 'archivos' | 'asunto' | 'parches'>, idioma: Idioma = 'es'): string {
  const titulo =
    (d.parches > 1 ? t(idioma, 'tituloSerie', { n: d.parches }) : undefined) ??
    d.asunto ??
    (d.archivos.length === 1 && d.archivos[0]?.ruta
      ? t(idioma, 'tituloUno', { ruta: d.archivos[0].ruta })
      : d.archivos.length > 1
        ? t(idioma, 'tituloVarios', { n: d.archivos.length })
        : t(idioma, 'titulo'));
  return titulo.length > LARGO_TITULO ? `${titulo.slice(0, LARGO_TITULO - 1)}…` : titulo;
}

export const lectorDiff: Lector<DatosDiff> = {
  nombre: 'diff',
  tipo: 'codigo',
  version: 1,
  textos,
  etiqueta: (idioma) => t(idioma, 'etiqueta'),
  // Un parche nuevo es otro parche, no la versión de uno anterior (sus títulos se repiten: «Cambios en src/x.ts»).
  sinVersiones: true,

  // Pegado o soltado como archivo de texto (`fix.patch`): con la extensión de parche, aún más seguro.
  detectar: (e: Entrada) => {
    if (e.texto === undefined) return 0;
    const p = puntuarDiff(e.texto);
    return p > 0 && /\.(?:diff|patch)$/i.test(e.nombre ?? '') ? 0.97 : p;
  },

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const d = analizarDiff(texto);
    return { titulo: tituloDeDiff(d), original: texto, resumen: lectorDiff.resumen(d) };
  },

  async derivar(el: Elemento): Promise<DatosDiff> {
    if (el.original === null) throw new Error('diff.sinOriginal');
    return analizarDiff(el.original);
  },

  resumen: (d) => ({ archivos: d.archivos.length, anadidas: d.anadidas, quitadas: d.quitadas }),

  resumenLegible(r, idioma) {
    if (typeof r.archivos !== 'number') return '';
    const archivos = t(idioma, 'archivos', { n: r.archivos });
    return typeof r.anadidas === 'number' && typeof r.quitadas === 'number'
      ? `${archivos} · +${fmtNumero(r.anadidas, idioma)} −${fmtNumero(r.quitadas, idioma)}`
      : archivos;
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const archivos = t(i, 'archivos', { n: d.archivos.length });
    const soloBinarios = d.archivos.length > 0 && d.archivos.every((a) => a.estado === 'binario');
    return {
      texto: [
        {
          t: 'texto',
          v: soloBinarios
            ? t(i, 'respuesta.binario', { archivos })
            : t(i, 'respuesta.cambios', {
                archivos,
                anadidas: fmtNumero(d.anadidas, i),
                quitadas: fmtNumero(d.quitadas, i),
              }),
        },
      ],
    };
  },

  cifras: {
    archivos: (d) => ({ texto: fmtNumero(d.archivos.length, 'es'), valor: d.archivos.length }),
    anadidas: (d) => ({ texto: fmtNumero(d.anadidas, 'es'), valor: d.anadidas }),
    quitadas: (d) => ({ texto: fmtNumero(d.quitadas, 'es'), valor: d.quitadas }),
  },

  textoIndexable: (d) =>
    [d.asunto ?? '', ...d.archivos.flatMap((a) => [a.ruta, a.antes ?? ''])].filter(Boolean).join('\n'),
};
