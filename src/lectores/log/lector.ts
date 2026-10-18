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

/** ¿Tiene esta línea pinta de log? Marca de tiempo, nivel, JSON con nivel o mensaje, o logfmt. */
function esLineaDeLog(linea: string, anio: number): boolean {
  const a = analizarLinea(linea, anio);
  if (a.formato === 'json' || a.formato === 'logfmt' || a.formato === 'apache') return true;
  return a.marca !== null || /^\s*\[?(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL)\]?[\s:]/.test(linea);
}

/** Confianza de que un texto es un log: al menos 3 líneas y el 60 % de ellas con pinta de log. */
export function confianzaLog(texto: string): number {
  const lineas = texto
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, MUESTRA_DETECCION);
  if (lineas.length < 3) return 0;
  const anio = new Date().getFullYear();
  const con = lineas.filter((l) => esLineaDeLog(l, anio)).length;
  return con / lineas.length >= 0.6 ? 0.85 : 0;
}

/** Errores y avisos del recuento por nivel. */
const errores = (d: Pick<DatosLog, 'niveles'>) => d.niveles.ERROR + d.niveles.FATAL;

/** «17:40:01» → «17:40». */
const hhmm = (pared: string | null) => (pared ? pared.slice(0, 5) : null);

/** Un error capturado durante la ventana de errores del log (si el log tiene fechas completas). */
function errorALaVez(d: DatosLog, ctx: Contexto, el: Elemento): string | null {
  const ventana =
    d.concentracion ??
    (d.primerError && d.ultimoError ? { desde: d.primerError.pared, hasta: d.ultimoError.pared } : null);
  if (!ventana?.desde || !ventana.hasta) return null;
  const captura = new Date(el.frontmatter.creado);
  for (const o of ctx.cercanos ?? []) {
    if (o.tipo !== 'error') continue;
    const cuando = new Date(o.creado);
    // Mismo día que la captura del log y dentro de su ventana de errores, por la hora de pared.
    if (cuando.toDateString() !== captura.toDateString()) continue;
    const hora = `${String(cuando.getHours()).padStart(2, '0')}:${String(cuando.getMinutes()).padStart(2, '0')}`;
    if (hora >= (ventana.desde ?? '').slice(0, 5) && hora <= (ventana.hasta ?? '').slice(0, 5)) return o.ref;
  }
  return null;
}

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
    const primeraError = lineas.find((l) => {
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

  async derivar(el: Elemento, opciones = {}): Promise<DatosLog> {
    const anio = new Date(el.frontmatter.creado).getFullYear();
    return analizar(el.original ?? '', {
      ...(opciones.alProgreso ? { alProgreso: opciones.alProgreso } : {}),
      ...(Number.isFinite(anio) ? { anio } : {}),
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

  respuesta(el, d, ctx) {
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
        ? textos.t(i, 'respuesta.conErrores', { lineas, errores: erroresTxt, desde, hasta })
        : textos.t(i, 'respuesta.conErroresSinHora', { lineas, errores: erroresTxt });
    const err = errorALaVez(d, ctx, el);
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
