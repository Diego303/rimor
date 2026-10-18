import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Contexto } from '../contrato';
import { lectorLog } from '../log/lector';
import { elementoFalso } from '../pruebas/falsos';
import { huellaDe, mensajeNormalizado } from './huella';
import { analizarError, lectorError, ordinal } from './lector';
import { analizarTraza } from './trazas';

const raiz = join(process.cwd(), 'fixtures/trazas');
const esperado = JSON.parse(readFileSync(join(raiz, 'esperado.json'), 'utf8')) as Record<
  string,
  { tipo: string; mensaje: string; propios: number }
>;
const leer = (archivo: string) => readFileSync(join(raiz, archivo), 'utf8');
const LENGUAJE: Record<string, string> = {
  rust: 'rust',
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  go: 'go',
  dotnet: 'dotnet',
};

const ctx = (idioma: 'es' | 'en' = 'es', cambios: Partial<Contexto> = {}): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
  ...cambios,
});

describe('las 30 trazas (6 lenguajes × 5)', () => {
  expect(Object.keys(esperado)).toHaveLength(30);
  for (const [archivo, e] of Object.entries(esperado))
    it(archivo, () => {
      const t = analizarTraza(leer(archivo));
      expect(t, archivo).not.toBeNull();
      expect({
        lenguaje: t?.lenguaje,
        tipo: t?.tipo,
        mensaje: t?.mensaje,
        propios: t?.marcos.filter((m) => m.propio).length,
      }).toEqual({
        lenguaje: LENGUAJE[archivo.split('/')[0] ?? ''],
        ...e,
      });
      expect(lectorError.detectar({ texto: leer(archivo) })).toBe(0.9);
    });
});

describe('huella', () => {
  it('la misma traza con otras rutas, números y direcciones da la misma huella', () => {
    const original = leer('rust/01.txt');
    const otra = original
      .replaceAll('/home/diego/', '/Users/ana/')
      .replaceAll('142:17', '150:3')
      .replaceAll('30s', '45s')
      .replaceAll('90b35a6239c3d8bdabc530a6a0816f7ff89a0aaf', '129f3b9964af4d4a709d1383930ade12dfe7c081');
    expect(analizarError(otra).huella).toBe(analizarError(original).huella);
    const go = leer('go/02.txt');
    expect(analizarError(go.replaceAll('0xc0001a2000', '0xc000999000').replaceAll(':41', ':44')).huella).toBe(
      analizarError(go).huella,
    );
    const py = leer('python/01.txt');
    expect(analizarError(py.replaceAll('/home/ana/proyectos/', '/srv/')).huella).toBe(analizarError(py).huella);
  });

  it('dos errores con el mismo mensaje y distintos marcos propios no la comparten', () => {
    const a = analizarError(leer('java/01.txt'));
    const b = analizarError(
      leer('java/01.txt').replace('com.ejemplo.tienda.Cliente.validar', 'com.ejemplo.tienda.Proveedor.validar'),
    );
    expect(a.mensaje).toBe(b.mensaje);
    expect(a.huella).not.toBe(b.huella);
  });

  it('normaliza números, rutas, UUID e IP del mensaje', () => {
    expect(mensajeNormalizado("Could not find file '/app/datos/clientes.csv'. retry 3 at 10.0.0.1")).toBe(
      "Could not find file '<RUTA>'. retry <N> at <IP>",
    );
    expect(huellaDe({ lenguaje: 'go', tipo: 'panic', mensaje: 'x 1', marcos: [] })).toBe(
      huellaDe({ lenguaje: 'go', tipo: 'panic', mensaje: 'x 2', marcos: [] }),
    );
  });
});

describe('lector Error', () => {
  it('detecta un error suelto con menos confianza y no toma un log ni un texto', () => {
    expect(lectorError.detectar({ texto: 'TypeError: x is not a function' })).toBe(0.7);
    expect(lectorError.detectar({ texto: '2026-10-17T17:40:15Z ERROR gateway: read timeout' })).toBe(0);
    expect(lectorError.detectar({ texto: 'Hoy he revisado los errores del despliegue.' })).toBe(0);
  });

  it('respuesta nueva y repetida (con su nota), en es y en', async () => {
    const el = elementoFalso(1, leer('rust/01.txt'), 'error');
    const d = await lectorError.derivar(el);
    const frase = (c: Contexto) =>
      lectorError
        .respuesta(el, d, c)
        .texto.map((f) => ('v' in f ? f.v : f.ref))
        .join('');
    expect(frase(ctx())).toBe('Error de Rust nuevo. 2 marcos de tu código.');
    expect(frase(ctx('en'))).toBe('New Rust error. 2 frames from your code.');
    const antes = (n: number, dia: number) => ({
      ...elementoFalso(n, 'x', 'error').frontmatter,
      creado: `2026-10-${String(dia).padStart(2, '0')}T10:00:00+02:00`,
    });
    const repetida = ctx('es', {
      mismaHuella: [antes(2, 15), antes(3, 2)],
      notas: [
        {
          ref: 'TXT-0002',
          texto: 'Pasa cuando la respuesta no trae content-length',
          fecha: '2026-10-15T10:00:00+02:00',
        },
      ],
    });
    const r = lectorError.respuesta(el, d, repetida);
    expect(r.texto.map((f) => ('v' in f ? f.v : '')).join('')).toBe(
      'Es la tercera vez. El 15 oct escribiste: Pasa cuando la respuesta no trae content-length.',
    );
    expect(r.texto.find((f) => f.t === 'cita')).toBeTruthy();
    expect(lectorError.respuesta(el, d, ctx('es', { mismaHuella: [antes(2, 15)] })).texto[0]).toEqual({
      t: 'texto',
      v: 'Es la segunda vez.',
    });
    const sinPropios = elementoFalso(4, leer('rust/02.txt'), 'error');
    expect(lectorError.respuesta(sinPropios, await lectorError.derivar(sinPropios), ctx()).texto[0]).toEqual({
      t: 'texto',
      v: 'Error de Rust nuevo. Ningún marco es de tu código.',
    });
  });

  it('ordinales y cifras con el contexto', async () => {
    expect(ordinal(3, 'es')).toBe('tercera');
    expect(ordinal(11, 'es')).toBe('11.ª');
    expect(ordinal(3, 'en')).toBe('third');
    // En inglés, el sufijo que toca: nunca «21th» ni «22th».
    expect([11, 21, 22, 23, 101].map((n) => ordinal(n, 'en'))).toEqual(['11th', '21st', '22nd', '23rd', '101st']);
    const el = elementoFalso(1, leer('python/03.txt'), 'error');
    const d = await lectorError.derivar(el);
    const otro = { ...elementoFalso(2, 'x', 'error').frontmatter, creado: '2026-10-02T10:00:00+02:00' };
    const c = ctx('es', { mismaHuella: [otro] });
    expect(lectorError.cifras?.ocurrencias?.(d, c, el).texto).toBe('2');
    expect(lectorError.cifras?.primera_vez?.(d, c, el).texto).toBe('2 oct');
    expect(lectorError.cifras?.ultima_vez?.(d, c, el).texto).toBe('18 oct');
  });

  it('título y resumen con la huella', async () => {
    const b = await lectorError.leer({ texto: leer('python/04.txt') });
    expect(b.titulo).toBe("AttributeError: 'NoneType' object has no attribute 'nombre'");
    expect(b.resumen).toMatchObject({ lenguaje: 'python', tipo: 'AttributeError', huellaVersion: 1 });
    expect(typeof b.resumen?.huella).toBe('string');
  });
});

/** Variantes reales de la revisión: cabeceras, marcos y librerías que el corpus no traía. */
describe('variantes de trazas (fixtures/trazas/variantes)', () => {
  const dir = join(raiz, 'variantes');
  const variantes = JSON.parse(readFileSync(join(dir, 'esperado.json'), 'utf8')) as Record<
    string,
    { lenguaje: string; tipo: string; mensaje: string; propios: string[] }
  >;
  const variante = (f: string) => readFileSync(join(dir, f), 'utf8');
  expect(Object.keys(variantes).length).toBeGreaterThanOrEqual(25);
  for (const [archivo, e] of Object.entries(variantes))
    it(archivo, () => {
      const t = analizarTraza(variante(archivo));
      expect({
        lenguaje: t?.lenguaje,
        tipo: t?.tipo,
        mensaje: t?.mensaje,
        propios: t?.marcos.filter((m) => m.propio).map((m) => m.funcion),
      }).toEqual(e);
      expect(lectorError.detectar({ texto: variante(archivo) })).toBe(0.9);
    });

  it('tipos sin prefijo: java.lang.Exception, java.lang.Error, System.Exception', () => {
    for (const [texto, lenguaje, tipo] of [
      ['java.lang.Exception: boom\n\tat com.acme.App.main(App.java:5)', 'java', 'java.lang.Exception'],
      [
        'Exception in thread "main" java.lang.Error: boom\n\tat com.acme.App.main(App.java:5)',
        'java',
        'java.lang.Error',
      ],
      [
        'Unhandled exception. System.Exception: boom\n   at Tienda.Program.Main(String[] args) in /src/Program.cs:line 5',
        'dotnet',
        'System.Exception',
      ],
    ] as const) {
      const t = analizarTraza(texto);
      expect([t?.lenguaje, t?.tipo, t?.marcos.filter((m) => m.propio).length]).toEqual([lenguaje, tipo, 1]);
    }
  });

  it('Python: el tipo es el de la excepción, no la línea de log de después', () => {
    const uvicorn = [
      'INFO:     Application startup complete.',
      'ERROR:    Exception in ASGI application',
      'Traceback (most recent call last):',
      '  File "/app/main.py", line 10, in raiz',
      '    return 1/0',
      'ZeroDivisionError: division by zero',
      'INFO:     127.0.0.1:50422 - "GET / HTTP/1.1" 500 Internal Server Error',
    ].join('\n');
    expect(analizarTraza(uvicorn)).toMatchObject({ tipo: 'ZeroDivisionError', mensaje: 'division by zero' });
  });

  it('Node: «at async Promise.all (index 0)» no es tu código ni «dónde»', () => {
    const t = analizarTraza(variante('node-promiseall.txt'));
    expect(t?.donde).toBe('/home/u/app/src/index.js:4');
  });

  it('un texto con una línea «  at …» no es una traza', () => {
    const texto =
      'Notas de la reunión\nError: el despliegue falló el martes\n  at least two times this week we saw it.';
    expect(analizarTraza(texto)).toBeNull();
  });

  it('sin expresiones cuadráticas: una línea «at» enorme se lee al momento', () => {
    const inicio = performance.now();
    analizarTraza(`Error: x\n    at ${'a ('.repeat(20_000)}`);
    expect(performance.now() - inicio).toBeLessThan(200);
  });

  it('título sin repetir el tipo (Go)', async () => {
    const b = await lectorError.leer({ texto: variante('go-created.txt') });
    expect(b.titulo).toBe('runtime error: integer divide by zero');
  });
});

describe('huella: lo que la revisión vio chocar o cambiar', () => {
  const huella = (texto: string) => analizarError(texto).huella;
  const goPtr = (metodo: string, archivo: string, goroutine: number) =>
    `panic: runtime error: invalid memory address or nil pointer dereference\n\ngoroutine ${goroutine} [running]:\nejemplo.org/api/handlers.(*Servidor).${metodo}(0x0)\n\t/srv/api/handlers/${archivo}.go:41 +0x3c\nmain.main()\n\t/srv/api/main.go:9 +0x1`;

  it('Go: los métodos con receptor puntero conservan su nombre', () => {
    const t = analizarTraza(goPtr('Pedido', 'pedido', 34));
    expect(t?.marcos[0]?.funcion).toBe('ejemplo.org/api/handlers.(*Servidor).Pedido');
    expect(huella(goPtr('Pedido', 'pedido', 34))).not.toBe(huella(goPtr('Usuario', 'usuario', 12)));
    expect(huella(goPtr('Pedido', 'pedido', 34))).toBe(huella(goPtr('Pedido', 'pedido', 7)));
  });

  it('Go: «created by … in goroutine N» no cambia la huella', () => {
    const creado = (n: number) =>
      `panic: x\n\ngoroutine 18 [running]:\nmain.trabajador(0x0)\n\t/home/u/w/main.go:9 +0x7c\ncreated by main.main in goroutine ${n}\n\t/home/u/w/main.go:15 +0x2f`;
    expect(huella(creado(1))).toBe(huella(creado(33)));
  });

  it('Rust con RUST_BACKTRACE=full: las direcciones no entran', () => {
    const traza = (dir: string) =>
      `thread 'main' panicked at src/main.rs:4:5:\nboom\nstack backtrace:\n  12:     ${dir} - miapp::cargar::h1a2b3c4d5e6f7a8b\n                               at /home/u/miapp/src/main.rs:4:5`;
    expect(analizarTraza(traza('0x55d1c2a3c111'))?.marcos[0]?.funcion).toBe('miapp::cargar::h1a2b3c4d5e6f7a8b');
    expect(huella(traza('0x55d1c2a3c111'))).toBe(huella(traza('0x5600aa00bb11')));
  });

  it('Python: cuentan los marcos más internos, no `<module>` y `main`', () => {
    const py = (archivo: string, funcion: string) =>
      `Traceback (most recent call last):\n  File "/app/main.py", line 20, in <module>\n    main()\n  File "/app/main.py", line 15, in main\n    x()\n  File "/app/${archivo}.py", line 8, in ${funcion}\n    x.nombre\nAttributeError: 'NoneType' object has no attribute 'nombre'`;
    expect(huella(py('pedidos', 'pedidos'))).not.toBe(huella(py('clientes', 'clientes')));
  });

  it('funciones anónimas de archivos distintos no chocan; el mismo archivo en otra carpeta, sí coincide', () => {
    const js = (ruta: string) =>
      `TypeError: Cannot read properties of undefined (reading 'id')\n    at ${ruta}:12:24\n    at /app/src/rutas/base.js:3:1`;
    expect(huella(js('/app/src/rutas/pedidos.js'))).not.toBe(huella(js('/app/src/rutas/clientes.js')));
    expect(huella(js('/app/src/rutas/pedidos.js'))).toBe(huella(js('/srv/otra/src/rutas/pedidos.js')));
  });

  it('una celda de Jupyter con otro número da la misma huella', () => {
    const celda = variante('py-jupyter.txt');
    expect(huella(celda.replace('Cell In[3]', 'Cell In[12]'))).toBe(huella(celda));
  });
});

describe('detección dentro de un log', () => {
  it('un log con una traza en medio sigue siendo un log (la traza queda por debajo)', () => {
    const lineas: string[] = [];
    for (let i = 0; i < 300; i++)
      lineas.push(`2026-10-18 10:${String(i % 60).padStart(2, '0')}:00.123 INFO  [main] c.a.Servicio - lote ${i}`);
    lineas.splice(
      150,
      0,
      '2026-10-18 10:30:00.123 ERROR [main] c.a.Servicio - fallo',
      'java.lang.IllegalStateException: x',
      '\tat com.acme.Servicio.run(Servicio.java:10)',
    );
    const texto = lineas.join('\n');
    expect(lectorError.detectar({ texto })).toBe(0.75);
    expect(lectorLog.detectar({ texto })).toBe(0.85);
  });
});

const variante = (f: string) => readFileSync(join(raiz, 'variantes', f), 'utf8');
