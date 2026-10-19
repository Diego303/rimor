import { describe, expect, it } from 'vitest';
import type { Contexto, Lector } from '../lectores/contrato';
import { elementoFalso, lectorFalso } from '../lectores/pruebas/falsos';
import { componer } from './componer';
import { comprobarEstilo } from './reglas';

const ctx = (colecciones: string[]): Contexto => ({
  idioma: 'es',
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones,
});

describe('sugerencia de colección en la respuesta', () => {
  it('si el lector no propone nada, se propone la candidata, con sus dos acciones y en regla', () => {
    const r = componer(elementoFalso(1), lectorFalso() as unknown as Lector, { largo: 1 }, ctx(['gateway']));
    expect(r.texto.map((f) => ('v' in f ? f.v : '')).join('')).toBe('Falso. ¿Lo añado a la colección gateway?');
    expect(r.acciones?.map((a) => [a?.id, a?.etiqueta])).toEqual([
      ['coleccion:gateway', 'Sí, a gateway'],
      ['no', 'No'],
    ]);
    expect(comprobarEstilo(r)).toEqual([]);
  });

  it('no si ya está en una colección, si no hay candidata, si el lector propone algo o si pasaría de dos frases', () => {
    const conColeccion = elementoFalso(1);
    conColeccion.frontmatter.colecciones = ['otra'];
    const sinAcciones = (r: ReturnType<typeof componer>) => r.acciones === undefined;
    expect(sinAcciones(componer(conColeccion, lectorFalso() as unknown as Lector, {}, ctx(['gateway'])))).toBe(true);
    expect(sinAcciones(componer(elementoFalso(1), lectorFalso() as unknown as Lector, {}, ctx([])))).toBe(true);
    const propone = lectorFalso({
      respuesta: () => ({ texto: [{ t: 'texto', v: 'Algo.' }], acciones: [{ id: 'hilo:ERR-0001', etiqueta: 'Sí' }] }),
    });
    expect(componer(elementoFalso(1), propone as unknown as Lector, {}, ctx(['gateway'])).acciones?.[0]?.id).toBe(
      'hilo:ERR-0001',
    );
    const dosFrases = lectorFalso({ respuesta: () => ({ texto: [{ t: 'texto', v: 'Una frase. Otra frase.' }] }) });
    expect(sinAcciones(componer(elementoFalso(1), dosFrases as unknown as Lector, {}, ctx(['gateway'])))).toBe(true);
  });
});
