import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { REGISTRO } from '../lectores/registro';
import { crearCapturador, type ResultadoCaptura } from './flujo';

const V1 = `Eres un revisor de ADR. Lee el ADR que te paso y dime:

1. Qué riesgos no se han considerado.
2. Qué alternativas faltan.
3. Qué consecuencias negativas tiene la decisión.

ADR: {{adr}}`;
const V2 = `${V1}

Responde en español y en menos de 300 palabras.`;

function montar() {
  const repositorio = new Repositorio(new AlmacenMemoria());
  return { repositorio, capturador: crearCapturador({ repositorio, registro: REGISTRO }) };
}

const valor = (r: Awaited<ReturnType<ReturnType<typeof montar>['capturador']['capturar']>>): ResultadoCaptura => {
  if (!r.ok) throw new Error(r.error.codigo);
  return r.valor;
};

describe('versión nueva al capturar', () => {
  it('un prompt casi igual es su versión 2: la anterior al historial; deshacer la devuelve', async () => {
    const { repositorio, capturador } = montar();
    const primera = valor(await capturador.capturar({ texto: V1, origen: 'pegado', tipo: 'prompt' }));
    expect(primera.tipo).toBe('creado');
    const segunda = valor(
      await capturador.capturar({ texto: V2, origen: 'pegado', tipo: 'prompt', colecciones: ['prompts'] }),
    );
    if (segunda.tipo !== 'version') throw new Error(`esperaba una versión, salió ${segunda.tipo}`);
    expect(segunda.version).toBe(2);
    expect(segunda.copia).toMatch(/^historial\/PRM-0001\/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/);
    expect(repositorio.elementos()).toHaveLength(1);
    const fm = repositorio.frontmatter('PRM-0001');
    expect(fm?.version).toBe(2);
    expect(fm?.colecciones).toEqual(['prompts']);
    const leido = await repositorio.leerElemento('PRM-0001');
    expect(leido.ok && leido.valor.original).toBe(V2);
    const versiones = await repositorio.versiones('PRM-0001');
    expect(versiones.map((v) => [v.version, v.motivo, v.elemento.original])).toEqual([[1, 'version', V1]]);

    // Pegar otra vez exactamente la v2 es un duplicado, no otra versión.
    expect(valor(await capturador.capturar({ texto: V2, origen: 'pegado', tipo: 'prompt' })).tipo).toBe('duplicado');

    expect(await capturador.deshacerVersion(segunda)).toBe(true);
    const vuelta = await repositorio.leerElemento('PRM-0001');
    expect(vuelta.ok && vuelta.valor.original).toBe(V1);
    expect(repositorio.frontmatter('PRM-0001')?.version).toBeUndefined();
    expect(await repositorio.versiones('PRM-0001')).toEqual([]);
  });

  it('aparte, o algo distinto, es un elemento nuevo; otro tipo nunca es versión', async () => {
    const { repositorio, capturador } = montar();
    await capturador.capturar({ texto: V1, origen: 'pegado', tipo: 'prompt' });
    expect(valor(await capturador.capturar({ texto: V2, origen: 'pegado', tipo: 'prompt', aparte: true })).tipo).toBe(
      'creado',
    );
    const otro = 'Traduce este texto al inglés con un tono formal: {{texto}}';
    expect(valor(await capturador.capturar({ texto: otro, origen: 'pegado', tipo: 'prompt' })).tipo).toBe('creado');
    // El mismo texto como Markdown no es versión del prompt.
    expect(
      valor(await capturador.capturar({ texto: `${V2}\n\nAdemás.`, origen: 'pegado', tipo: 'markdown' })).tipo,
    ).toBe('creado');
    expect(repositorio.elementos()).toHaveLength(4);
  });

  it('un documento con el mismo título y relacionado es su versión aunque cambie mucho', async () => {
    const { capturador } = montar();
    const v1 = '# Plan del gateway\n\n## Objetivo\nReenviar los fragmentos según llegan.\n';
    const v2 =
      '# Plan del gateway\n\n## Objetivo\nReenviar los fragmentos según llegan.\n\n## Streaming\n- [ ] Leer como flujo\n- [ ] Medir 1 MB\n\n## Pruebas\nTodo nuevo aquí con muchas palabras distintas para que el parecido baje.\n';
    await capturador.capturar({ texto: v1, origen: 'pegado', tipo: 'markdown' });
    const r = valor(await capturador.capturar({ texto: v2, origen: 'pegado', tipo: 'markdown' }));
    expect(r.tipo).toBe('version');
  });
});
