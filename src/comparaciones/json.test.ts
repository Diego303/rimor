import { describe, expect, it } from 'vitest';
import { lectorJson } from '../lectores/json/lector';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { calcular, resultadoDe } from './crear';
import { compararJson } from './json';
import { cifrasDeResultado, leerResultado, resultadoDeJson } from './resultado';

const el = (n: number, texto: string) => {
  const base = elementoFalso(n, texto, 'json');
  return {
    ...base,
    frontmatter: { ...base.frontmatter, id: `${base.frontmatter.id.slice(0, -1)}${n}`, tipo: 'json' as const },
  };
};

describe('comparar dos configuraciones', () => {
  it('un JSON con un YAML de las mismas claves: lo que cambia, por ruta', async () => {
    const a = await lectorJson.derivar(el(1, '{"server": {"port": 8080, "host": "a"}, "debug": true}'));
    const b = await lectorJson.derivar(el(2, 'server:\n  port: 9090\n  host: a\nlog: info\n'));
    const c = compararJson(a, b);
    expect(c.formatos).toEqual(['json', 'yaml']);
    expect(c.cambiadas).toEqual([{ ruta: 'server.port', antes: 8080, despues: 9090 }]);
    expect(c.anadidas.map((x) => x.ruta)).toEqual(['log']);
    expect(c.quitadas.map((x) => x.ruta)).toEqual(['debug']);
    const r = resultadoDeJson(c, { hashes: ['a', 'b'] });
    expect(leerResultado(r as unknown as Record<string, unknown>)).toMatchObject({
      clase: 'json',
      anadidas: 1,
      quitadas: 1,
      cambiadas: 1,
    });
    expect(cifrasDeResultado(r, 'es')).toEqual([
      ['cambian', '3'],
      ['anadidas', '1'],
      ['quitadas', '1'],
      ['cambiadas', '1'],
    ]);
    for (const malo of [undefined, 'x', Number.NaN])
      expect(leerResultado({ ...(r as unknown as Record<string, unknown>), cambiadas: malo })).toBeNull();
  });

  it('calcular con los derivados de las dos fuentes, como elemento Comparación', async () => {
    const a = el(1, '[gateway]\nclient = "ureq"\ntimeout = 30\n');
    const b = el(2, '[gateway]\nclient = "reqwest"\ntimeout = 30\n');
    const r = await calcular(a, b, (e) => lectorJson.derivar(e));
    if (!r.ok || r.valor.clase !== 'json') throw new Error('esperaba una comparación de configuraciones');
    expect(r.valor.json.cambiadas.map((x) => x.ruta)).toEqual(['gateway.client']);
    expect(resultadoDe(r.valor, [a, b])).toMatchObject({ clase: 'json', cambiadas: 1, anadidas: 0, quitadas: 0 });
  });
});

describe('revisión de IN-045', () => {
  it('uno ilegible no se compara (no son «iguales»)', async () => {
    const a = el(1, 'clave: [sin cerrar');
    const b = el(2, '{"a": 1}');
    const r = await calcular(a, b, (e) => lectorJson.derivar(e));
    expect(r.ok ? r.valor : r.error.codigo).toBe('comparacion.ilegible');
  });
});
