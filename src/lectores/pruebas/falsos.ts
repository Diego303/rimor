/** Lectores y elementos falsos para las pruebas de los lectores (IN-012). */
import { type Elemento, hashOriginal, type TipoElemento } from '@rimor/formato';
import type { Lector } from '../contrato';
import { definirTextos } from '../textos';

export const textosFalsos = definirTextos({ analizando: 'Calculando lo falso' }, { analizando: 'Computing the fake' });

/** Lector que deriva la longitud del original y cuenta cuántas veces deriva. */
export function lectorFalso(
  cambios: Partial<Lector<{ largo: number }>> = {},
): Lector<{ largo: number }> & { derivados: number } {
  const lector = {
    nombre: 'falso',
    tipo: 'texto' as TipoElemento,
    version: 1,
    textos: textosFalsos,
    derivados: 0,
    detectar: () => 0.5,
    leer: async (e: { texto?: string }) => ({ titulo: 'Falso', original: e.texto ?? '' }),
    async derivar(el: Elemento) {
      lector.derivados++;
      return { largo: (el.original ?? '').length };
    },
    resumen: (d: { largo: number }) => ({ largo: d.largo }),
    resumenLegible: (r: Record<string, unknown>) => `largo ${String(r.largo ?? '?')}`,
    respuesta: () => ({ texto: [{ t: 'texto' as const, v: 'Falso.' }] }),
    ...cambios,
  };
  return lector;
}

export function elementoFalso(i: number, original = `original ${i}`, nombre = 'falso'): Elemento {
  return {
    frontmatter: {
      id: `01JAB4C2Q2X8M5N7P0R${String(i).padStart(7, '0')}`,
      ref: `TXT-${String(i).padStart(4, '0')}`,
      tipo: 'texto',
      titulo: `Elemento ${i}`,
      creado: '2026-10-18T10:00:00+02:00',
      modificado: '2026-10-18T10:00:00+02:00',
      origen: 'pegado',
      hash: hashOriginal(original),
      ocultados: 0,
      lector: { nombre, version: 1, resumen: { largo: original.length } },
    },
    notas: '',
    original,
  };
}
