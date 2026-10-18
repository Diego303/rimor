import fc from 'fast-check';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
  asignarRef,
  cercaPara,
  comparacionSchema,
  crearGeneradorUlid,
  documentoSchema,
  type Elemento,
  escribirElemento,
  escribirYaml,
  esUlid,
  hashOriginal,
  investigacionSchema,
  isoConZona,
  leerElemento,
  leerManifest,
  manifestSchema,
  migrar,
  nombreArchivo,
  normalizarOriginal,
  rutaAdjunto,
  rutaElemento,
  rutaHistorial,
  separar,
  sha256Hex,
  slug,
  TIPOS_ELEMENTO,
  tiempoDeUlid,
  utf8,
} from './index';

const ID = '01JAB4C2Q2X8M5N7P0R4S6T8V0';
const HASH = `sha256:${'3fa2c9'.padEnd(64, '0')}` as const;

function elementoBase(cambios: Partial<Elemento['frontmatter']> = {}): Elemento {
  return {
    frontmatter: {
      id: ID,
      ref: 'LOG-0042',
      tipo: 'log',
      titulo: 'Timeout en streaming con ureq',
      creado: '2026-10-16T18:44:03+02:00',
      modificado: '2026-10-16T18:51:40+02:00',
      origen: 'pegado',
      hash: HASH,
      ocultados: 0,
      lector: { nombre: 'log', version: 1, resumen: { lineas: 11, errores: 3 } },
      ...cambios,
    },
    notas: 'El cliente lee el cuerpo entero. Ver [[CMP-0005]].',
    original:
      '2026-10-16T18:40:51.007Z INFO  gateway: request id=c19e0b77\n2026-10-16T18:41:21.014Z ERROR stream: read timeout',
  };
}

describe('sha256Hex', () => {
  it('coincide con los vectores de FIPS 180-2', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
    expect(sha256Hex('a'.repeat(1000))).toBe('41edece42d63e8d9bf515a9ba6932e1c20cbc9f5a5d134645adb5db1b9737ea3');
  });

  it('codifica en UTF-8', () => {
    expect([...utf8('ñ€😀')]).toEqual([0xc3, 0xb1, 0xe2, 0x82, 0xac, 0xf0, 0x9f, 0x98, 0x80]);
  });
});

describe('original', () => {
  it('normaliza finales de línea y espacios finales para el hash', () => {
    expect(normalizarOriginal('a  \r\nb\t\r\n\n')).toBe('a\nb');
    expect(hashOriginal('a\r\nb ')).toBe(hashOriginal('a\nb'));
    expect(hashOriginal('a\nb')).not.toBe(hashOriginal('a b'));
  });

  it('la cerca supera cualquier racha de acentos graves', () => {
    expect(cercaPara('sin código')).toBe('```');
    expect(cercaPara('```js\nx\n```')).toBe('````');
    expect(cercaPara('`````')).toBe('``````');
  });
});

describe('ulid', () => {
  it('es monotónico en el mismo milisegundo y codifica el tiempo', () => {
    const generar = crearGeneradorUlid(
      () => 1_760_000_000_000,
      () => 31,
    );
    const a = generar();
    const b = generar();
    expect(esUlid(a)).toBe(true);
    expect(b > a).toBe(true);
    expect(tiempoDeUlid(a)).toBe(1_760_000_000_000);
  });

  it('sigue creciendo aunque el reloj retroceda', () => {
    let t = 2000;
    const generar = crearGeneradorUlid(() => t);
    const a = generar();
    t = 1000;
    expect(generar() > a).toBe(true);
  });
});

describe('refs', () => {
  it('siguen al mayor de su prefijo y no mezclan DOC con DOC-MD', () => {
    expect(asignarRef('log', [])).toBe('LOG-0001');
    expect(asignarRef('log', ['LOG-0003', 'LOG-0041', 'ERR-0099'])).toBe('LOG-0042');
    expect(asignarRef('documento', ['DOC-MD-0004', 'DOC-0001'])).toBe('DOC-0002');
    expect(asignarRef('markdown', ['DOC-0007'])).toBe('DOC-MD-0001');
    expect(asignarRef('hilo', ['HIL-9999'])).toBe('HIL-10000');
  });
});

describe('nombres y rutas', () => {
  it('slug sin tildes ni emojis, con guiones y como mucho 60 caracteres', () => {
    expect(slug('Timeout en streaming con ureq')).toBe('timeout-en-streaming-con-ureq');
    expect(slug('Caché de embeddings: ¿sí o no? 🚀')).toBe('cache-de-embeddings-si-o-no');
    expect(slug('')).toBe('sin-titulo');
    expect(slug('🚀🔥')).toBe('sin-titulo');
    const largo = slug('palabra '.repeat(20));
    expect(largo.length).toBeLessThanOrEqual(60);
    expect(largo.endsWith('-')).toBe(false);
    expect(slug('a'.repeat(80))).toHaveLength(60);
  });

  it('nombre de archivo y ruta por el año y mes del propio texto ISO', () => {
    expect(nombreArchivo('LOG-0042', 'Timeout')).toBe('LOG-0042--timeout.md');
    // 23:30 del 31 de octubre en Madrid es 1 de noviembre en UTC: manda la fecha del usuario.
    expect(rutaElemento('LOG-0042', 'Timeout', '2026-10-31T23:30:00+01:00')).toBe(
      'elementos/2026/10/LOG-0042--timeout.md',
    );
    expect(rutaAdjunto('3fa2c9ab', '.LOG')).toBe('adjuntos/3f/3fa2c9ab.log');
    expect(rutaHistorial('PRM-0012', '2026-10-17T18:05:12+02:00')).toBe('historial/PRM-0012/2026-10-17T18-05-12.md');
  });
});

describe('elemento', () => {
  it('escribe el formato del Anexo B', () => {
    const texto = escribirElemento(elementoBase({ colecciones: ['gateway'], etiquetas: ['ureq', 'streaming'] }));
    expect(texto.startsWith('---\nid: 01JAB4C2Q2X8M5N7P0R4S6T8V0\nref: LOG-0042\ntipo: log\n')).toBe(true);
    expect(texto).toContain('colecciones: [gateway]');
    expect(texto).toContain('resumen: {lineas: 11, errores: 3}');
    expect(texto).toContain('\n---\n\nEl cliente lee el cuerpo entero. Ver [[CMP-0005]].\n\n```log\n2026-10-16');
    expect(texto.endsWith('read timeout\n```\n')).toBe(true);
  });

  it('lee y reescribe conservando claves desconocidas, orden y comentarios', () => {
    const previo = escribirElemento(elementoBase()).replace(
      'ocultados: 0\n',
      'ocultados: 0\n# nota a mano\nfuturo: { x: 1 }\n',
    );
    const leido = leerElemento(previo);
    expect(leido.ok).toBe(true);
    if (!leido.ok) return;
    expect(leido.valor.frontmatter.futuro).toEqual({ x: 1 });
    const nuevo = { ...leido.valor, frontmatter: { ...leido.valor.frontmatter, titulo: 'Otro título' } };
    const reescrito = escribirElemento(nuevo, previo);
    expect(reescrito).toContain('# nota a mano');
    expect(reescrito).toContain('futuro: {x: 1}');
    expect(reescrito).toContain('titulo: Otro título');
    expect(reescrito.indexOf('titulo:')).toBeLessThan(reescrito.indexOf('creado:'));
  });

  it('con adjunto no hay bloque original y las notas pueden acabar en código', () => {
    const el: Elemento = {
      ...elementoBase({ adjunto: { hash: 'a'.repeat(64), ruta: `adjuntos/aa/${'a'.repeat(64)}.log`, tam: 3_000_000 } }),
      notas: 'Mis notas\n\n```log\nno es el original\n```',
      original: null,
    };
    const leido = leerElemento(escribirElemento(el));
    expect(leido.ok && leido.valor).toEqual(el);
  });

  it('rechaza frontmatter inválido o ausente sin lanzar', () => {
    expect(leerElemento('sin frontmatter').ok).toBe(false);
    const r = leerElemento('---\nid: x\n---\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.codigo).toBe('formato.frontmatterInvalido');
  });

  it('propiedad: leer(escribir(x)) ≡ x', () => {
    const texto = fc.string({ unit: fc.constantFrom('a', 'ñ', ' ', '\n', '`', '#', '-', ':', '😀', '{', '\t') });
    const desconocido = fc.dictionary(
      fc.constantFrom('futuro', 'extra', 'importado', 'resultados'),
      fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.array(fc.string(), { maxLength: 3 })),
    );
    fc.assert(
      fc.property(
        fc.record({
          tipo: fc.constantFrom(...TIPOS_ELEMENTO),
          titulo: texto,
          notas: texto,
          original: fc.option(texto, { nil: null }),
          etiquetas: fc.option(fc.array(fc.string({ minLength: 1 }), { maxLength: 4 }), { nil: undefined }),
          fijado: fc.option(fc.boolean(), { nil: undefined }),
          extra: desconocido,
        }),
        (g) => {
          const base = elementoBase({ tipo: g.tipo, titulo: g.titulo });
          const fm: Elemento['frontmatter'] = { ...g.extra, ...base.frontmatter };
          if (g.etiquetas) fm.etiquetas = g.etiquetas;
          if (g.fijado !== undefined) fm.fijado = g.fijado;
          if (g.original === null) fm.adjunto = { hash: 'b'.repeat(64), ruta: 'adjuntos/bb/x', tam: 1 };
          const el: Elemento = { frontmatter: fm, notas: g.notas, original: g.original };
          const leido = leerElemento(escribirElemento(el));
          expect(leido.ok).toBe(true);
          if (leido.ok) expect(leido.valor).toEqual(el);
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('elemento: casos hostiles', () => {
  const raro = fc.oneof(
    fc.constantFrom(
      'null',
      'true',
      '123',
      '1e3',
      '- x',
      ': a',
      '#no',
      "'",
      '"',
      ' espacio ',
      '2026-10-16',
      '~',
      '---',
      '\r\n',
      '',
    ),
    fc.string(),
  );

  it('propiedad: títulos y textos que confunden a YAML, y reescribir sobre el archivo previo', () => {
    fc.assert(
      fc.property(raro, raro, fc.option(raro, { nil: null }), raro, (titulo, notas, original, nuevoTitulo) => {
        const base = elementoBase({ titulo });
        const el: Elemento = {
          frontmatter:
            original === null
              ? { ...base.frontmatter, adjunto: { hash: 'c'.repeat(64), ruta: 'x', tam: 0 } }
              : base.frontmatter,
          notas,
          original,
        };
        const texto = escribirElemento(el);
        const leido = leerElemento(texto);
        expect(leido.ok && leido.valor).toEqual(el);
        const cambiado = { ...el, frontmatter: { ...el.frontmatter, titulo: nuevoTitulo, etiquetas: ['a'] } };
        const otra = leerElemento(escribirElemento(cambiado, texto));
        expect(otra.ok && otra.valor).toEqual(cambiado);
      }),
      { numRuns: 400 },
    );
  });
});

describe('revisión de IN-004', () => {
  it('el prompt del Anexo B (sin modificado, origen, hash ni ocultados) se lee y se completa', () => {
    const md = [
      '---',
      'id: 01JAB5D7Q2X8M5N7P0R4S6T8V0',
      'ref: PRM-0012',
      'tipo: prompt',
      'titulo: Revisor de ADR',
      'creado: 2026-10-17T18:05:12+02:00',
      'version: 2',
      'colecciones: [prompts-revision]',
      'lector:',
      '  nombre: prompt',
      '  version: 1',
      '  resumen: { variables: [adr, contexto], tokens_aprox: 410, destino: "Claude" }',
      'resultados:',
      '  - fecha: 2026-10-17',
      '    valoracion: 4',
      '    nota: Detectó la falta de consecuencias negativas.',
      '    archivo: historial/PRM-0012/resultado-2026-10-17.md',
      '---',
      '',
      '```prompt',
      'Actúa como revisor de decisiones de arquitectura. Lee el ADR {{adr}} en el contexto {{contexto}}…',
      '```',
      '',
    ].join('\n');
    const r = leerElemento(md);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.frontmatter.modificado).toBe('2026-10-17T18:05:12+02:00');
    expect(r.valor.frontmatter.origen).toBe('importado');
    expect(r.valor.frontmatter.ocultados).toBe(0);
    expect(r.valor.frontmatter.hash).toBe(hashOriginal(r.valor.original ?? ''));
    expect(r.valor.frontmatter.version).toBe(2);
    expect(r.valor.frontmatter.resultados).toHaveLength(1);
  });

  it('el documento del Anexo B valida sin creado', () => {
    const doc = {
      id: '01JAB7F3Q2X8M5N7P0R4S6T8V0',
      ref: 'DOC-0002',
      tipo: 'documento',
      plantilla: 'adr',
      titulo: 'ADR-0012: Cliente HTTP del gateway de IA',
      investigacion: 'INV-0003',
      estado: 'borrador',
      cifras: { 'CMP-0004.cambio': { valor: '-4,6 %', fijado: '2026-10-17T19:10:00+02:00' } },
    };
    expect(v.safeParse(documentoSchema, doc).success).toBe(true);
  });

  it('reescribir conserva los comentarios de lo que cambia y el estilo de lo que no', () => {
    const previo = [
      'titulo: Viejo # comentario del título',
      'etiquetas:',
      '  - ureq # primera',
      '  - streaming',
      'lector:',
      '  nombre: log # c1',
      '  resumen: {lineas: 1}',
      '',
    ].join('\n');
    const nuevo = escribirYaml(
      { titulo: 'Nuevo', etiquetas: ['ureq', 'streaming'], lector: { nombre: 'log', resumen: { lineas: 2 } } },
      previo,
    );
    expect(nuevo).toContain('titulo: Nuevo # comentario del título');
    expect(nuevo).toContain('etiquetas:\n  - ureq # primera\n  - streaming');
    expect(nuevo).toContain('nombre: log # c1');
    expect(nuevo).toContain('resumen: {lineas: 2}');
  });

  it('un surrogate suelto se codifica como U+FFFD, como TextEncoder', () => {
    expect([...utf8('a\uD800b')]).toEqual([0x61, 0xef, 0xbf, 0xbd, 0x62]);
  });

  it('rechaza fechas imposibles o sin segundos y la ruta de historial no depende de ellos', () => {
    const fm = { ...elementoBase().frontmatter };
    expect(
      leerElemento(escribirElemento({ ...elementoBase(), frontmatter: { ...fm, creado: '2026-13-45T99:99:99Z' } })).ok,
    ).toBe(false);
    expect(
      leerElemento(escribirElemento({ ...elementoBase(), frontmatter: { ...fm, creado: '2026-10-17T18:05+02:00' } }))
        .ok,
    ).toBe(false);
    expect(
      leerElemento(escribirElemento({ ...elementoBase(), frontmatter: { ...fm, creado: '2026-02-30T10:00:00Z' } })).ok,
    ).toBe(false);
    expect(rutaHistorial('PRM-0012', '2026-10-17T18:05+02:00')).toBe('historial/PRM-0012/2026-10-17T18-05-00.md');
  });
});

describe('yaml', () => {
  it('separar acepta un frontmatter vacío y finales \\r\\n en los delimitadores', () => {
    expect(separar('---\n---\ncuerpo')).toEqual({ ok: true, valor: { yaml: '', cuerpo: 'cuerpo' } });
    expect(separar('---\r\na: 1\r\n---\r\nx').ok).toBe(true);
    expect(separar('---\na: 1\n').ok).toBe(false);
  });

  it('borra las claves que desaparecen', () => {
    expect(escribirYaml({ a: 1 }, 'a: 1\nb: 2 # adiós\n')).toBe('a: 1\n');
  });
});

describe('esquemas del Anexo B', () => {
  it('validan la investigación, el documento, una comparación y el manifest', () => {
    const inv = {
      id: '01JAB6E1Q2X8M5N7P0R4S6T8V0',
      ref: 'INV-0003',
      tipo: 'investigacion',
      titulo: 'Cliente HTTP del gateway de IA',
      pregunta: '¿Cambiamos reqwest por ureq para reducir dependencias sin perder fiabilidad?',
      estado: 'abierta',
      creado: '2026-10-16T17:00:00+02:00',
      elementos: [
        { ref: 'URL-0101', papel: 'contexto' },
        { ref: 'CMP-0004', papel: 'apoya', interpretacion: 'ureq es algo más rápido en peticiones de 64 KB' },
        { ref: 'CMP-0005', papel: 'contradice', interpretacion: '' },
      ],
      hipotesis: [{ texto: 'El timeout se debe a leer el cuerpo entero', estado: 'pendiente' }],
      decision: {
        opciones: ['reqwest', 'ureq'],
        criterios: [
          { nombre: 'Streaming fiable', peso: 4, puntuaciones: [5, 2], evidencia: ['CMP-0005'] },
          { nombre: 'Dependencias y compilación', peso: 3, puntuaciones: [2, 5], evidencia: ['URL-0101'] },
          { nombre: 'Rendimiento', peso: 3, puntuaciones: [3, 4], evidencia: ['CMP-0004'] },
        ],
      },
      conclusion: '',
    };
    expect(v.safeParse(investigacionSchema, inv).success).toBe(true);
    const doc = {
      id: '01JAB7F3Q2X8M5N7P0R4S6T8V0',
      ref: 'DOC-0002',
      tipo: 'documento',
      plantilla: 'adr',
      titulo: 'ADR-0012: Cliente HTTP del gateway de IA',
      investigacion: 'INV-0003',
      estado: 'borrador',
      creado: '2026-10-17T19:00:00+02:00',
      cifras: { 'CMP-0004.cambio': { valor: '-4,6 %', fijado: '2026-10-17T19:10:00+02:00' } },
    };
    expect(v.safeParse(documentoSchema, doc).success).toBe(true);
    const cmp = {
      id: ID,
      ref: 'CMP-0005',
      tipo: 'comparacion',
      titulo: 'Logs: buena frente a mala',
      clase: 'logs',
      creado: '2026-10-16T18:50:00+02:00',
      fuentes: ['LOG-0041', 'LOG-0042'],
      resultado: { divergencia: 4 },
    };
    expect(v.safeParse(comparacionSchema, cmp).success).toBe(true);
    const manifest = {
      formato: 'rimor',
      esquema: 1,
      espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Trabajo' },
      exportado: '2026-10-17T18:05:12+02:00',
      app: { version: '0.1.0' },
      recuentos: { elementos: 412, investigaciones: 3, documentos: 2, adjuntos: 37 },
      adjuntos_excluidos: [],
      hashes: { algoritmo: 'SHA-256', archivos: { 'elementos/2026/10/LOG-0042--timeout-streaming-ureq.md': '9b1c' } },
    };
    expect(v.safeParse(manifestSchema, manifest).success).toBe(true);
    expect(v.safeParse(manifestSchema, { ...manifest, formato: 'otro' }).success).toBe(false);
  });

  it('el log del Anexo B se lee como elemento', () => {
    const md = [
      '---',
      `id: ${ID}`,
      'ref: LOG-0042',
      'tipo: log',
      'titulo: Timeout en streaming con ureq',
      'creado: 2026-10-16T18:44:03+02:00',
      'modificado: 2026-10-16T18:51:40+02:00',
      'origen: pegado',
      'estado: resuelto',
      'colecciones: [gateway]',
      'investigaciones: [INV-0003]',
      'etiquetas: [ureq, streaming]',
      'sesion: 2026-10-16-tarde',
      `hash: ${HASH}`,
      'ocultados: 0',
      'lector:',
      '  nombre: log',
      '  version: 1',
      '  resumen: { lineas: 11, errores: 3, avisos: 3, plantillas: 9, desde: "18:40:51", hasta: "18:41:51" }',
      '---',
      '',
      'El cliente lee el cuerpo entero porque la respuesta no trae content-length. Ver [[CMP-0005]].',
      '',
      '```log',
      '2026-10-16T18:40:51.007Z INFO  gateway: request id=c19e0b77-… model=llama3.1:8b',
      '```',
      '',
    ].join('\n');
    const r = leerElemento(md);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valor.frontmatter.colecciones).toEqual(['gateway']);
    expect(r.valor.notas).toBe(
      'El cliente lee el cuerpo entero porque la respuesta no trae content-length. Ver [[CMP-0005]].',
    );
    expect(r.valor.original).toBe('2026-10-16T18:40:51.007Z INFO  gateway: request id=c19e0b77-… model=llama3.1:8b');
  });
});

describe('migrar', () => {
  const espacio = {
    manifest: {
      formato: 'rimor' as const,
      esquema: 1,
      espacio: { id: ID, nombre: 'Trabajo' },
      app: { version: '0.1.0' },
    },
    archivos: new Map([['a.md', 'x']]),
  };

  it('de 1 a 1 es la identidad', () => {
    const r = migrar(espacio, 1, 1);
    expect(r.ok && r.valor.archivos).toEqual(espacio.archivos);
  });

  it('rechaza esquemas futuros o no válidos', () => {
    expect(migrar(espacio, 2).ok).toBe(false);
    expect(migrar(espacio, 0).ok).toBe(false);
  });
});

describe('manifest y fechas (IN-007)', () => {
  const manifest = {
    formato: 'rimor',
    esquema: 1,
    espacio: { id: '01JABCDEFGHJKMNPQRSTVWXYZ0', nombre: 'Trabajo' },
    app: { version: '0.1.0' },
  };

  it('leerManifest acepta uno válido y rechaza JSON roto u otro formato', () => {
    expect(leerManifest(JSON.stringify(manifest))?.espacio.nombre).toBe('Trabajo');
    expect(leerManifest('{')).toBeNull();
    expect(leerManifest(JSON.stringify({ ...manifest, formato: 'otro' }))).toBeNull();
    expect(leerManifest('null')).toBeNull();
  });

  it('isoConZona escribe la hora local con su desfase y sin milisegundos', () => {
    const fecha = new Date(2026, 9, 18, 7, 5, 9, 123);
    const iso = isoConZona(fecha);
    expect(iso).toMatch(/^2026-10-18T07:05:09[+-]\d{2}:\d{2}$/);
    // La misma instantánea, leída de vuelta, sin los milisegundos.
    expect(new Date(iso).getTime()).toBe(fecha.getTime() - 123);
  });
});
