import type { FrontmatterComun } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import {
  buscarEnMemoria,
  claveDia,
  diasConMensajes,
  diasIniciales,
  etiquetaDia,
  filasDelFeed,
  type OpcionesFeed,
  RESULTADOS_EN_FEED,
} from './filas';

const textos = { hoy: 'Hoy', ayer: 'Ayer' };
const ahora = new Date(2026, 9, 18, 15, 0, 0);

/** Un elemento creado a una hora local (año, mes 0-11, día, hora). */
function fm(i: number, dia: number, hora: number, cambios: Partial<FrontmatterComun> = {}): FrontmatterComun {
  const base = elementoFalso(i).frontmatter;
  const creado = new Date(2026, 9, dia, hora, 0, 0).toISOString();
  return { ...base, creado, ...cambios };
}

const opciones = (o: Partial<OpcionesFeed> = {}): OpcionesFeed => ({
  filtro: 'todo',
  dias: 30,
  ahora,
  idioma: 'es',
  textos,
  ...o,
});

describe('días', () => {
  it('el día es el civil de la zona del equipo; «Hoy», «Ayer» o la fecha', () => {
    expect(claveDia(new Date(2026, 9, 18, 0, 30))).toBe('2026-10-18');
    expect(claveDia(new Date(2026, 9, 17, 23, 59))).toBe('2026-10-17');
    expect(etiquetaDia('2026-10-18', ahora, 'es', textos)).toBe('Hoy');
    expect(etiquetaDia('2026-10-17', ahora, 'es', textos)).toBe('Ayer');
    expect(etiquetaDia('2026-10-15', ahora, 'es', textos)).toBe('15 oct');
    expect(etiquetaDia('2025-10-15', ahora, 'es', textos)).toBe('15 oct 2025');
  });
});

describe('filasDelFeed', () => {
  const elementos = [fm(1, 18, 9), fm(2, 17, 18), fm(3, 18, 8), fm(4, 15, 10), fm(5, 18, 12, { estado: 'archivado' })];

  it('por días, en orden cronológico (lo más reciente abajo); sin archivados', () => {
    const filas = filasDelFeed(elementos, opciones());
    expect(filas.map((f) => (f.t === 'dia' ? f.etiqueta : f.t === 'mensaje' ? f.fm.ref : f.t))).toEqual([
      '15 oct',
      'TXT-0004',
      'Ayer',
      'TXT-0002',
      'Hoy',
      'TXT-0003',
      'TXT-0001',
    ]);
  });

  it('«Sin clasificar»: sin colección, hilo ni investigación, y no archivado', () => {
    const conColeccion = [...elementos, fm(6, 18, 13, { colecciones: ['gateway'] })];
    const refs = filasDelFeed(conColeccion, opciones({ filtro: 'sinClasificar' })).flatMap((f) =>
      f.t === 'mensaje' ? [f.fm.ref] : [],
    );
    expect(refs).toEqual(['TXT-0004', 'TXT-0002', 'TXT-0003', 'TXT-0001']);
  });

  it('las búsquedas y las ideas que vuelven, en «Hoy»', () => {
    const busqueda = { texto: 'timeout', en: new Date(2026, 9, 18, 8, 30).toISOString() };
    const filas = filasDelFeed(elementos, opciones({ busquedas: [busqueda], conIdeas: true }));
    const hoy = filas.slice(filas.findIndex((f) => f.t === 'dia' && f.etiqueta === 'Hoy') + 1);
    expect(hoy.map((f) => (f.t === 'mensaje' ? f.fm.ref : f.t))).toEqual(['ideas', 'TXT-0003', 'busqueda', 'TXT-0001']);
    // Las ideas solo en «Todo».
    expect(
      filasDelFeed(elementos, opciones({ conIdeas: true, filtro: 'sinClasificar' })).some((f) => f.t === 'ideas'),
    ).toBe(false);
  });

  it('una regla propuesta, en su momento (IN-049)', () => {
    const elementos = [fm(1, 18, 10), fm(2, 18, 14)];
    const propuesta = { firma: '[app]', tipo: 'log' as const, en: new Date(2026, 9, 18, 12, 0, 0).toISOString() };
    const filas = filasDelFeed(elementos, opciones({ propuestas: [propuesta] }));
    expect(filas.map((f) => f.clave)).toEqual([
      'dia:2026-10-18',
      elementos[0]?.id,
      'propuesta:log:[app]',
      elementos[1]?.id,
    ]);
  });

  it('una búsqueda o las ideas de hoy no le quitan el sitio al día más antiguo cargado', () => {
    const ocho = Array.from({ length: 8 }, (_, i) => fm(i + 1, 10 + i, 9));
    const busqueda = { texto: 'x', en: new Date(2026, 9, 18, 8, 0).toISOString() };
    for (const extra of [{ busquedas: [busqueda] }, { conIdeas: true }]) {
      const refs = filasDelFeed(ocho, opciones({ dias: 8, ...extra })).flatMap((f) =>
        f.t === 'mensaje' ? [f.fm.ref] : [],
      );
      expect(refs).toContain('TXT-0001');
      expect(refs).toHaveLength(8);
    }
  });

  it('solo los días cargados, empezando por el más reciente', () => {
    const filas = filasDelFeed(elementos, opciones({ dias: 2 }));
    expect(filas.filter((f) => f.t === 'dia').map((f) => (f.t === 'dia' ? f.etiqueta : ''))).toEqual(['Ayer', 'Hoy']);
  });

  it('primera carga: 7 días y al menos 50 mensajes', () => {
    expect(diasIniciales([{ n: 3 }, { n: 2 }])).toBe(2);
    expect(diasIniciales(Array.from({ length: 20 }, () => ({ n: 20 })))).toBe(7);
    expect(diasIniciales(Array.from({ length: 20 }, () => ({ n: 5 })))).toBe(10);
    expect(diasConMensajes(elementos, 'todo').map((d) => [d.clave, d.n])).toEqual([
      ['2026-10-18', 2],
      ['2026-10-17', 1],
      ['2026-10-15', 1],
    ]);
  });

  it('5.000 elementos: las filas se preparan en menos de 50 ms', () => {
    const muchos = Array.from({ length: 5000 }, (_, i) => fm(i + 10, 1 + (i % 18), i % 24));
    // El mejor de tres intentos (la batería completa corre en paralelo y mete ruido en el reloj), con el umbral de
    // la ficha: sin tareas de más de 50 ms.
    let mejor = Number.POSITIVE_INFINITY;
    let filas: ReturnType<typeof filasDelFeed> = [];
    for (let intento = 0; intento < 3; intento++) {
      const inicio = performance.now();
      const dias = diasConMensajes(muchos, 'todo');
      filas = filasDelFeed(muchos, opciones({ dias: diasIniciales(dias) }));
      mejor = Math.min(mejor, performance.now() - inicio);
    }
    expect(mejor).toBeLessThan(50);
    expect(filas.length).toBeGreaterThan(50);
  });
});

describe('buscarEnMemoria', () => {
  const elementos = [
    fm(1, 18, 9, { titulo: 'Timeout en el stream del gateway' }),
    fm(2, 17, 9, { titulo: 'Notas', colecciones: ['gateway'] }),
    fm(3, 16, 9, { titulo: 'Canción de cuna' }),
    fm(4, 15, 9, { titulo: 'Otra cosa', etiquetas: ['timeout'] }),
  ];

  it('todas las palabras, sin acentos ni mayúsculas; primero lo que lo tiene en el título', () => {
    expect(buscarEnMemoria(elementos, 'TIMEOUT').resultados.map((f) => f.ref)).toEqual(['TXT-0001', 'TXT-0004']);
    expect(buscarEnMemoria(elementos, 'gateway').resultados.map((f) => f.ref)).toEqual(['TXT-0001', 'TXT-0002']);
    expect(buscarEnMemoria(elementos, 'cancion').total).toBe(1);
    expect(buscarEnMemoria(elementos, 'gateway stream').total).toBe(1);
    expect(buscarEnMemoria(elementos, '  ').total).toBe(0);
  });

  it('el resumen legible del lector también cuenta; como mucho 5 resultados', () => {
    expect(
      buscarEnMemoria(elementos, 'mediana', (f) => (f.ref === 'TXT-0003' ? '20 mediciones · mediana 38 ms' : '')).total,
    ).toBe(1);
    const muchos = Array.from({ length: 12 }, (_, i) => fm(i + 10, 1 + i, 9, { titulo: 'log del gateway' }));
    const r = buscarEnMemoria(muchos, 'gateway');
    expect(r.total).toBe(12);
    expect(r.resultados).toHaveLength(RESULTADOS_EN_FEED);
    expect(r.resultados[0]?.creado).toBe(muchos[11]?.creado);
  });
});
