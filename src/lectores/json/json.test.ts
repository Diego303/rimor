import { type Elemento, hashOriginal } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { detectar, entradaDeArchivo } from '../../captura/detector';
import { comprobarEstilo } from '../../respuestas/reglas';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import {
  analizar,
  compararValores,
  confianzaJson,
  contarClaves,
  esquemaDe,
  LIMITE_DETECCION,
  profundidad,
  rutaDe,
  rutasCambiadas,
  rutasCortas,
} from './analisis';
import { lectorJson, tituloDe } from './lector';

const ctx = (idioma: 'es' | 'en') => ({ idioma, mismaHuella: [], versiones: [], notas: [], colecciones: [] });
const leer = (r: { texto: { t: string; v?: string }[] }) => r.texto.map((f) => f.v ?? '').join('');

const TOML = `[gateway]
client = "ureq"
stream_timeout_ms = 30000
retries = 3

[[servers]]
name = "alpha"
since = 2026-10-09T08:00:00Z
`;

function json(n: number, original: string, modificado = '2026-10-09T10:00:00+02:00'): Elemento {
  const base = elementoFalso(n, original, 'json');
  return { ...base, frontmatter: { ...base.frontmatter, tipo: 'json', modificado, hash: hashOriginal(original) } };
}

describe('analizar JSON, YAML y TOML', () => {
  it('los tres formatos, con las fechas como texto', () => {
    expect(analizar('{"a": 1, "b": [true, null]}')).toEqual({ formato: 'json', valor: { a: 1, b: [true, null] } });
    expect(analizar(TOML)).toEqual({
      formato: 'toml',
      valor: {
        gateway: { client: 'ureq', stream_timeout_ms: 30000, retries: 3 },
        servers: [{ name: 'alpha', since: '2026-10-09T08:00:00.000Z' }],
      },
    });
    expect(analizar('server:\n  port: 8080\n  host: localhost\nfecha: 2026-10-09\n')).toEqual({
      formato: 'yaml',
      valor: { server: { port: 8080, host: 'localhost' }, fecha: '2026-10-09' },
    });
    // Varios documentos (un manifiesto de Kubernetes): una lista.
    expect(analizar('kind: Service\nname: a\n---\nkind: Deployment\nname: b\n')?.valor).toEqual([
      { kind: 'Service', name: 'a' },
      { kind: 'Deployment', name: 'b' },
    ]);
    // Anclas y alias de YAML.
    expect(analizar('base: &b\n  timeout: 30\n  retries: 2\nstaging:\n  <<: *b\n  timeout: 60\n')?.valor).toEqual({
      base: { timeout: 30, retries: 2 },
      staging: { timeout: 60, retries: 2 },
    });
  });

  it('no son configuración: prosa, una lista de Markdown, un prompt, un log, un CSV, un .env sin comillas, código', () => {
    for (const texto of [
      'Hola, qué tal estás hoy.',
      '- uno\n- dos\n- tres',
      'Rol: Eres un revisor de ADR muy exigente.\nTarea: Señala riesgos y supuestos sin probar.',
      '2026-10-17 17:40:00 ERROR: timeout\n2026-10-17 17:40:01 INFO: reintento',
      'a,b\n1,2\n3,4',
      'FOO=bar\nBAZ=qux',
      'def suma(a, b):\n    return a + b',
      'una: palabra',
      '{"a": 1',
    ])
      expect(analizar(texto), texto).toBeNull();
  });

  it('con el nombre del archivo, su formato aunque no tenga forma de configuración', () => {
    expect(analizar('- uno\n- dos', 'lista.yaml')).toEqual({ formato: 'yaml', valor: ['uno', 'dos'] });
    expect(analizar('nombre = "x"', 'a.toml')?.formato).toBe('toml');
    // Al derivar lo ya guardado (o pedido con `/json`), tampoco se pide.
    expect(analizar('- uno\n- dos', undefined, { estricto: false })?.valor).toEqual(['uno', 'dos']);
  });

  it('confianza: JSON 0,95; TOML 0,92 con tabla y 0,85 sin ella; YAML 0,9 o 0,85; un JSON enorme por su principio', () => {
    expect(confianzaJson('{"a": 1, "b": 2}')).toBe(0.95);
    expect(confianzaJson(TOML)).toBe(0.92);
    expect(confianzaJson('a = 1\nb = "x"\n')).toBe(0.85);
    expect(confianzaJson('server:\n  port: 8080\n')).toBe(0.9);
    expect(confianzaJson('port: 8080\nhost: localhost\n')).toBe(0.85);
    const enorme = `[${Array.from({ length: 20_000 }, (_, i) => `{"id": ${i}, "nombre": "x${i}"}`).join(',\n')}]`;
    expect(enorme.length).toBeGreaterThan(LIMITE_DETECCION);
    expect(confianzaJson(enorme)).toBe(0.9);
    expect(confianzaJson('   ')).toBe(0);
  });

  it('claves a cualquier profundidad, profundidad y esquema inferido (las listas, fundidas en `[]`)', () => {
    const v = analizar(TOML)?.valor ?? null;
    expect(contarClaves(v)).toBe(7);
    expect(profundidad(v)).toBe(3);
    expect(esquemaDe(v)).toEqual([
      { ruta: 'gateway', tipos: ['objeto'], veces: 1 },
      { ruta: 'gateway.client', tipos: ['texto'], veces: 1 },
      { ruta: 'gateway.stream_timeout_ms', tipos: ['numero'], veces: 1 },
      { ruta: 'gateway.retries', tipos: ['numero'], veces: 1 },
      { ruta: 'servers', tipos: ['lista'], veces: 1, elementos: 1 },
      { ruta: 'servers[]', tipos: ['objeto'], veces: 1 },
      { ruta: 'servers[].name', tipos: ['texto'], veces: 1 },
      { ruta: 'servers[].since', tipos: ['texto'], veces: 1 },
    ]);
    expect(esquemaDe([1, 'x', null])).toEqual([{ ruta: '[]', tipos: ['numero', 'texto', 'nulo'], veces: 3 }]);
  });

  it('rutas: puntos, índices y claves con espacios', () => {
    expect(rutaDe(['gateway', 'stream_timeout_ms'])).toBe('gateway.stream_timeout_ms');
    expect(rutaDe(['servers', 0, 'host'])).toBe('servers[0].host');
    expect(rutaDe(['clave con espacios', 'x'])).toBe('["clave con espacios"].x');
    expect(rutaDe([])).toBe('$');
  });
});

describe('comparación estructural', () => {
  it('mapas por clave; listas por posición; un cambio de tipo es un cambio; en el orden del documento', () => {
    const d = compararValores(
      { a: 1, b: { c: 'x', d: [1, 2, 3] }, e: true, f: 'quitada' },
      { a: '1', b: { c: 'y', d: [1, 2] }, e: true, g: 'nueva' },
    );
    expect(d).toEqual({
      anadidas: [{ ruta: 'g', valor: 'nueva' }],
      quitadas: [
        { ruta: 'b.d[2]', valor: 3 },
        { ruta: 'f', valor: 'quitada' },
      ],
      cambiadas: [
        { ruta: 'a', antes: 1, despues: '1' },
        { ruta: 'b.c', antes: 'x', despues: 'y' },
      ],
    });
    expect(rutasCambiadas(d)).toEqual(['a', 'b.c', 'g', 'b.d[2]', 'f']);
  });

  it('una lista de mapas con `name` (o `id`) se empareja por él, aunque cambie de orden', () => {
    const d = compararValores(
      {
        servers: [
          { name: 'a', ip: '1' },
          { name: 'b', ip: '2' },
        ],
      },
      {
        servers: [
          { name: 'b', ip: '3' },
          { name: 'c', ip: '4' },
        ],
      },
    );
    expect(d.cambiadas).toEqual([{ ruta: 'servers[name="b"].ip', antes: '2', despues: '3' }]);
    expect(d.anadidas.map((x) => x.ruta)).toEqual(['servers[name="c"]']);
    expect(d.quitadas.map((x) => x.ruta)).toEqual(['servers[name="a"]']);
  });

  it('rutas cortas: sin el prefijo que comparten (como la referencia)', () => {
    expect(rutasCortas(['gateway.stream_timeout_ms', 'gateway.client'])).toEqual(['stream_timeout_ms', 'client']);
    expect(rutasCortas(['gateway.client'])).toEqual(['client']);
    expect(rutasCortas(['a.b[0].c', 'a.b[1].d'])).toEqual(['[0].c', '[1].d']);
    expect(rutasCortas(['x', 'y.z'])).toEqual(['x', 'y.z']);
  });
});

describe('lector json', () => {
  it('detección: JSON, YAML y TOML pegados o soltados; el JSON de hyperfine sigue siendo de Mediciones', () => {
    expect(detectar({ texto: TOML }, REGISTRO).lector).toBe('json');
    expect(detectar({ texto: '{"name": "rimor", "version": "0.1.0"}' }, REGISTRO).lector).toBe('json');
    const bytes = new TextEncoder().encode('- uno\n- dos\n');
    const { entrada, cabecera } = entradaDeArchivo('lista.yaml', '', bytes);
    expect(detectar(entrada, REGISTRO, { cabecera }).lector).toBe('json');
    const hyperfine = JSON.stringify({ results: [{ command: 'rg x', mean: 0.1, times: [0.1, 0.11, 0.09] }] });
    expect(detectar({ texto: hyperfine }, REGISTRO).lector).toBe('mediciones');
  });

  it('título: el nombre del archivo, su `name` o el formato con sus primeras claves', async () => {
    expect((await lectorJson.leer({ texto: TOML, nombre: 'config.gateway.toml' })).titulo).toBe('config.gateway.toml');
    expect((await lectorJson.leer({ texto: TOML })).titulo).toBe('TOML · gateway, servers');
    expect(tituloDe('json', { name: 'rimor', version: '1' })).toBe('rimor · JSON');
    expect(tituloDe('yaml', { a: 1, b: 2, c: 3, d: 4 })).toBe('YAML · a, b, c…');
    expect((await lectorJson.leer({ texto: TOML })).resumen).toEqual({ formato: 'toml', claves: 7 });
  });

  it('respuesta: «TOML con 7 claves.», una lista, un valor suelto o ilegible; es y en, con estilo', async () => {
    const casos: [string, string, string][] = [
      [TOML, 'TOML con 7 claves.', 'TOML with 7 keys.'],
      ['[1, 2, 3]', 'JSON con una lista de 3 elementos.', 'JSON with a list of 3 items.'],
      ['"hola"', 'JSON con un valor suelto.', 'JSON with a single value.'],
      [
        'clave: [sin cerrar',
        'No se lee como JSON, YAML ni TOML: lo guardo tal cual.',
        'It does not read as JSON, YAML or TOML: I keep it as it is.',
      ],
    ];
    for (const [texto, es, en] of casos) {
      const el = json(1, texto);
      const d = await lectorJson.derivar(el);
      expect(leer(lectorJson.respuesta(el, d, ctx('es')))).toBe(es);
      expect(leer(lectorJson.respuesta(el, d, ctx('en')))).toBe(en);
      expect(comprobarEstilo(lectorJson.respuesta(el, d, ctx('es')))).toEqual([]);
    }
    expect(lectorJson.resumenLegible?.({ formato: 'toml', claves: 34 }, 'es')).toBe('TOML · 34 claves');
  });

  it('respuesta de una versión: las claves que cambian, en mono y sin el prefijo común; «y N más»', async () => {
    const anterior = json(1, TOML);
    const actual = json(1, TOML.replace('"ureq"', '"reqwest"').replace('30000', '60000'));
    const ahora = new Date('2026-10-17T12:00:00+02:00');
    const version = async (a: Elemento, idioma: 'es' | 'en' = 'es') =>
      (await lectorJson.respuestaVersion?.(a, anterior, idioma, ahora)) ?? null;
    const r = await version(actual);
    expect(r && leer(r)).toBe(
      'TOML con 7 claves. Frente a la versión del 9 oct cambian 2: client y stream_timeout_ms.',
    );
    expect(r?.texto.filter((f) => f.t === 'mono').map((f) => ('v' in f ? f.v : ''))).toEqual([
      'client',
      'stream_timeout_ms',
    ]);
    expect(r && comprobarEstilo(r)).toEqual([]);
    const en = await version(actual, 'en');
    expect(en && leer(en)).toBe(
      'TOML with 7 keys. Compared with the version from Oct 9, 2 changes: client and stream_timeout_ms.',
    );
    const muchas = json(
      1,
      '[gateway]\nclient = "x"\nstream_timeout_ms = 1\nretries = 9\nnueva = 1\n\n[[servers]]\nname = "alpha"\n',
    );
    const r5 = await version(muchas);
    expect(r5 && leer(r5)).toBe(
      'TOML con 7 claves. Frente a la versión del 9 oct cambian 5: gateway.client, gateway.stream_timeout_ms, gateway.retries y 2 más.',
    );
    const igual = await version(anterior);
    expect(igual && leer(igual)).toBe('TOML con 7 claves. Frente a la versión del 9 oct no cambia ninguna clave.');
    expect(await version(json(1, 'clave: [sin cerrar'))).toBeNull();
  });

  it('derivar: el valor, el esquema y lo que indexa la búsqueda', async () => {
    const d = await lectorJson.derivar(json(1, TOML));
    expect(d).toMatchObject({ formato: 'toml', claves: 7, primerNivel: ['gateway', 'servers'], profundidad: 3 });
    expect(lectorJson.textoIndexable?.(d)).toContain('gateway.stream_timeout_ms');
  });
});
