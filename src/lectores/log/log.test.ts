import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { analizar, analizarLinea, concentracionDe, marcaDe, normalizar } from './analisis';
import { confianzaLog, lectorLog } from './lector';

const raiz = join(process.cwd(), 'fixtures/logs');
const esperado = JSON.parse(readFileSync(join(raiz, 'esperado.json'), 'utf8')) as Record<
  string,
  {
    lineas: number;
    formato: string;
    errores: number;
    avisos: number;
    desde: string;
    hasta: string;
    plantillas: number;
    primerError: number;
  }
>;

const ctx = (idioma: 'es' | 'en' = 'es', cambios: Partial<Contexto> = {}): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
  ...cambios,
});

describe('análisis de los 8 formatos', () => {
  for (const [archivo, e] of Object.entries(esperado))
    it(archivo, () => {
      const d = analizar(readFileSync(join(raiz, archivo), 'utf8'), { anio: 2026 });
      expect({
        lineas: d.lineas,
        formato: d.formato,
        errores: d.niveles.ERROR + d.niveles.FATAL,
        avisos: d.niveles.WARN,
        desde: d.desde,
        hasta: d.hasta,
        plantillas: d.plantillas.length,
        primerError: d.primerError?.linea,
      }).toEqual(e);
      expect(confianzaLog(readFileSync(join(raiz, archivo), 'utf8')), archivo).toBeGreaterThan(0.6);
    });
});

describe('plantillas', () => {
  it('normaliza fechas, UUID, IP, hexadecimales y números', () => {
    expect(
      normalizar(
        '2026-10-17T17:40:15.871Z ERROR timeout 30000 ms id=7f3c9a2e-1b2c-4d5e-8f90-123456789abc ip 10.0.0.1 0xdeadbeef',
      ),
    ).toBe('ERROR timeout <N> ms id=<ID> ip <IP> <HEX>');
  });

  it('es estable: normalizar dos veces da lo mismo', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 120 }), (linea) => {
        const una = normalizar(linea);
        expect(normalizar(una)).toBe(una);
      }),
      { numRuns: 500 },
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constantFrom('ERROR', 'GET', '/api', 'id=', ' ', '<N>', ':'),
            fc.nat().map(String),
            fc.uuid(),
            fc.ipV4(),
          ),
          {
            maxLength: 12,
          },
        ),
        (partes) => {
          const una = normalizar(partes.join(' '));
          expect(normalizar(una)).toBe(una);
        },
      ),
    );
  });

  it('en JSON, el orden de las claves no crea plantillas nuevas', () => {
    const d = analizar(readFileSync(join(raiz, 'json.log'), 'utf8'), { anio: 2026 });
    expect(d.plantillas.find((p) => p.plantilla.startsWith('INFO user login'))?.n).toBe(2);
  });

  it('pares clave=valor con sus valores más frecuentes', () => {
    const d = analizar(readFileSync(join(raiz, 'logfmt.log'), 'utf8'), { anio: 2026 });
    expect(d.pares.find((p) => p.clave === 'method')).toMatchObject({
      n: 4,
      valores: [
        { valor: 'GET', n: 3 },
        { valor: 'POST', n: 1 },
      ],
    });
  });
});

describe('rendimiento y bloques', () => {
  const linea = (i: number) =>
    `2026-10-17T${String(10 + (Math.floor(i / 3600) % 10)).padStart(2, '0')}:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}.000Z ${
      i % 97 === 0 ? 'ERROR' : i % 13 === 0 ? 'WARN' : 'INFO'
    } gateway: petición ${i} de ${i % 7}.0.0.1 tardó ${i % 900} ms`;

  it('50.000 líneas en menos de 2 s (el mejor de tres intentos, sin el ruido de las demás pruebas)', () => {
    const texto = Array.from({ length: 50_000 }, (_, i) => linea(i)).join('\n');
    let mejor = Number.POSITIVE_INFINITY;
    let d = analizar('', { anio: 2026 });
    for (let intento = 0; intento < 3 && mejor >= 2000; intento++) {
      const t0 = performance.now();
      d = analizar(texto, { anio: 2026 });
      mejor = Math.min(mejor, performance.now() - t0);
    }
    expect(mejor).toBeLessThan(2000);
    expect(d.lineas).toBe(50_000);
    expect(d.plantillas.length).toBeLessThan(10);
  }, 20_000);

  it('más de 50.000 líneas: por bloques, con progreso y el mismo resultado', () => {
    const texto = Array.from({ length: 120_000 }, (_, i) => linea(i)).join('\n');
    const avisos: number[] = [];
    const d = analizar(texto, { anio: 2026, alProgreso: (hechas) => avisos.push(hechas) });
    expect(avisos).toEqual([50_000, 100_000, 120_000]);
    expect(d.lineas).toBe(120_000);
    expect(d.niveles.ERROR).toBe(Math.floor(119_999 / 97) + 1);
    expect(d.lineaPlantilla).toHaveLength(120_000);
  }, 30_000);
});

describe('histograma', () => {
  it('por minuto con la concentración de errores; por hora si pasa de 6 h', () => {
    const d = analizar(readFileSync(join(raiz, 'texto-iso.log'), 'utf8'), { anio: 2026 });
    expect(d.histograma?.paso).toBe('minuto');
    expect(d.histograma?.barras[0]?.pared).toBe('17:22');
    expect(d.histograma?.barras.at(-1)?.pared).toBe('17:44');
    expect(d.concentracion).toMatchObject({ desde: '17:40', hasta: '17:43' });
    expect(d.concentracion?.desdeMs).toBe(Date.UTC(2026, 9, 17, 17, 40));
    expect(d.concentracion?.hastaMs).toBe(Date.UTC(2026, 9, 17, 17, 44));
    const largo = analizar('2026-10-17T08:00:00Z INFO a\n2026-10-17T15:30:00Z ERROR b\n2026-10-17T16:00:00Z INFO c', {
      anio: 2026,
    });
    expect(largo.histograma?.paso).toBe('hora');
    expect(largo.histograma?.barras).toHaveLength(9);
  });

  it('la concentración es la ventana más corta con el 80 % de los errores', () => {
    const barra = (errores: number, pared: string) => ({ inicio: 0, pared, errores, avisos: 0, otros: 0 });
    expect(concentracionDe([barra(1, 'a'), barra(0, 'b'), barra(4, 'c'), barra(4, 'd'), barra(1, 'e')])).toMatchObject({
      desde: 'c',
      hasta: 'd',
    });
    expect(concentracionDe([barra(0, 'a')])).toBeNull();
  });
});

describe('casos de la revisión', () => {
  const a = (linea: string) => analizarLinea(linea, 2026);

  it('una línea de texto con `time=12ms` no es logfmt', () => {
    const l = a('2026-10-18 17:40:01,123 ERROR request failed status=500 time=12ms');
    expect(l).toMatchObject({ formato: 'texto', nivel: 'ERROR' });
    expect(l.marca?.pared).toBe('17:40:01');
  });

  it('niveles numéricos de pino', () => {
    expect(a('{"level":50,"time":1760805600000,"msg":"fallo"}').nivel).toBe('ERROR');
    expect(a('{"level":30,"msg":"ok"}').nivel).toBe('INFO');
    expect(a('{"level":60,"msg":"muerto"}').nivel).toBe('FATAL');
  });

  it('la marca es la del principio, no una fecha dentro del mensaje', () => {
    expect(a('[17:40:01] ERROR cert expired at 2019-01-01 00:00:00').marca).toMatchObject({
      pared: '17:40:01',
      alcance: 'hora',
    });
    expect(a('Oct 17 06:31:45 servidor app: expira 2019-01-01T00:00:00Z').marca?.alcance).toBe('sin-anio');
    expect(a('{"time":"0001-01-01T00:00:00Z","msg":"x"}').marca).toBeNull();
  });

  it('marcas en microsegundos y nanosegundos', () => {
    const ms = Date.UTC(2026, 9, 18, 10, 0, 0);
    expect(marcaDe(ms * 1000, 2026)?.ms).toBe(ms);
    expect(marcaDe(ms * 1_000_000, 2026)?.ms).toBe(ms);
    expect(marcaDe(String(ms * 1_000_000), 2026)?.ms).toBe(ms);
  });

  it('el nivel del principio gana a un campo `level=` del mensaje', () => {
    expect(a('INFO GET /api?level=error 200').nivel).toBe('INFO');
    expect(a('INFO log level: debug').nivel).toBe('INFO');
    expect(a('request done level=warn').nivel).toBe('WARN');
  });

  it('una palabra enorme no atasca la búsqueda de pares', () => {
    const t0 = performance.now();
    a(`2026-10-18T10:00:00Z INFO ${'a'.repeat(80_000)}`);
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('solo hora: el cambio de día se arrastra', () => {
    const d = analizar('23:58:00 INFO a\n23:59:30 ERROR b\n00:00:30 INFO c\n00:01:00 ERROR d', { anio: 2026 });
    expect(d).toMatchObject({ desde: '23:58:00', hasta: '00:01:00', duracionMs: 3 * 60_000, fechasCompletas: false });
    expect(d.histograma?.paso).toBe('minuto');
  });

  it('syslog que cruza el año, y uno de diciembre capturado en enero, son del año que toca', () => {
    const d = analizar('Dec 31 23:59:00 h a: x\nJan  1 00:01:00 h a: y', { referencia: new Date(2027, 0, 1, 10) });
    expect(d.duracionMs).toBe(2 * 60_000);
    const e = analizar('Dec 30 10:00:00 h a: x', { referencia: new Date(2027, 0, 2) });
    expect(new Date(e.histograma?.barras[0]?.inicio ?? 0).getFullYear()).toBe(2026);
  });

  it('un JSON de datos o un CSV con fechas no son logs', () => {
    expect(confianzaLog('{"id":1,"nombre":"a"}\n{"id":2,"nombre":"b"}\n{"id":3,"nombre":"c"}')).toBe(0);
    expect(confianzaLog('2026-10-18 10:00:00,12,3\n2026-10-18 11:00:00,15,4\n2026-10-18 12:00:00,9,1')).toBe(0);
  });

  it('un solo error: «a las 17:40»', async () => {
    const el = elementoFalso(
      9,
      '2026-10-17T17:40:00Z ERROR uno\n2026-10-17T17:45:00Z INFO dos\n2026-10-17T17:50:00Z INFO tres',
      'log',
    );
    const d = await lectorLog.derivar(el);
    expect(lectorLog.respuesta(el, d, ctx()).texto[0]).toEqual({
      t: 'texto',
      v: 'Log de 3 líneas, con 1 error a las 17:40.',
    });
  });

  it('sin el texto (adjunto no cargado) falla en vez de dar 0 líneas', async () => {
    await expect(lectorLog.derivar({ ...elementoFalso(10, 'x', 'log'), original: null })).rejects.toThrow(
      'log.sinOriginal',
    );
  });

  it('el histograma por día va en hora local y nunca pasa de 1.500 barras', () => {
    const d = analizar('2026-01-01T10:00:00 INFO a\n2026-03-01T10:00:00 INFO b', { anio: 2026 });
    expect(d.histograma?.paso).toBe('dia');
    expect(d.histograma?.barras[0]?.pared).toBe('01/01');
    const largo = analizar('1990-01-01T00:00:00Z INFO a\n2026-01-01T00:00:00Z INFO b', { anio: 2026 });
    expect(largo.histograma?.barras.length).toBeLessThanOrEqual(1500);
  });
});

describe('lector Log', () => {
  it('título de la primera línea de error, sin su marca', async () => {
    const b = await lectorLog.leer({ texto: readFileSync(join(raiz, 'texto-iso.log'), 'utf8') });
    expect(b.titulo).toBe('ERROR gateway: read timeout tras 30000 ms (petición 7f3c9a2e-1b2c-4d5e-8f90-123456789abc)');
  });

  it('respuesta con errores, sin errores y con un ERR a la vez', async () => {
    const el = elementoFalso(1, readFileSync(join(raiz, 'texto-iso.log'), 'utf8'), 'log');
    const d = await lectorLog.derivar(el);
    const frase = (c: Contexto) =>
      lectorLog
        .respuesta(el, d, c)
        .texto.map((f) => ('v' in f ? f.v : f.ref))
        .join('');
    expect(frase(ctx())).toBe('Log de 7 líneas, con 3 errores entre 17:40 y 17:43.');
    expect(frase(ctx('en'))).toBe('Log of 7 lines, with 3 errors between 17:40 and 17:43.');
    // Un error guardado mientras pasaban los errores del log (las 17:41 en UTC, como el log).
    const aLaVez = new Date(Date.UTC(2026, 9, 17, 17, 41));
    const err = {
      ...elementoFalso(2, 'x', 'error').frontmatter,
      tipo: 'error' as const,
      ref: 'ERR-0015' as const,
      creado: aLaVez.toISOString(),
    };
    const r = lectorLog.respuesta(el, d, ctx('es', { cercanos: [err] }));
    expect(r.texto.map((f) => ('v' in f ? f.v : f.ref)).join('')).toBe(
      'Log de 7 líneas, con 3 errores entre 17:40 y 17:43, a la vez que ERR-0015. ¿Lo añado a su hilo?',
    );
    expect(r.acciones?.map((a) => a?.id)).toEqual(['hilo:ERR-0015', 'no']);
    // Un error de otro día a la misma hora de pared no está «a la vez».
    const otroDia = { ...err, creado: new Date(Date.UTC(2026, 9, 18, 17, 41)).toISOString() };
    expect(frase(ctx('es', { cercanos: [otroDia] }))).toBe('Log de 7 líneas, con 3 errores entre 17:40 y 17:43.');
    const limpio = elementoFalso(3, 'INFO a\nINFO b\nWARN c', 'log');
    expect(lectorLog.respuesta(limpio, await lectorLog.derivar(limpio), ctx()).texto[0]).toEqual({
      t: 'texto',
      v: 'Log de 3 líneas, sin errores y con 1 aviso.',
    });
  });

  it('cifras citables y resumen', async () => {
    const el = elementoFalso(1, readFileSync(join(raiz, 'java.log'), 'utf8'), 'log');
    const d = await lectorLog.derivar(el);
    expect(Object.keys(lectorLog.cifras ?? {})).toEqual(['lineas', 'errores', 'avisos', 'duracion', 'plantillas']);
    expect(lectorLog.cifras?.errores?.(d).texto).toBe('2');
    expect(lectorLog.resumenLegible?.(lectorLog.resumen(d), 'es')).toBe('6 líneas · 2 errores');
    expect(structuredClone(d)).toEqual(d);
  });

  it('no se toma por log un texto, una idea ni un enlace', () => {
    expect(confianzaLog('Hoy he estado revisando el despliegue.\nLa caché se invalidaba.\nHay que hablarlo.')).toBe(0);
    expect(confianzaLog('Probar zstd')).toBe(0);
    expect(confianzaLog('error al conectar\nno sé por qué\nmañana lo miro')).toBe(0);
  });
});
