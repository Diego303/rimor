/**
 * Lector Enlace básico (LEC-03): una URL o un DOI, normalizados (sin seguimiento) y clasificados por destino,
 * sin red (D7). La huella es la URL normalizada: así Rimor recuerda si ya se guardó («Ya lo guardaste el …»).
 */
import type { Elemento } from '@rimor/formato';
import { esEnlaceCompleto } from '../../captura/detector';
import { fmtDia } from '../../i18n/formatos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { textos } from './textos';
import { type ClaseEnlace, clasificar, type Destino, normalizar, rutaLegible, tituloDe } from './urls';

export interface DatosEnlace extends Destino {
  url: string;
}

/** Lo que se sabe de un texto que es una URL o un DOI, o `null` si no lo es. */
export function analizar(texto: string): DatosEnlace | null {
  const url = normalizar(texto);
  return url ? { url, ...clasificar(url) } : null;
}

export const lectorEnlace: Lector<DatosEnlace> = {
  nombre: 'enlace',
  tipo: 'enlace',
  version: 1,
  textos,

  // Llega por el atajo del detector (el texto entero es una URL o un DOI); sin él, también puntúa.
  detectar: (e: Entrada) => (e.texto !== undefined && !e.archivos?.length && esEnlaceCompleto(e.texto) ? 0.95 : 0),

  async leer(e: Entrada): Promise<Borrador> {
    const texto = (e.texto ?? '').trim();
    const d = analizar(texto);
    if (!d) return { titulo: texto.slice(0, 120), original: e.texto ?? '' };
    return {
      titulo: tituloDe(d.url, d),
      original: e.texto ?? '',
      metadatos: { url: d.url },
      resumen: { url: d.url, clase: d.clase, sitio: d.sitio, huella: d.url },
    };
  },

  async derivar(el: Elemento): Promise<DatosEnlace> {
    const d = analizar(el.original ?? '');
    if (d) return d;
    // Sin una URL que entender (forzado con `/enlace`): se guarda tal cual, como «otro».
    return { url: '', clase: 'otro', sitio: '' };
  },

  resumen: (d) => ({ url: d.url, clase: d.clase, sitio: d.sitio, ...(d.url ? { huella: d.url } : {}) }),

  resumenLegible: (r, idioma) => {
    const clase = typeof r.clase === 'string' ? (r.clase as ClaseEnlace) : 'otro';
    const sitio = typeof r.sitio === 'string' ? r.sitio : '';
    return [sitio, textos.t(idioma, `clases.${clase}`)].filter(Boolean).join(' · ');
  },

  respuesta(_el, d, ctx) {
    const t = textos.t.bind(textos);
    // El número de issue va tal cual («#57465»), no como cantidad («57.465»).
    const vars = { nombre: d.nombre ?? '', sitio: d.sitio, numero: String(d.numero ?? '') };
    const clave =
      (d.clase === 'paper' || d.clase === 'documentacion') && !d.nombre ? (`${d.clase}SinNombre` as const) : d.clase;
    const frase = d.sitio ? t(ctx.idioma, `respuesta.${clave}`, vars) : t(ctx.idioma, 'clases.otro');
    // Si ya se guardó la misma dirección (misma huella), se dice cuándo: la vez más antigua.
    const antes = ctx.mismaHuella.at(-1);
    const fecha = antes ? new Date(antes.creado) : null;
    const recuerdo =
      fecha && !Number.isNaN(fecha.getTime())
        ? ` ${t(ctx.idioma, 'yaGuardado', { fecha: fmtDia(fecha, new Date(), ctx.idioma) })}`
        : '';
    return { texto: [{ t: 'texto', v: `${frase}${recuerdo}` }] };
  },

  textoIndexable: (d) => (d.url ? `${d.url} ${rutaLegible(d.url)}` : ''),
};
