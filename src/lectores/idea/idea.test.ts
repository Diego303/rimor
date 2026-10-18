import { type FrontmatterComun, isoConZona } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../pruebas/falsos';
import { LARGO_IDEA, lectorIdea, pareceIdea } from './lector';
import { cuandoVuelve, descartar, diasDesde, posponer, proximaVuelta, vuelven } from './resurgir';

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
      '17:40:01 la caída',
      'TypeError: undefined is not a function',
      'Error: connection refused',
      'panic: runtime error: index out of range',
      'SELECT * FROM users WHERE id = 1',
      'console.log(x)',
      'x = 1 + 2',
      'PORT=8080',
      'rm -rf node_modules',
      'echo $PATH',
      'ssh-keygen -t ed25519',
      'ERROR al conectar',
      'const a = 1;',
      '$ pnpm build',
      '# Título',
      '- tarea',
      '38 ms y 40 ms',
      'una\ndos\ntres\ncuatro',
    ])
      expect(pareceIdea(otro), otro).toBe(false);
    for (const idea of [
      'Maybe let users pin their favourite collections',
      'Make import from Notion faster',
      'A new class of alerts for slow queries',
      'Measure the return rate of the newsletter',
      'Write a function to merge duplicates',
      'Revisar el stack trace del arranque',
      'Pasar el modo DEBUG a un ajuste',
      'Reunión con Marta a las 10:30',
    ])
      expect(pareceIdea(idea), idea).toBe(true);
    expect(lectorIdea.detectar({ texto: 'Probar zstd' })).toBe(0.7);
    // Un archivo soltado nunca es una idea.
    expect(lectorIdea.detectar({ texto: 'name: rimor', archivos: [new File(['name: rimor'], 'config.yaml')] })).toBe(0);
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
  it('cuenta días de calendario: vuelve al empezar el día 7, aunque haya cambio de hora', () => {
    // Guardada a las 20:00: la mañana del día 7 ya ha vuelto.
    const tarde = new Date(2026, 9, 1, 20);
    const manana7 = new Date(2026, 9, 8, 8);
    expect(vuelven([idea(tarde)], manana7)).toHaveLength(1);
    expect(vuelven([idea(tarde)], new Date(2026, 9, 7, 23, 59))).toHaveLength(0);
    // Con el cambio de hora de octubre por medio (en Europa), sigue siendo el día 7 del calendario.
    const madrugada = new Date(2026, 9, 20, 0, 30);
    expect(vuelven([idea(madrugada)], new Date(2026, 9, 26, 23, 30))).toHaveLength(0);
    expect(vuelven([idea(madrugada)], new Date(2026, 9, 27, 0, 0))).toHaveLength(1);
    expect(diasDesde(idea(madrugada), new Date(2026, 9, 27, 0, 0))).toBe(7);
  });

  it('pospuesta y vuelta a semilla, sigue esperando a su fecha; sin estado, cuenta como semilla', () => {
    const fm = posponer(idea(new Date(2026, 9, 1, 10)), new Date(2026, 9, 8, 10));
    const otraVez = { ...fm, estado: 'semilla' };
    expect(vuelven([otraVez], new Date(2026, 9, 11))).toHaveLength(0);
    const { estado: _e, ...sinEstado } = idea(new Date(2026, 9, 1, 10));
    expect(vuelven([sinEstado as FrontmatterComun], new Date(2026, 9, 9))).toHaveLength(1);
    expect(proximaVuelta([fm], new Date(2026, 9, 9))).toBe(new Date(2026, 10, 7).getTime());
  });

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
    // Al empezar el día 37 (de calendario).
    expect(cuandoVuelve(pospuesta)).toBe(new Date(2026, 9, 38).getTime());
  });

  it('descartada, en otro estado o sin ser idea, nunca', () => {
    expect(vuelven([descartar(idea(dia0), el(7))], el(100))).toEqual([]);
    expect(descartar(posponer(idea(dia0), el(7)), el(8)).vuelve).toBeUndefined();
    expect(vuelven([idea(dia0, { estado: 'explorando' })], el(100))).toEqual([]);
    expect(vuelven([idea(dia0, { tipo: 'texto' })], el(100))).toEqual([]);
  });
});
