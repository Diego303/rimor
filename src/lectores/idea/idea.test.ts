import { type FrontmatterComun, isoConZona } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../pruebas/falsos';
import { LARGO_IDEA, lectorIdea, pareceIdea } from './lector';
import { cuandoVuelve, descartar, diasDesde, posponer, vuelven } from './resurgir';

const DIA = 86_400_000;

function idea(creado: Date, cambios: Partial<FrontmatterComun> = {}): FrontmatterComun {
  const base = elementoFalso(1, 'Exportar minipapers con Typst', 'idea').frontmatter;
  return { ...base, tipo: 'idea', ref: 'IDE-0001', estado: 'semilla', creado: isoConZona(creado), ...cambios };
}

describe('lector Idea', () => {
  it('detecta textos cortos sin señales de otro tipo', () => {
    expect(pareceIdea('Exportar minipapers con Typst')).toBe(true);
    expect(pareceIdea('x'.repeat(LARGO_IDEA - 1))).toBe(true);
    expect(pareceIdea('x'.repeat(LARGO_IDEA))).toBe(false);
    for (const otro of [
      'Mira https://typst.app',
      '17:40 la caída',
      'ERROR al conectar',
      'const a = 1;',
      '$ pnpm build',
      '# Título',
      '- tarea',
      '38 ms y 40 ms',
      'una\ndos\ntres\ncuatro',
    ])
      expect(pareceIdea(otro), otro).toBe(false);
    expect(lectorIdea.detectar({ texto: 'Probar zstd' })).toBe(0.7);
    expect(lectorIdea.detectar({ texto: 'git status' })).toBe(0);
  });

  it('nace en semilla y responde según la ficha', async () => {
    const b = await lectorIdea.leer({ texto: 'Probar zstd en el índice\ncon cuidado' });
    expect(b).toMatchObject({ titulo: 'Probar zstd en el índice', metadatos: { estado: 'semilla' } });
    const el = elementoFalso(1, 'Probar zstd', 'idea');
    const d = await lectorIdea.derivar(el);
    const ctx = { mismaHuella: [], versiones: [], notas: [], colecciones: [] };
    expect(lectorIdea.respuesta(el, d, { ...ctx, idioma: 'es' }).texto).toEqual([
      { t: 'texto', v: 'Idea guardada. Volverá dentro de 7 días si no haces nada con ella.' },
    ]);
    expect(lectorIdea.respuesta(el, d, { ...ctx, idioma: 'en' }).texto[0]).toEqual({
      t: 'texto',
      v: 'Idea saved. It will come back in 7 days if you do nothing with it.',
    });
  });
});

describe('resurgimiento mínimo (reloj simulado)', () => {
  const dia0 = new Date(2026, 9, 1, 10);
  const el = (n: number) => new Date(dia0.getTime() + n * DIA);

  it('vuelve el día 7 y, pospuesta, el 37', () => {
    const fm = idea(dia0);
    expect(vuelven([fm], el(6))).toEqual([]);
    expect(vuelven([fm], el(7)).map((f) => f.ref)).toEqual(['IDE-0001']);
    expect(diasDesde(fm, el(7))).toBe(7);
    const pospuesta = posponer(fm, el(7));
    expect(vuelven([pospuesta], el(36))).toEqual([]);
    expect(vuelven([pospuesta], el(37)).map((f) => f.ref)).toEqual(['IDE-0001']);
    expect(cuandoVuelve(pospuesta)).toBe(el(37).getTime());
  });

  it('descartada, en otro estado o sin ser idea, nunca', () => {
    expect(vuelven([descartar(idea(dia0))], el(100))).toEqual([]);
    expect(descartar(posponer(idea(dia0), el(7))).vuelve).toBeUndefined();
    expect(vuelven([idea(dia0, { estado: 'explorando' })], el(100))).toEqual([]);
    expect(vuelven([idea(dia0, { tipo: 'texto' })], el(100))).toEqual([]);
  });
});
