import { describe, expect, it, vi } from 'vitest';
import { apuntarReciente, type Entrada, leerRecientes, MAX_RECIENTES, ordenar, puntuar } from './entradas';

const entrada = (id: string, titulo: string, grupo: Entrada['grupo'] = 'accion', detalle?: string): Entrada => ({
  id,
  grupo,
  titulo,
  ejecutar: vi.fn(),
  ...(detalle ? { detalle } : {}),
});

function almacen(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
}

describe('puntuar', () => {
  it('empieza igual > empieza una palabra > contiene > letras en orden; sin acentos ni mayúsculas', () => {
    expect(puntuar('ir', 'Ir a Buscar')).toBe(4);
    expect(puntuar('busc', 'Ir a Buscar')).toBe(3);
    expect(puntuar('usca', 'Ir a Buscar')).toBe(2);
    expect(puntuar('iab', 'Ir a Buscar')).toBe(1);
    expect(puntuar('zz', 'Ir a Buscar')).toBe(0);
    expect(puntuar('papelera', 'Mover a la Papelera')).toBe(3);
    expect(puntuar('coleccion', 'Añadir a colección')).toBe(3);
    expect(puntuar('a', 'Mover')).toBe(0);
    expect(puntuar('', 'Mover')).toBe(1);
  });

  it('varias palabras casan si están todas, en cualquier orden', () => {
    expect(puntuar('buscar ir', 'Ir a Buscar')).toBe(1.5);
    expect(puntuar('ir a', 'Ir a Buscar')).toBe(4);
    expect(puntuar('ir nada', 'Ir a Buscar')).toBe(0);
  });

  it('con signos que serían especiales en una expresión regular', () => {
    expect(puntuar('(c)', 'texto (c) mío')).toBe(3);
    expect(puntuar('a.b', 'axb')).toBe(0);
  });
});

describe('ordenar', () => {
  const entradas = [
    entrada('accion:titulo', 'Editar el título'),
    entrada('accion:estado', 'Cambiar el estado'),
    entrada('accion:inicio', 'Ir a Inicio'),
    entrada('coleccion:gateway', 'gateway', 'coleccion'),
    entrada('coleccion:estadistica', 'estadística', 'coleccion'),
  ];
  const ids = (lista: { id: string }[]) => lista.map((e) => e.id);

  it('sin texto: las recientes en su orden y después el resto en el suyo', () => {
    const r = ordenar('', entradas, ['coleccion:gateway', 'no-existe', 'accion:inicio']);
    expect(ids(r)).toEqual([
      'coleccion:gateway',
      'accion:inicio',
      'accion:titulo',
      'accion:estado',
      'coleccion:estadistica',
    ]);
    expect(r.map((e) => e.reciente)).toEqual([true, true, false, false, false]);
  });

  it('con texto: lo que casa, por grupo y por lo bien que casa; a igualdad, lo reciente', () => {
    expect(ids(ordenar('esta', entradas, []))).toEqual(['accion:estado', 'coleccion:estadistica']);
    expect(ids(ordenar('el', entradas, []))).toEqual(['accion:titulo', 'accion:estado']);
    expect(ids(ordenar('el', entradas, ['accion:estado']))).toEqual(['accion:estado', 'accion:titulo']);
    expect(ordenar('zzz', entradas, [])).toEqual([]);
  });

  it('el detalle no cuenta («En esta pantalla» no casa con «pan»); la puntuación va con cada una', () => {
    const lista = [
      entrada('a', 'Fijar o soltar', 'accion', 'En esta pantalla'),
      entrada('b', 'Escribir en el compositor'),
    ];
    expect(ordenar('pan', lista, [])).toEqual([]);
    expect(ordenar('fij', lista, []).map((e) => e.puntuacion)).toEqual([4]);
    expect(ordenar('ecc', lista, []).map((e) => e.puntuacion)).toEqual([1]);
  });
});

describe('recientes', () => {
  it('la más reciente primero, sin repetir y como mucho cinco', () => {
    const a = almacen();
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'b']) apuntarReciente(id, a);
    expect(leerRecientes(a)).toEqual(['b', 'f', 'e', 'd', 'c']);
    expect(leerRecientes(a)).toHaveLength(MAX_RECIENTES);
  });

  it('un almacén ilegible, ajeno o que no deja escribir no rompe nada', () => {
    expect(leerRecientes(almacen({ 'rimor.paleta.recientes': '{' }))).toEqual([]);
    expect(leerRecientes(almacen({ 'rimor.paleta.recientes': '[1,"a"]' }))).toEqual(['a']);
    expect(leerRecientes(null)).toEqual([]);
    const lleno = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(apuntarReciente('a', lleno)).toEqual(['a']);
  });
});
