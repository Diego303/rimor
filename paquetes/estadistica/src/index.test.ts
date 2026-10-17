import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ordenados } from './index';

describe('ordenados', () => {
  it('ordena sin tocar la entrada', () => {
    const v = [3, 1, 2];
    expect(ordenados(v)).toEqual([1, 2, 3]);
    expect(v).toEqual([3, 1, 2]);
  });

  it('devuelve una permutación no decreciente', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ noNaN: true })), (v) => {
        const o = ordenados(v);
        expect(o).toHaveLength(v.length);
        for (let i = 1; i < o.length; i++) expect(o[i - 1] as number).toBeLessThanOrEqual(o[i] as number);
      }),
    );
  });
});
