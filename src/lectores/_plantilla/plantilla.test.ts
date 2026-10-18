import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Elemento, hashOriginal } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { lectorPlantilla } from './lector';

const ejemplo = readFileSync(join(process.cwd(), 'src/lectores/_plantilla/fixtures/ejemplo.txt'), 'utf8');

describe('lector plantilla', () => {
  it('lee el título de la primera línea y guarda el original', async () => {
    const b = await lectorPlantilla.leer({ texto: ejemplo });
    expect(b).toMatchObject({ titulo: 'Primera línea del ejemplo', original: ejemplo });
  });

  it('deriva líneas y palabras, con su resumen y su respuesta en los dos idiomas', async () => {
    const el: Elemento = {
      frontmatter: {
        id: '01JAB4C2Q2X8M5N7P0R0000001',
        ref: 'TXT-0001',
        tipo: 'texto',
        titulo: 'Ejemplo',
        creado: '2026-10-18T10:00:00+02:00',
        modificado: '2026-10-18T10:00:00+02:00',
        origen: 'pegado',
        hash: hashOriginal(ejemplo),
        ocultados: 0,
        lector: { nombre: 'plantilla', version: 1, resumen: {} },
      },
      notas: '',
      original: ejemplo,
    };
    const d = await lectorPlantilla.derivar(el);
    expect(d).toMatchObject({ lineas: 3, palabras: 10 });
    expect(lectorPlantilla.resumen(d)).toEqual({ lineas: 3, palabras: 10 });
    expect(lectorPlantilla.resumenLegible?.({ lineas: 1 }, 'es')).toBe('1 línea');
    const ctx = { mismaHuella: [], versiones: [], notas: [], colecciones: [] };
    expect(lectorPlantilla.respuesta(el, d, { ...ctx, idioma: 'es' }).texto).toEqual([
      { t: 'texto', v: 'Texto de 3 líneas y 10 palabras.' },
    ]);
    expect(lectorPlantilla.respuesta(el, d, { ...ctx, idioma: 'en' }).texto[0]).toEqual({
      t: 'texto',
      v: 'Text with 3 lines and 10 words.',
    });
    // Lo derivado se puede copiar al hilo principal.
    expect(structuredClone(d)).toEqual(d);
  });
});
