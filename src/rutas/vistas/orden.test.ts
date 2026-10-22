import type { FrontmatterComun, TipoElemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { agruparMosaico, type NombresDensa, ORDEN_INICIAL, ordenarDensa, siguienteOrden, vistaDe } from './orden';

function fm(n: number, cambios: Partial<FrontmatterComun> = {}): FrontmatterComun {
  return {
    ...elementoFalso(n).frontmatter,
    creado: `2026-10-${String(10 + n).padStart(2, '0')}T10:00:00+02:00`,
    ...cambios,
  };
}

const NOMBRES: NombresDensa = {
  tipo: (f) => ({ log: 'Log', error: 'Error', texto: 'Texto' })[f.tipo as 'log'] ?? f.tipo,
  estado: (f) => f.estado ?? 'nuevo',
  idioma: 'es',
};

const refs = (lista: FrontmatterComun[]) => lista.map((f) => f.ref);

describe('vistas', () => {
  it('la vista de la dirección, o la lista', () => {
    expect(vistaDe('mosaico')).toBe('mosaico');
    expect(vistaDe('densa')).toBe('densa');
    expect(vistaDe('otra')).toBe('lista');
    expect(vistaDe(undefined)).toBe('lista');
  });

  it('pulsar una cabecera: la misma cambia de sentido; otra empieza por el suyo', () => {
    expect(siguienteOrden(ORDEN_INICIAL, 'fecha')).toEqual({ columna: 'fecha', sentido: 'asc' });
    expect(siguienteOrden(ORDEN_INICIAL, 'titulo')).toEqual({ columna: 'titulo', sentido: 'asc' });
    expect(siguienteOrden({ columna: 'titulo', sentido: 'asc' }, 'titulo')).toEqual({
      columna: 'titulo',
      sentido: 'desc',
    });
    expect(siguienteOrden({ columna: 'titulo', sentido: 'asc' }, 'fecha')).toEqual(ORDEN_INICIAL);
  });
});

describe('ordenarDensa', () => {
  const lista = [
    fm(1, { titulo: 'Árbol', tipo: 'log' as TipoElemento, colecciones: ['gateway'], estado: 'resuelto' }),
    fm(2, { titulo: 'zeta v10', tipo: 'error' as TipoElemento }),
    fm(3, { titulo: 'zeta v2', tipo: 'texto' as TipoElemento, colecciones: ['api', 'gateway'] }),
  ];

  it('por fecha (lo reciente arriba por defecto) y al revés', () => {
    expect(refs(ordenarDensa(lista, ORDEN_INICIAL, NOMBRES))).toEqual(['TXT-0003', 'TXT-0002', 'TXT-0001']);
    expect(refs(ordenarDensa(lista, { columna: 'fecha', sentido: 'asc' }, NOMBRES))).toEqual([
      'TXT-0001',
      'TXT-0002',
      'TXT-0003',
    ]);
  });

  it('por título sin acentos y con los números como números', () => {
    expect(refs(ordenarDensa(lista, { columna: 'titulo', sentido: 'asc' }, NOMBRES))).toEqual([
      'TXT-0001',
      'TXT-0003',
      'TXT-0002',
    ]);
    expect(refs(ordenarDensa(lista, { columna: 'titulo', sentido: 'desc' }, NOMBRES))).toEqual([
      'TXT-0002',
      'TXT-0003',
      'TXT-0001',
    ]);
  });

  it('por tipo y estado según su nombre; sin colecciones, al final en los dos sentidos', () => {
    expect(refs(ordenarDensa(lista, { columna: 'tipo', sentido: 'asc' }, NOMBRES))).toEqual([
      'TXT-0002',
      'TXT-0001',
      'TXT-0003',
    ]);
    expect(refs(ordenarDensa(lista, { columna: 'estado', sentido: 'asc' }, NOMBRES))).toEqual([
      'TXT-0003',
      'TXT-0002',
      'TXT-0001',
    ]);
    expect(refs(ordenarDensa(lista, { columna: 'colecciones', sentido: 'asc' }, NOMBRES))).toEqual([
      'TXT-0003',
      'TXT-0001',
      'TXT-0002',
    ]);
    expect(refs(ordenarDensa(lista, { columna: 'colecciones', sentido: 'desc' }, NOMBRES))).toEqual([
      'TXT-0001',
      'TXT-0003',
      'TXT-0002',
    ]);
  });
});

describe('ordenarDensa con fechas que no se entienden', () => {
  it('van al final en los dos sentidos', () => {
    const lista = [fm(1), fm(2, { creado: 'nunca' }), fm(3)];
    expect(refs(ordenarDensa(lista, { columna: 'fecha', sentido: 'asc' }, NOMBRES))).toEqual([
      'TXT-0001',
      'TXT-0003',
      'TXT-0002',
    ]);
    expect(refs(ordenarDensa(lista, ORDEN_INICIAL, NOMBRES))).toEqual(['TXT-0003', 'TXT-0001', 'TXT-0002']);
  });
});

describe('agruparMosaico', () => {
  const lista = [
    fm(1, { tipo: 'log' as TipoElemento }),
    fm(2, { tipo: 'error' as TipoElemento }),
    fm(3, { tipo: 'log' as TipoElemento }),
    fm(4, { tipo: 'error' as TipoElemento, creado: '2026-10-13T18:00:00+02:00' }),
  ];
  const dia = (f: FrontmatterComun) => f.creado.slice(0, 10);

  it('por tipo, en el orden de su elemento más reciente, y dentro de lo reciente a lo antiguo', () => {
    expect(agruparMosaico(lista, 'tipo', dia).map(([k, g]) => [k, refs(g)])).toEqual([
      ['error', ['TXT-0004', 'TXT-0002']],
      ['log', ['TXT-0003', 'TXT-0001']],
    ]);
  });

  it('por día', () => {
    expect(agruparMosaico(lista, 'fecha', dia).map(([k, g]) => [k, refs(g)])).toEqual([
      ['2026-10-13', ['TXT-0004', 'TXT-0003']],
      ['2026-10-12', ['TXT-0002']],
      ['2026-10-11', ['TXT-0001']],
    ]);
  });
});
