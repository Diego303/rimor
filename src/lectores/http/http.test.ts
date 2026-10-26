import { describe, expect, it } from 'vitest';
import { detectar } from '../../captura/detector';
import { comprobarEstilo } from '../../respuestas/reglas';
import { ocultar } from '../../seguridad/secretos/ocultar';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizarCurl, palabrasShell, urlCorta } from './analisis';
import { aCurl, aFetch } from './exportar';
import { lectorHttp } from './lector';

const ctx = (idioma: 'es' | 'en') => ({ idioma, mismaHuella: [], versiones: [], notas: [], colecciones: [] });
const leer = (r: { texto: { t: string; v?: string }[] }) => r.texto.map((f) => f.v ?? '').join('');
const NOTAS = {
  opciones: (l: string) => `opciones: ${l}`,
  tuberia: (r: string) => `después: ${r}`,
  usuarioOculto: (u: string) => `usuario ${u} oculto`,
  cookie: 'cookie',
};

const CHROME = `curl 'https://api.example.org/v1/pagos?page=2&limit=50' \\
  -H 'accept: application/json' \\
  -H 'content-type: application/json' \\
  --data-raw '{"importe":1250,"moneda":"EUR"}' \\
  --compressed`;

describe('palabras como las parte un shell', () => {
  it("comillas, escapes, $'…', continuaciones y tubería aparte", () => {
    expect(palabrasShell(`$ curl -H "a: \\"b\\"" 'c d' $'e\\nf' g\\ h | jq .x`)).toEqual({
      palabras: ['curl', '-H', 'a: "b"', 'c d', 'e\nf', 'g h'],
      tuberia: '| jq .x',
    });
    expect(palabrasShell('curl a \\\n  b')?.palabras).toEqual(['curl', 'a', 'b']);
    // El «Copiar como cURL (cmd)» de Windows: `^` escapa y continúa.
    expect(palabrasShell('curl "u" ^\n  --data-raw "{^"a^":1}"')?.palabras).toEqual([
      'curl',
      'u',
      '--data-raw',
      '{"a":1}',
    ]);
    expect(palabrasShell('curl a\nls -la')).toBeNull();
    expect(palabrasShell("curl 'sin cerrar")).toBeNull();
  });
});

describe('analizar un curl', () => {
  it('el «Copiar como cURL» de Chrome: método, URL con su consulta, cabeceras, cuerpo JSON y opciones', () => {
    expect(analizarCurl(CHROME)).toEqual({
      metodo: 'POST',
      url: 'https://api.example.org/v1/pagos?page=2&limit=50',
      consulta: [
        ['page', '2'],
        ['limit', '50'],
      ],
      cabeceras: [
        ['accept', 'application/json'],
        ['content-type', 'application/json'],
      ],
      cuerpo: { tipo: 'json', texto: '{"importe":1250,"moneda":"EUR"}' },
      opciones: ['--compressed'],
    });
  });

  it('--json, -F, -G, -I, -u, -b, -A, cortas juntas y pegadas, --opción=valor, -X y la tubería', () => {
    expect(analizarCurl(`curl --json '{"a":1}' https://x.org`)).toMatchObject({
      metodo: 'POST',
      cabeceras: [
        ['Content-Type', 'application/json'],
        ['Accept', 'application/json'],
      ],
      cuerpo: { tipo: 'json' },
    });
    expect(analizarCurl(`curl -F 'f=@a.pdf' -F 'd=hola' https://x.org/subir`)?.cuerpo).toEqual({
      tipo: 'multipart',
      texto: 'f=@a.pdf\nd=hola',
      partes: [
        ['f', '@a.pdf'],
        ['d', 'hola'],
      ],
    });
    expect(analizarCurl(`curl -G https://x.org/b --data-urlencode 'q=a b' -d n=2`)).toMatchObject({
      metodo: 'GET',
      url: 'https://x.org/b?q=a%20b&n=2',
      consulta: [
        ['q', 'a b'],
        ['n', '2'],
      ],
    });
    expect(analizarCurl('curl -I https://x.org')?.metodo).toBe('HEAD');
    expect(analizarCurl(`curl -sSLu ana:clave -b 'sesion=1' -A 'mi-agente' https://x.org`)).toMatchObject({
      usuario: 'ana:clave',
      cabeceras: [
        ['Cookie', 'sesion=1'],
        ['User-Agent', 'mi-agente'],
      ],
      opciones: ['-s', '-S', '-L'],
    });
    expect(analizarCurl('curl -XDELETE --url=https://x.org/a -o salida.json')).toMatchObject({
      metodo: 'DELETE',
      url: 'https://x.org/a',
      opciones: ['-o', 'salida.json'],
    });
    expect(analizarCurl(`curl -d 'a=1&b=dos' https://x.org`)?.cuerpo).toEqual({
      tipo: 'formulario',
      texto: 'a=1&b=dos',
      partes: [
        ['a', '1'],
        ['b', 'dos'],
      ],
    });
    expect(analizarCurl(`curl https://x.org | jq '.a' > a.json`)?.tuberia).toBe(`| jq '.a' > a.json`);
  });

  it('no es una petición: sin URL, otro programa, varios comandos o prosa', () => {
    for (const texto of [
      'curl -sS',
      'wget https://x.org',
      'curl https://a.org\ncurl https://b.org',
      'Usa curl para probarlo.',
    ])
      expect(analizarCurl(texto), texto).toBeNull();
  });
});

describe('de vuelta: cURL y fetch', () => {
  it('el curl canónico se vuelve a analizar igual', () => {
    for (const texto of [
      CHROME,
      `curl -X PUT 'https://x.org/a b' -H "x: it's" -u u:p -d 'texto plano'`,
      'curl -I https://x.org',
      `curl -F 'a=1' https://x.org | jq .`,
    ]) {
      const p = analizarCurl(texto);
      expect(p && analizarCurl(aCurl(p)), texto).toEqual(p);
    }
    expect(aCurl(analizarCurl('curl -I https://x.org') ?? ({} as never))).toBe("curl -I 'https://x.org'");
  });

  it('fetch: método, cabeceras, cuerpo, multipart, cookies y lo que no tiene equivalente en comentarios', () => {
    const p = analizarCurl(CHROME);
    expect(p && aFetch(p, NOTAS)).toBe(
      [
        '// opciones: --compressed',
        'const respuesta = await fetch("https://api.example.org/v1/pagos?page=2&limit=50", {',
        '  method: "POST",',
        '  headers: {',
        '    "accept": "application/json",',
        '    "content-type": "application/json",',
        '  },',
        '  body: "{\\"importe\\":1250,\\"moneda\\":\\"EUR\\"}",',
        '});',
      ].join('\n'),
    );
    const multipart = analizarCurl(`curl -F 'a=1' -b 's=2' -u ana:ñu x.org`);
    const f = multipart ? aFetch(multipart, NOTAS) : '';
    expect(f).toContain('const form = new FormData();\nform.append("a", "1");');
    expect(f).toContain('fetch("http://x.org"');
    expect(f).toContain("credentials: 'include'");
    expect(f).toContain(`"Authorization": "Basic ${btoa('ana:Ã±u')}"`);
    const oculto = analizarCurl(`curl -u ana:‹oculto:contrasena› https://x.org | jq .`);
    expect(oculto && aFetch(oculto, NOTAS)).toMatch(/^\/\/ usuario ana oculto\n\/\/ después: \| jq \./);
  });
});

describe('lector http', () => {
  it('detección: un curl, también tras un prompt y con tubería; varios comandos son un Comando', () => {
    expect(detectar({ texto: CHROME }, REGISTRO).lector).toBe('http');
    expect(detectar({ texto: "$ curl -sS https://x.org | jq '.a'" }, REGISTRO).lector).toBe('http');
    expect(detectar({ texto: 'curl https://a.org\nls -la' }, REGISTRO).lector).not.toBe('http');
  });

  it('los secretos se ocultan al capturar y la petición se sigue leyendo', () => {
    const r = ocultar(
      `curl 'https://x.org/a?api_key=${'k'.repeat(24)}' -H 'Cookie: sesion=${'s'.repeat(20)}' -H 'X-Api-Key: ${'x'.repeat(30)}' -u ana:${'p'.repeat(14)}`,
    );
    const p = analizarCurl(r.texto);
    expect(p?.consulta).toEqual([['api_key', '‹oculto:clave-api›']]);
    expect(p?.cabeceras).toEqual([
      ['Cookie', 'sesion=‹oculto:cookie›'],
      ['X-Api-Key', '‹oculto:clave-api›'],
    ]);
    expect(p?.usuario).toBe('ana:‹oculto:contrasena›');
  });

  it('título, resumen y respuesta en es y en, con la URL en mono', async () => {
    const b = await lectorHttp.leer({ texto: CHROME });
    expect(b.titulo).toBe('POST api.example.org/v1/pagos');
    expect(b.resumen).toEqual({ metodo: 'POST', host: 'api.example.org', cabeceras: 2 });
    const el = elementoFalso(1, CHROME, 'http');
    const d = await lectorHttp.derivar(el);
    const es = lectorHttp.respuesta(el, d, ctx('es'));
    expect(leer(es)).toBe('POST a api.example.org/v1/pagos con 2 cabeceras y un cuerpo JSON.');
    expect(es.texto.filter((f) => f.t === 'mono').map((f) => ('v' in f ? f.v : ''))).toEqual([
      'api.example.org/v1/pagos',
    ]);
    expect(leer(lectorHttp.respuesta(el, d, ctx('en')))).toBe(
      'POST to api.example.org/v1/pagos with 2 headers and a JSON body.',
    );
    const get = await lectorHttp.derivar(elementoFalso(2, 'curl https://x.org/salud'));
    expect(leer(lectorHttp.respuesta(el, get, ctx('es')))).toBe('GET a x.org/salud.');
    const ilegible = await lectorHttp.derivar(elementoFalso(3, 'no es un curl'));
    expect(leer(lectorHttp.respuesta(el, ilegible, ctx('es')))).toBe(
      'No se lee como una petición curl: la guardo tal cual.',
    );
    for (const x of [d, get, ilegible]) expect(comprobarEstilo(lectorHttp.respuesta(el, x, ctx('es')))).toEqual([]);
    expect(lectorHttp.resumenLegible?.({ metodo: 'POST', host: 'x.org', cabeceras: 3 }, 'es')).toBe(
      'POST x.org · 3 cabeceras',
    );
    expect(urlCorta(`https://x.org/${'a'.repeat(100)}`)).toHaveLength(60);
  });
});
