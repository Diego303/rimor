/**
 * Lector Log (LEC-04, plan §8.1): marcas de tiempo, niveles, plantillas, pares `clave=valor`, primer y último
 * error e histograma. El análisis (`analisis.ts`) va por bloques de 50.000 líneas y avisa del progreso.
 */
import type { Elemento } from '@rimor/formato';
import { fmtDuracion, fmtNumero } from '../../i18n/formatos';
import type { Fragmento } from '../../respuestas/tipos';
import type { Borrador, Contexto, Entrada, Lector } from '../contrato';
import { analizar, analizarLinea, type DatosLog, sinMarcas } from './analisis';
import { textos } from './textos';

export type { DatosLog } from './analisis';

/** Líneas que se miran para detectar (las primeras con contenido). */
const MUESTRA_DETECCION = 200;
const LARGO_TITULO = 100;

/** Confianza de que un texto es un log: al menos 3 líneas y el 60 % de ellas con pinta de log. */
export function confianzaLog(texto: string): number {
  const lineas = texto
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, MUESTRA_DETECCION);
  if (lineas.length < 3) return 0;
  const anio = new Date().getFullYear();
  const con = lineas.filter((l) => analizarLinea(l, anio).pareceLog).length;
  return con / lineas.length >= 0.6 ? 0.85 : 0;
}

/** Errores y avisos del recuento por nivel. */
const errores = (d: Pick<DatosLog, 'niveles'>) => d.niveles.ERROR + d.niveles.FATAL;

/** «17:40:01» → «17:40». */
const hhmm = (pared: string | null) => (pared ? pared.slice(0, 5) : null);

/** Margen alrededor de la ventana de errores para «a la vez que»: el error se pudo pegar un poco después. */
const ANTES_MS = 5 * 60_000;
const DESPUES_MS = 30 * 60_000;

/**
 * Un error capturado mientras pasaban los errores del log. Solo si el log tiene fechas completas: se comparan
 * instantes (con su zona), no horas de pared ni días de captura.
 */
function errorALaVez(d: DatosLog, ctx: Contexto): string | null {
  if (!d.fechasCompletas) return null;
  const desde = d.concentracion?.desdeMs ?? d.primerError?.ms ?? null;
  const hasta = d.concentracion?.hastaMs ?? d.ultimoError?.ms ?? null;
  if (desde === null || hasta === null) return null;
  for (const o of ctx.cercanos ?? []) {
    if (o.tipo !== 'error') continue;
    const cuando = Date.parse(o.creado);
    if (cuando >= desde - ANTES_MS && cuando <= hasta + DESPUES_MS) return o.ref;
  }
  return null;
}

/** Hasta dónde se busca el primer error para el título (en el hilo principal, al capturar). */
const LINEAS_PARA_TITULO = 2000;

export const lectorLog: Lector<DatosLog> = {
  nombre: 'log',
  tipo: 'log',
  version: 1,
  textos,

  detectar: (e: Entrada) => (e.texto !== undefined ? confianzaLog(e.texto) : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = e.texto ?? '';
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim());
    // Título: la primera línea de error, o la primera, sin su marca de tiempo.
    const anio = new Date().getFullYear();
    const primeraError = lineas.slice(0, LINEAS_PARA_TITULO).find((l) => {
      const n = analizarLinea(l, anio).nivel;
      return n === 'ERROR' || n === 'FATAL';
    });
    const base = (primeraError ?? lineas[0] ?? '').trim();
    const sinMarca = sinMarcas(base)
      .replace(/^[\s\-|:,]+/, '')
      .trim();
    const titulo = (sinMarca || base).slice(0, LARGO_TITULO);
    return { titulo, original: texto, resumen: { lineas: lineas.length } };
  },

  // Avisa del progreso (logs de más de 50.000 líneas); solo los lectores que lo hacen reciben el aviso.
  informaProgreso: true,

  async derivar(el: Elemento, opciones = {}): Promise<DatosLog> {
    // Sin el texto (un adjunto que no se pudo cargar) no hay nada que analizar: nunca «0 líneas».
    if (el.original === null) throw new Error('log.sinOriginal');
    const referencia = new Date(el.frontmatter.creado);
    return analizar(el.original, {
      ...(opciones.alProgreso ? { alProgreso: opciones.alProgreso } : {}),
      ...(Number.isNaN(referencia.getTime()) ? {} : { referencia }),
    });
  },

  resumen: (d) => ({
    lineas: d.lineas,
    errores: errores(d),
    avisos: d.niveles.WARN,
    plantillas: d.plantillas.length,
    ...(d.desde ? { desde: d.desde } : {}),
    ...(d.hasta ? { hasta: d.hasta } : {}),
  }),

  resumenLegible(r, idioma) {
    const partes: string[] = [];
    if (typeof r.lineas === 'number') partes.push(textos.t(idioma, 'lineas', { n: r.lineas }));
    if (typeof r.errores === 'number' && r.errores > 0) partes.push(textos.t(idioma, 'errores', { n: r.errores }));
    return partes.join(' · ');
  },

  respuesta(_el, d, ctx) {
    const i = ctx.idioma;
    const lineas = textos.t(i, 'lineas', { n: d.lineas });
    const nErr = errores(d);
    if (!nErr) {
      const v = d.niveles.WARN
        ? textos.t(i, 'respuesta.sinErroresConAvisos', { lineas, avisos: textos.t(i, 'avisos', { n: d.niveles.WARN }) })
        : textos.t(i, 'respuesta.sinErrores', { lineas });
      return { texto: [{ t: 'texto', v }] };
    }
    const desde = hhmm(d.concentracion?.desde ?? d.primerError?.pared ?? null);
    const hasta = hhmm(d.concentracion?.hasta ?? d.ultimoError?.pared ?? null);
    const erroresTxt = textos.t(i, 'errores', { n: nErr });
    const inicio =
      desde && hasta
        ? desde === hasta
          ? textos.t(i, 'respuesta.conErroresUnaHora', { lineas, errores: erroresTxt, hora: desde })
          : textos.t(i, 'respuesta.conErrores', { lineas, errores: erroresTxt, desde, hasta })
        : textos.t(i, 'respuesta.conErroresSinHora', { lineas, errores: erroresTxt });
    const err = errorALaVez(d, ctx);
    if (!err) return { texto: [{ t: 'texto', v: `${inicio}${textos.t(i, 'respuesta.fin')}` }] };
    // Dos frases (IN-016): «Log de …, con … entre … y …, a la vez que ERR-0015. ¿Lo añado a su hilo?»
    const texto: Fragmento[] = [
      { t: 'texto', v: `${inicio}${textos.t(i, 'respuesta.aLaVez')}` },
      { t: 'ref', ref: err },
      { t: 'texto', v: `${textos.t(i, 'respuesta.fin')} ${textos.t(i, 'respuesta.hilo')}` },
    ];
    return {
      texto,
      acciones: [
        { id: `hilo:${err}`, etiqueta: textos.t(i, 'respuesta.siHilo'), principal: true },
        { id: 'no', etiqueta: textos.t(i, 'respuesta.no') },
      ],
    };
  },

  cifras: {
    lineas: (d) => ({ texto: fmtNumero(d.lineas, 'es'), valor: d.lineas }),
    errores: (d) => ({ texto: fmtNumero(errores(d), 'es'), valor: errores(d) }),
    avisos: (d) => ({ texto: fmtNumero(d.niveles.WARN, 'es'), valor: d.niveles.WARN }),
    duracion: (d) => ({
      texto: d.duracionMs === null ? '—' : fmtDuracion(d.duracionMs, 'es'),
      ...(d.duracionMs === null ? {} : { valor: d.duracionMs, unidad: 'ms' }),
    }),
    plantillas: (d) => ({ texto: fmtNumero(d.plantillas.length, 'es'), valor: d.plantillas.length }),
  },

  textoIndexable: (d) => d.plantillas.map((p) => p.plantilla).join('\n'),
};
