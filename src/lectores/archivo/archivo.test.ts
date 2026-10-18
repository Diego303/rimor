import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../pruebas/falsos';
import { lectorArchivo, MARCA_PENDIENTE } from './lector';

describe('lector genérico de archivo', () => {
  it('lee con su nombre, como adjunto y marcado como pendiente de lector', async () => {
    const archivo = new File([new Uint8Array(2_500_000)], 'datos.parquet', { type: '' });
    const b = await lectorArchivo.leer({ archivos: [archivo], nombre: 'datos.parquet' });
    expect(b).toEqual({
      titulo: 'datos.parquet',
      original: null,
      resumen: { nombre: 'datos.parquet', tam: 2_500_000, mime: '' },
      metadatos: { [MARCA_PENDIENTE]: true },
    });
  });

  it('deriva del adjunto y responde con el tamaño formateado', async () => {
    const base = elementoFalso(1, '', 'archivo');
    const el = {
      ...base,
      original: null,
      frontmatter: {
        ...base.frontmatter,
        tipo: 'archivo' as const,
        adjunto: {
          hash: 'a'.repeat(64),
          ruta: 'adjuntos/aa/x.zip',
          nombre: 'x.zip',
          mime: 'application/zip',
          tam: 2_516_582,
        },
      },
    };
    const d = await lectorArchivo.derivar(el);
    expect(d).toEqual({ nombre: 'x.zip', tam: 2_516_582, mime: 'application/zip' });
    const ctx = { mismaHuella: [], versiones: [], notas: [], colecciones: [] };
    expect(lectorArchivo.respuesta(el, d, { ...ctx, idioma: 'es' }).texto[0]).toEqual({
      t: 'texto',
      v: 'Archivo de 2,4 MB guardado. Rimor aún no sabe leer este tipo.',
    });
    expect(lectorArchivo.resumenLegible?.(lectorArchivo.resumen(d), 'es')).toBe('2,4 MB · application/zip');
    expect(lectorArchivo.resumenLegible?.({ tam: 10, mime: '' }, 'en')).toBe('10 B · unknown type');
  });
});
