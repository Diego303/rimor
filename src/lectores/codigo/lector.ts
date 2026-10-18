/**
 * Lector Código (LEC-09): el lenguaje (por extensión o por densidad de sintaxis, entre los 12 más comunes), las
 * líneas y las definiciones. El resaltado (Lezer, D16) va en la vista, cargado bajo demanda.
 */
import type { Elemento } from '@rimor/formato';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { analizarCodigo, confianzaCodigo, type DatosCodigo } from './analisis';
import { LENGUAJES, type Lenguaje } from './lenguajes';
import { textos } from './textos';

export type { DatosCodigo } from './analisis';

const LARGO_TITULO = 80;

type T = (i: Idioma, c: string, v?: Record<string, string | number>) => string;
const t = textos.t as unknown as T;

/** Nombre del lenguaje para enseñar. */
export const nombreDeLenguaje = (l: Lenguaje | null, idioma: Idioma) => (l ? t(idioma, `lenguajes.${l}`) : null);

/** Título: la primera definición o la primera línea que no es un comentario. */
export function tituloDeCodigo(texto: string, d: Pick<DatosCodigo, 'definiciones'>): string {
  if (d.definiciones[0]) return d.definiciones[0];
  const primera =
    texto
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l && !/^(?:\/\/|#|\/\*|\*|--|<\?php)/.test(l)) ?? '';
  if (!primera) return textos.t('es', 'titulo');
  return primera.length > LARGO_TITULO ? `${primera.slice(0, LARGO_TITULO - 1)}…` : primera;
}

export const lectorCodigo: Lector<DatosCodigo> = {
  nombre: 'codigo',
  tipo: 'codigo',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto !== undefined ? confianzaCodigo(e.texto, e.nombre) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const d = analizarCodigo(texto, e.nombre);
    return {
      titulo: tituloDeCodigo(texto, d),
      original: texto,
      resumen: lectorCodigo.resumen(d),
      // Si llegó de archivo, su nombre: el lenguaje por extensión se vuelve a saber al derivar.
      ...(e.nombre ? { metadatos: { archivo_de_codigo: e.nombre } } : {}),
    };
  },

  async derivar(el: Elemento): Promise<DatosCodigo> {
    if (el.original === null) throw new Error('codigo.sinOriginal');
    const nombre = (el.frontmatter as Record<string, unknown>).archivo_de_codigo;
    return analizarCodigo(el.original, typeof nombre === 'string' ? nombre : undefined);
  },

  resumen: (d) => ({ ...(d.lenguaje ? { lenguaje: d.lenguaje } : {}), lineas: d.lineas }),

  resumenLegible(r, idioma) {
    const lineas = typeof r.lineas === 'number' ? t(idioma, 'lineas', { n: r.lineas }) : '';
    const lenguaje = LENGUAJES.includes(r.lenguaje as Lenguaje)
      ? nombreDeLenguaje(r.lenguaje as Lenguaje, idioma)
      : null;
    return [lenguaje, lineas].filter(Boolean).join(' · ');
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const lineas = t(i, 'lineas', { n: d.lineas });
    const lenguaje = nombreDeLenguaje(d.lenguaje, i);
    return {
      texto: [
        {
          t: 'texto',
          v: lenguaje ? t(i, 'respuesta.conLenguaje', { lenguaje, lineas }) : t(i, 'respuesta.sinLenguaje', { lineas }),
        },
      ],
    };
  },

  cifras: {
    lineas: (d) => ({ texto: fmtNumero(d.lineas, 'es'), valor: d.lineas }),
  },

  textoIndexable: (d) => d.definiciones.join('\n'),
};
