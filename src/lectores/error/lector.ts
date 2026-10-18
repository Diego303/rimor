/**
 * Lector Error y huella (LEC-05, ORG-06, plan §8.2): trazas de seis lenguajes, tus marcos frente a librerías y
 * la huella que reconoce el mismo error otra vez, con lo que escribiste al resolverlo.
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import { fmtDia, type Idioma } from '../../i18n/formatos';
import type { Fragmento } from '../../respuestas/tipos';
import type { Borrador, Contexto, Entrada, Lector } from '../contrato';
import { huellaDe, VERSION_HUELLA } from './huella';
import { textos } from './textos';
import { analizarTraza, ERROR_SUELTO, type Marco, type Traza } from './trazas';

export interface DatosError {
  lenguaje: Traza['lenguaje'] | 'desconocido';
  tipo: string;
  mensaje: string;
  donde?: string | undefined;
  marcos: Marco[];
  huella: string;
  version: number;
}

const LARGO_TITULO = 120;

/** El primer renglón con contenido. */
const primera = (texto: string) => (texto.split(/\r?\n/).find((l) => l.trim()) ?? '').trim();

/** Lo que se sabe de un texto de error: su traza o, si no la hay, su primera línea como mensaje. */
export function analizarError(texto: string): DatosError {
  const t = analizarTraza(texto);
  if (t) return { ...t, huella: huellaDe(t), version: VERSION_HUELLA };
  const linea = primera(texto);
  const suelto = /^(?:Uncaught )?([A-Za-z_$][\w$.]*?(?:Error|Exception)|panic|fatal error):\s*(.*)$/.exec(linea);
  const base = {
    lenguaje: 'desconocido' as const,
    tipo: suelto?.[1] ?? 'Error',
    mensaje: suelto?.[2] ?? linea,
    marcos: [],
  };
  return { ...base, huella: huellaDe(base), version: VERSION_HUELLA };
}

/** Las ocurrencias anteriores con la misma huella (del contexto), de la más antigua a la más reciente. */
const anteriores = (el: Elemento, ctx: Contexto | undefined): FrontmatterComun[] => {
  const propio = Date.parse(el.frontmatter.creado);
  return (ctx?.mismaHuella ?? [])
    .filter((o) => Date.parse(o.creado) < propio)
    .sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
};

/** «tercera» (es), «third» (en); de la undécima en adelante, «11.ª» / «11th». */
export function ordinal(n: number, idioma: Idioma): string {
  const t = textos.t as (i: Idioma, c: string, v?: Record<string, number>) => string;
  return n >= 2 && n <= 10 ? t(idioma, `ordinales.${n}`) : t(idioma, 'ordinalNumero', { n });
}

/** Ocurrencias en total (esta incluida) y la primera y la última vez, para las cifras. */
function ocurrencias(el: Elemento | null, ctx: Contexto | undefined) {
  const todas = [...(ctx?.mismaHuella ?? []).map((o) => o.creado), ...(el ? [el.frontmatter.creado] : [])]
    .map((c) => Date.parse(c))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  return { n: Math.max(todas.length, 1), primera: todas[0], ultima: todas.at(-1) };
}

export const lectorError: Lector<DatosError> = {
  nombre: 'error',
  tipo: 'error',
  version: 1,
  textos,

  detectar: (e: Entrada) => {
    const texto = e.texto ?? '';
    if (!texto.trim()) return 0;
    if (analizarTraza(texto)) return 0.9;
    return ERROR_SUELTO.test(primera(texto)) ? 0.7 : 0;
  },

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const d = analizarError(texto);
    const titulo = d.mensaje ? `${d.tipo}: ${d.mensaje}` : d.tipo;
    return {
      titulo: titulo.length > LARGO_TITULO ? `${titulo.slice(0, LARGO_TITULO - 1)}…` : titulo,
      original: texto,
      resumen: { lenguaje: d.lenguaje, tipo: d.tipo, huella: d.huella, huellaVersion: d.version },
    };
  },

  async derivar(el: Elemento): Promise<DatosError> {
    return analizarError(el.original ?? '');
  },

  resumen: (d) => ({
    lenguaje: d.lenguaje,
    tipo: d.tipo,
    huella: d.huella,
    huellaVersion: d.version,
    propios: d.marcos.filter((m) => m.propio).length,
  }),

  resumenLegible(r, idioma) {
    const lenguaje = typeof r.lenguaje === 'string' ? r.lenguaje : 'desconocido';
    const nombre = (textos.t as (i: Idioma, c: string) => string)(idioma, `lenguajes.${lenguaje}`);
    return typeof r.tipo === 'string' ? `${nombre} · ${r.tipo}` : nombre;
  },

  respuesta(el, d, ctx) {
    const i = ctx.idioma;
    const previas = anteriores(el, ctx);
    if (previas.length) {
      const texto: Fragmento[] = [
        { t: 'texto', v: textos.t(i, 'respuesta.repetido', { ordinal: ordinal(previas.length + 1, i) }) },
      ];
      const nota = ctx.notas[0];
      const fecha = nota ? new Date(nota.fecha) : null;
      if (nota && fecha && !Number.isNaN(fecha.getTime())) {
        texto.push({ t: 'texto', v: textos.t(i, 'respuesta.nota', { fecha: fmtDia(fecha, new Date(), i) }) });
        texto.push({ t: 'cita', v: nota.texto, fecha: nota.fecha });
        texto.push({ t: 'texto', v: textos.t(i, 'respuesta.fin') });
      }
      return { texto };
    }
    const lenguaje = (textos.t as (x: Idioma, c: string) => string)(i, `lenguajes.${d.lenguaje}`);
    const propios = d.marcos.filter((m) => m.propio).length;
    return {
      texto: [
        {
          t: 'texto',
          v:
            textos.t(i, 'respuesta.nuevo', { lenguaje }) +
            (propios ? textos.t(i, 'respuesta.marcos', { n: propios }) : textos.t(i, 'respuesta.sinMarcos')),
        },
      ],
    };
  },

  // Las cifras dependen de las demás ocurrencias: reciben el contexto y el propio elemento.
  cifras: {
    ocurrencias: (_d, ctx, el) => {
      const { n } = ocurrencias(el ?? null, ctx);
      return { texto: String(n), valor: n };
    },
    primera_vez: (_d, ctx, el) => {
      const { primera: p } = ocurrencias(el ?? null, ctx);
      return { texto: p === undefined ? '—' : fmtDia(new Date(p), new Date(), ctx?.idioma ?? 'es') };
    },
    ultima_vez: (_d, ctx, el) => {
      const { ultima } = ocurrencias(el ?? null, ctx);
      return { texto: ultima === undefined ? '—' : fmtDia(new Date(ultima), new Date(), ctx?.idioma ?? 'es') };
    },
  },

  textoIndexable: (d) => [d.tipo, d.mensaje, ...d.marcos.filter((m) => m.propio).map((m) => m.funcion)].join('\n'),
};
