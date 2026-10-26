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
        servers: [{ name: 'alpha', since: '2026-10-09T08:00:00Z' }],
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
    expect(confianzaJson('port: 8080\nhost: localhost\nworkers: 4\n')).toBe(0.85);
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

describe('revisión de IN-045', () => {
  it('un log grande que empieza por «[» o un JSON por línea grande no son JSON; un JSON grande sí', () => {
    const log = Array.from(
      { length: 9000 },
      (_, i) => `[2026-10-17 10:00:${String(i % 60).padStart(2, '0')}] INFO petición ${i} servida`,
    ).join('\n');
    expect(log.length).toBeGreaterThan(LIMITE_DETECCION);
    expect(confianzaJson(log, 'app.log')).toBe(0);
    expect(confianzaJson(log.replace(/\[2026[^\]]*\]/g, '[INFO]'))).toBe(0);
    const jsonl = Array.from({ length: 6000 }, (_, i) => JSON.stringify({ level: 'info', i, msg: 'ok' })).join('\n');
    expect(confianzaJson(jsonl)).toBe(0);
    expect(detectar({ texto: log, nombre: 'app.log' }, REGISTRO).lector).toBe('log');
    const grande = JSON.stringify(
      Array.from({ length: 9000 }, (_, i) => ({ id: i, nombre: `x${i}` })),
      null,
      2,
    );
    expect(confianzaJson(grande)).toBe(0.9);
  });

  it('leer un texto grande no lo analiza en el hilo principal: el formato por su principio', async () => {
    const grande = JSON.stringify(Array.from({ length: 40_000 }, (_, i) => ({ id: i, nombre: `x${i}` })));
    const inicio = performance.now();
    const b = await lectorJson.leer({ texto: grande });
    expect(performance.now() - inicio).toBeLessThan(100);
    expect(b.resumen).toEqual({ formato: 'json' });
  });

  it('notas con forma «Clave: valor» no son configuración: días, cabeceras de correo, prompts, logs', () => {
    const notas = [
      'Lunes: gimnasio\nMartes: piscina\nMiércoles: yoga',
      'From: ana@example.org\nTo: luis@example.org\nSubject: reunión',
      'Rol: revisor de código\nTarea: revisa el diff\nFormato: lista breve',
      '---\ntitle: Nota\ndate: 2026-10-17\n---\nAutor: Diego\nEstado: borrador\n',
      Array.from({ length: 50 }, (_, i) => `user_${i}: logged in from 10.0.0.${i}`).join('\n'),
      'port: 8080\nhost: localhost',
    ];
    for (const n of notas) expect(confianzaJson(n), n).toBe(0);
    expect(detectar({ texto: 'Lunes: gimnasio\nMartes: piscina' }, REGISTRO).lector).not.toBe('json');
    // Una configuración plana de verdad sí.
    expect(confianzaJson('port: 8080\nhost: localhost\nworkers: 4\n')).toBe(0.85);
  });

  it('TOML: claves repetidas, ilegible y como TOML (no como un texto YAML); enteros grandes; horas como se escriben', async () => {
    const repetida = await lectorJson.derivar(json(1, 'name = "a"\nname = "b"\n'));
    expect(repetida).toMatchObject({ ilegible: true, formato: 'toml' });
    expect(analizar('n = 9007199254740993\nm = 1\n', 'a.toml')?.valor).toEqual({ n: '9007199254740993', m: 1 });
    expect(analizar('[t]\nh = 07:32:00\nd = 1979-05-27\n')?.valor).toEqual({ t: { h: '07:32:00', d: '1979-05-27' } });
  });

  it('leer un TOML con textos de comillas triples: su resumen y su título', async () => {
    const texto = "[t]\nre = '''I [dw]on't need \\d{2} apples, nor any of the others today'''\nb = 1\n";
    expect(confianzaJson(texto)).toBe(0.92);
    const b = await lectorJson.leer({ texto });
    expect(b.resumen).toEqual({ formato: 'toml', claves: 3 });
    expect(b.titulo).toBe('TOML · t');
  });

  it('YAML: claves repetidas (la última gana) y etiquetas propias conservadas', () => {
    expect(analizar('a: 1\na: 2\nb: 3\nc: 4\n')?.valor).toEqual({ a: 2, b: 3, c: 4 });
    expect(analizar('Resources:\n  B:\n    Type: AWS::S3::Bucket\n    Name: !Ref Mio\n')?.valor).toEqual({
      Resources: { B: { Type: 'AWS::S3::Bucket', Name: '!Ref Mio' } },
    });
  });

  it('JSONC con el nombre de un .json: comentarios y comas al final; enteros de JSON más allá de 2^53', () => {
    const tsconfig = '{\n  // opciones\n  "compilerOptions": { "strict": true, /* sí */ "target": "ES2022", },\n}\n';
    expect(confianzaJson(tsconfig, 'tsconfig.json')).toBe(0.95);
    expect(analizar(tsconfig, 'tsconfig.json')?.valor).toEqual({ compilerOptions: { strict: true, target: 'ES2022' } });
    expect(analizar('{"id": 9007199254740993, "n": 1}')?.valor).toEqual({ id: '9007199254740993', n: 1 });
  });

  it('esquema: hasta 500 rutas sin contar la raíz; rutas: las marcas no chocan con claves que se escriben igual', () => {
    const muchas = Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`k${i}`, i]));
    expect(esquemaDe(muchas)).toHaveLength(500);
    expect(rutaDe(['[0]', 'x'])).toBe('["[0]"].x');
    expect(rutaDe(['a', { elementos: true }, 'b'])).toBe('a[].b');
    expect(rutasCortas(['hosts[0]', 'hosts[1]'])).toEqual(['hosts[0]', 'hosts[1]']);
    expect(rutasCortas(['a.hosts[3]'])).toEqual(['hosts[3]']);
  });
});

describe('versiones de configuraciones', () => {
  it('dos workflows distintos que se llaman igual («CI») no son versiones; el mismo con un cambio, sí', async () => {
    const { Repositorio } = await import('../../almacen/repositorio');
    const { AlmacenMemoria } = await import('../../almacen/memoria');
    const { capturar } = await import('../../captura/flujo');
    const repositorio = new Repositorio(new AlmacenMemoria());
    const efectos = { repositorio, registro: REGISTRO };
    const uno =
      'name: CI\non:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: pnpm test\n';
    const otro =
      'name: CI\non:\n  pull_request:\njobs:\n  lint:\n    runs-on: macos-latest\n    steps:\n      - run: cargo clippy\n      - run: cargo fmt --check\n';
    const r1 = await capturar({ texto: uno, origen: 'pegado' }, efectos);
    expect(r1.ok && r1.valor.tipo).toBe('creado');
    const r2 = await capturar({ texto: otro, origen: 'pegado' }, efectos);
    expect(r2.ok && r2.valor.tipo).toBe('creado');
    const r3 = await capturar({ texto: uno.replace('pnpm test', 'pnpm verificar'), origen: 'pegado' }, efectos);
    expect(r3.ok && r3.valor.tipo).toBe('version');
  });
});
