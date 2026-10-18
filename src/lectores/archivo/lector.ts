/**
 * Lector genérico de archivo (LEC-01): cualquier binario que ningún lector sabe leer se guarda como adjunto por
 * su hash, con nombre, tamaño y tipo, y queda marcado para releerlo cuando llegue su lector.
 */
import type { Elemento } from '@rimor/formato';
import { fmtBytes } from '../../i18n/formatos';
import type { Borrador, Entrada, Lector } from '../contrato';
import { textos } from './textos';

export interface DatosArchivo {
  nombre: string;
  tam: number;
  mime: string;
}

/** Clave del frontmatter que marca un elemento para reprocesarlo cuando haya un lector de su tipo. */
export const MARCA_PENDIENTE = 'pendiente_lector';

export const lectorArchivo: Lector<DatosArchivo> = {
  nombre: 'archivo',
  tipo: 'archivo',
  version: 1,
  textos,

  // Llega por el atajo de binarios del detector, nunca por puntuación.
  detectar: () => 0,

  async leer(e: Entrada): Promise<Borrador> {
    const archivo = e.archivos?.[0];
    const nombre = e.nombre ?? archivo?.name ?? '';
    return {
      titulo: nombre,
      // El original va como adjunto por su hash: lo guarda la captura con los bytes tal cual.
      original: null,
      resumen: { nombre, tam: archivo?.size ?? 0, mime: e.mime ?? archivo?.type ?? '' },
      metadatos: { [MARCA_PENDIENTE]: true },
    };
  },

  async derivar(el: Elemento): Promise<DatosArchivo> {
    const a = el.frontmatter.adjunto;
    return { nombre: a?.nombre ?? el.frontmatter.titulo, tam: a?.tam ?? 0, mime: a?.mime ?? '' };
  },

  resumen: (d) => ({ nombre: d.nombre, tam: d.tam, mime: d.mime }),

  resumenLegible(r, idioma) {
    const tam = typeof r.tam === 'number' ? fmtBytes(r.tam, idioma) : '';
    const mime = typeof r.mime === 'string' && r.mime ? r.mime : textos.t(idioma, 'sinTipo');
    return tam ? `${tam} · ${mime}` : mime;
  },

  respuesta: (_el, d, ctx) => ({
    texto: [{ t: 'texto', v: textos.t(ctx.idioma, 'guardado', { tam: fmtBytes(d.tam, ctx.idioma) }) }],
  }),

  cifras: { tam: (d) => ({ texto: String(d.tam), valor: d.tam, unidad: 'B' }) },

  textoIndexable: (d) => `${d.nombre} ${d.mime}`,
};
