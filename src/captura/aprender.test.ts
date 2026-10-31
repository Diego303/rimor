import { describe, expect, it } from 'vitest';
import { aprenderCorreccion } from './aprender';
import { useCompositor } from './compositor';
import { type DatosReglas, REGLAS_INICIALES } from './reglas';

/** Un espacio con solo sus reglas, que aplica el cambio al momento (como el de verdad con las reglas leídas). */
function espacio(fallar?: 'ilegible' | 'escribir') {
  let datos: DatosReglas = REGLAS_INICIALES;
  return {
    datos: () => datos,
    guardarReglas: async (cambio: (d: DatosReglas) => DatosReglas) => {
      if (fallar === 'ilegible') throw new Error('ilegible');
      datos = cambio(datos);
      if (fallar === 'escribir') throw new Error('E/S');
    },
  };
}

describe('aprender de una corrección', () => {
  it('a la tercera, la propuesta queda en el feed; sin firma o sin original, nada', async () => {
    useCompositor.setState({ propuestas: [] });
    const e = espacio();
    expect(await aprenderCorreccion(e, '[app] uno', 'log')).toBeNull();
    expect(await aprenderCorreccion(e, null, 'log')).toBeNull();
    expect(await aprenderCorreccion(e, 'Hola, equipo', 'log')).toBeNull();
    expect(await aprenderCorreccion(e, '[app] dos', 'log')).toBeNull();
    expect(await aprenderCorreccion(e, '[app] tres', 'log')).toEqual({ firma: '[app]', tipo: 'log' });
    expect(useCompositor.getState().propuestas).toMatchObject([{ firma: '[app]', tipo: 'log' }]);
    expect(e.datos().correcciones).toHaveLength(3);
  });

  it('si falla la escritura, la propuesta sigue (vale en memoria); si el archivo no se entiende, nada', async () => {
    useCompositor.setState({ propuestas: [] });
    const e = espacio('escribir');
    for (const t of ['[a] 1', '[a] 2']) await aprenderCorreccion(e, t, 'error');
    expect(await aprenderCorreccion(e, '[a] 3', 'error')).toEqual({ firma: '[a]', tipo: 'error' });
    const ilegible = espacio('ilegible');
    for (const t of ['[a] 1', '[a] 2', '[a] 3']) expect(await aprenderCorreccion(ilegible, t, 'error')).toBeNull();
  });
});
