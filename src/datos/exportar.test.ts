import { leerYaml, unir } from '@rimor/formato';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { escribirTexto, leerTexto, listarTodo } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import {
  aBase64,
  type ExportacionJson,
  exportarJson,
  exportarZip,
  MAX_ADJUNTO_JSON,
  nombreExportacion,
  recuentosDe,
  sha256,
} from './exportar';
import { crc32, ErrorZip, entradasZip, leerEntrada, trozosDe } from './leerZip';

const AHORA = new Date('2026-10-22T18:05:12+02:00');
const O = { ahora: AHORA, version: '0.1.0', ceder: async () => undefined };

const MANIFEST = {
  formato: 'rimor',
  esquema: 1,
  espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Trabajo' },
  creado: '2026-10-01T10:00:00+02:00',
  app: { version: '0.0.9' },
  recuentos: { elementos: 0, investigaciones: 0, documentos: 0, adjuntos: 0 },
  adjuntos_excluidos: [],
};

const ELEMENTO = `---
id: 01JAB4C2Q2X8M5N7P0R0000001
ref: TXT-0001
tipo: texto
titulo: Timeout en streaming
---

Notas del elemento.

\`\`\`text
read timeout
\`\`\`
`;

async function espacio(archivos: Record<string, string | Uint8Array> = {}) {
  const a = new AlmacenMemoria();
  await escribirTexto(a, 'manifest.json', `${JSON.stringify(MANIFEST, null, 2)}\n`);
  for (const [ruta, datos] of Object.entries(archivos))
    if (typeof datos === 'string') await escribirTexto(a, ruta, datos);
    else await a.escribir(ruta, datos);
  return a;
}

const unirTrozos = (trozos: Uint8Array[]) => {
  const total = new Uint8Array(trozos.reduce((s, t) => s + t.length, 0));
  let i = 0;
  for (const t of trozos) {
    total.set(t, i);
    i += t.length;
  }
  return total;
};

/** Todas las entradas de un ZIP: ruta → bytes. */
async function leerZip(zip: Uint8Array): Promise<Map<string, Uint8Array>> {
  const { tam, leer } = trozosDe(zip);
  const salida = new Map<string, Uint8Array>();
  for (const e of await entradasZip(tam, leer)) salida.set(e.ruta, await leerEntrada(e, leer));
  return salida;
}

describe('exportar ZIP', () => {
  it('todo menos la caché y el diario; el texto comprimido y los adjuntos tal cual; el manifest al final', async () => {
    const adjunto = new Uint8Array(300_000).map((_, i) => (i * 7919) % 256);
    const a = await espacio({
      'elementos/2026/10/TXT-0001--timeout.md': ELEMENTO,
      'adjuntos/ab/abcd.bin': adjunto,
      'colecciones.json': '{"esquema":1,"colecciones":[]}\n',
      '.rimor/estado.json': '{}',
      '.rimor/cache/x': 'no',
      '.rimor/operacion.json': '{}',
      'papelera/2026/10/TXT-0002--borrado.md': ELEMENTO,
    });
    const { trozos, manifest, bytes } = await exportarZip(a, O);
    const zip = unirTrozos(trozos);
    expect(bytes).toBe(zip.length);
    const { tam, leer } = trozosDe(zip);
    const entradas = await entradasZip(tam, leer);
    expect(entradas.map((e) => e.ruta)).toEqual([
      '.rimor/estado.json',
      'adjuntos/ab/abcd.bin',
      'colecciones.json',
      'elementos/2026/10/TXT-0001--timeout.md',
      'papelera/2026/10/TXT-0002--borrado.md',
      'manifest.json',
    ]);
    expect(entradas.find((e) => e.ruta.startsWith('adjuntos/'))?.metodo).toBe(0);
    expect(entradas.find((e) => e.ruta.startsWith('elementos/'))?.metodo).toBe(8);
    const leido = await leerZip(zip);
    expect(leido.get('adjuntos/ab/abcd.bin')).toEqual(adjunto);

    // El manifest: el del espacio, con fecha, versión, recuentos y el hash de cada archivo.
    const enZip = JSON.parse(new TextDecoder().decode(leido.get('manifest.json')));
    expect(enZip).toEqual(manifest);
    expect(manifest).toMatchObject({
      espacio: MANIFEST.espacio,
      creado: MANIFEST.creado,
      exportado: '2026-10-22T18:05:12+02:00',
      app: { version: '0.1.0' },
      recuentos: { elementos: 1, adjuntos: 1, papelera: 1, comparaciones: 0, hilos: 0 },
      adjuntos_excluidos: [],
    });
    const archivos = manifest.hashes?.archivos ?? {};
    expect(Object.keys(archivos)).toHaveLength(5);
    for (const [ruta, hash] of Object.entries(archivos)) expect(hash).toBe(await sha256(leido.get(ruta) as Uint8Array));
  });

  it('avisa del progreso por bytes y se puede cancelar', async () => {
    const a = await espacio({ 'adjuntos/a.bin': new Uint8Array(600_000), 'elementos/a.md': ELEMENTO });
    const progreso: number[] = [];
    await exportarZip(a, { ...O, alProgreso: (p) => progreso.push(p.hechos / p.total) });
    expect(progreso[0]).toBe(0);
    expect(progreso.at(-1)).toBe(1);
    expect(progreso).toEqual([...progreso].sort((x, y) => x - y));
    const corte = new AbortController();
    corte.abort();
    await expect(exportarZip(a, { ...O, senal: corte.signal })).rejects.toThrow('cancelada');
  });

  it('sin manifest no se exporta', async () => {
    await expect(exportarZip(new AlmacenMemoria(), O)).rejects.toThrow('exportar.sinManifest');
  });

  it('nombre y recuentos', () => {
    expect(nombreExportacion('Trabajo', AHORA, 'zip')).toBe('rimor-trabajo-2026-10-22.zip');
    expect(nombreExportacion('Pruebas de Struo', AHORA, 'json')).toBe('rimor-pruebas-de-struo-2026-10-22.json');
    expect(nombreExportacion('!!', AHORA, 'zip', 'antes de vaciar')).toBe(
      'rimor-espacio-2026-10-22-antes-de-vaciar.zip',
    );
    expect(
      recuentosDe(['elementos/a.md', 'elementos/b.md', 'hilos/h.md', 'adjuntos/x', 'documentos/d/a.md']),
    ).toMatchObject({
      elementos: 2,
      hilos: 1,
      adjuntos: 1,
      documentos: 1,
    });
  });
});

describe('ida y vuelta (propiedad)', () => {
  /** Rutas válidas en las carpetas del espacio. */
  // Con acentos, CJK y emoji: los nombres no ASCII viajan con su bandera UTF-8.
  const segmento = fc.oneof(
    fc.stringMatching(/^[a-z0-9][a-z0-9_-]{0,11}$/),
    fc.constantFrom('ñandú', 'canción-1', '日本語', 'émoji-🦤', 'Ωmega'),
  );
  const carpeta = fc.constantFrom(
    'elementos/2026/10',
    'adjuntos/ab',
    'hilos',
    'historial/TXT-0001',
    'papelera/2026/10/muy/profunda',
    '.rimor',
  );
  const archivo = fc.record({
    ruta: fc.tuple(carpeta, segmento, fc.constantFrom('.md', '.json', '.bin')).map(([c, s, e]) => `${c}/${s}${e}`),
    datos: fc.oneof(
      fc.string({ unit: 'binary', maxLength: 3000 }).map((s) => new TextEncoder().encode(s)),
      fc.uint8Array({ maxLength: 5000 }),
      fc.constant(new Uint8Array(0)),
    ),
  });

  it('exportar → leer en un espacio vacío → exportar da los mismos archivos byte a byte', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(archivo, { selector: (x) => x.ruta, maxLength: 12 }), async (lista) => {
        const a = await espacio(Object.fromEntries(lista.map((x) => [x.ruta, x.datos])));
        const primero = await leerZip(unirTrozos((await exportarZip(a, O)).trozos));
        const b = new AlmacenMemoria();
        for (const [ruta, datos] of primero) await b.escribir(ruta, datos);
        const segundo = await leerZip(unirTrozos((await exportarZip(b, O)).trozos));
        expect([...segundo.keys()]).toEqual([...primero.keys()]);
        for (const [ruta, datos] of primero) expect(segundo.get(ruta), ruta).toEqual(datos);
        // Y son los del espacio.
        for (const { ruta, datos } of lista) expect(primero.get(ruta), ruta).toEqual(datos);
      }),
      { numRuns: 60 },
    );
  });
});

describe('límites y tiempos', () => {
  it('más archivos de los que admite un ZIP sin ZIP64: se corta antes de leer nada', async () => {
    let leidos = 0;
    const enorme = {
      leer: async (ruta: string) => {
        leidos++;
        return ruta === 'manifest.json' ? new TextEncoder().encode(JSON.stringify(MANIFEST)) : new Uint8Array(1);
      },
      async *listar() {
        yield { ruta: 'manifest.json', tam: 10, modificado: 0 };
        for (let i = 0; i < 0xffff; i++) yield { ruta: `historial/x/${i}.md`, tam: 1, modificado: 0 };
      },
    };
    await expect(exportarZip(enorme, O)).rejects.toThrow('exportar.demasiadoGrande');
    expect(leidos).toBe(1);
  });

  it('cede el hilo de vez en cuando, no en cada archivo', async () => {
    const archivos = Object.fromEntries(Array.from({ length: 300 }, (_, i) => [`hilos/h${i}.md`, `hilo ${i}`]));
    const a = await espacio(archivos);
    let cesiones = 0;
    await exportarZip(a, { ...O, ceder: async () => void cesiones++ });
    expect(cesiones).toBeLessThan(30);
  });
});

describe('exportar JSON', () => {
  it('elementos con frontmatter y cuerpo que reconstruyen el archivo; adjuntos de hasta 1 MB; los demás, excluidos', async () => {
    const pequeno = new Uint8Array([0, 1, 2, 250]);
    const a = await espacio({
      'elementos/2026/10/TXT-0001--timeout.md': ELEMENTO,
      'elementos/2026/10/raro.md': 'sin frontmatter',
      'adjuntos/aa/pequeno.png': pequeno,
      'adjuntos/bb/grande.bin': new Uint8Array(MAX_ADJUNTO_JSON + 1),
      'hilos/HIL-0001.md': '---\nid: x\n---\n',
      '.rimor/raro.bin': new Uint8Array([0xff, 0xfe, 0x00]),
    });
    const { texto, manifest, excluidos } = await exportarJson(a, O);
    const json = JSON.parse(texto) as ExportacionJson;
    expect(excluidos).toEqual(['adjuntos/bb/grande.bin']);
    expect(json.manifest.adjuntos_excluidos).toEqual(['adjuntos/bb/grande.bin']);
    expect(json.manifest).toEqual(manifest);
    expect(Object.keys(json.manifest.hashes?.archivos ?? {})).not.toContain('adjuntos/bb/grande.bin');
    expect(json.manifest.recuentos).toMatchObject({ adjuntos: 2, elementos: 2 });

    expect(json.elementos).toHaveLength(1);
    const [el] = json.elementos;
    expect(el?.frontmatter).toMatchObject({ ref: 'TXT-0001', titulo: 'Timeout en streaming' });
    expect(unir(el?.yaml ?? '', el?.cuerpo ?? '')).toBe(ELEMENTO);
    expect(leerYaml(el?.yaml ?? '').ok).toBe(true);

    expect(json.adjuntos).toEqual([{ ruta: 'adjuntos/aa/pequeno.png', base64: aBase64(pequeno) }]);
    expect(json.archivos).toEqual([
      { ruta: '.rimor/raro.bin', base64: aBase64(new Uint8Array([0xff, 0xfe, 0x00])) },
      { ruta: 'elementos/2026/10/raro.md', texto: 'sin frontmatter' },
      { ruta: 'hilos/HIL-0001.md', texto: '---\nid: x\n---\n' },
    ]);
  });

  it('un archivo de texto con BOM conserva el BOM (y su hash casa)', async () => {
    const conBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('{"a":1}')]);
    const a = await espacio({ 'colecciones.json': conBom });
    const json = JSON.parse((await exportarJson(a, O)).texto) as ExportacionJson;
    const archivo = json.archivos.find((x) => x.ruta === 'colecciones.json');
    expect(archivo && 'texto' in archivo && new TextEncoder().encode(archivo.texto)).toEqual(conBom);
    expect(json.manifest.hashes?.archivos['colecciones.json']).toBe(await sha256(conBom));
  });

  it('base64 de algo grande sin desbordar la pila', () => {
    const grande = new Uint8Array(500_000).fill(65);
    expect(atob(aBase64(grande))).toHaveLength(500_000);
  });
});

describe('leer un ZIP', () => {
  it('rechaza lo que no es un ZIP, uno truncado, un CRC que no casa y más datos de los declarados', async () => {
    const a = await espacio({ 'elementos/a.md': ELEMENTO });
    const zip = unirTrozos((await exportarZip(a, O)).trozos);
    const fallo = async (bytes: Uint8Array) => {
      try {
        await leerZip(bytes);
        return 'sin error';
      } catch (e) {
        return e instanceof ErrorZip ? e.codigo : String(e);
      }
    };
    expect(await fallo(new Uint8Array(10))).toBe('zip.noEsZip');
    expect(await fallo(new TextEncoder().encode('x'.repeat(100)))).toBe('zip.noEsZip');
    expect(await fallo(zip.slice(200))).toMatch(/zip\.(truncado|directorioRoto|entradaRota|noEsZip)/);
    // Un byte cambiado dentro de los datos comprimidos de la primera entrada.
    const tocado = zip.slice();
    const datos = 30 + ((zip[26] ?? 0) | ((zip[27] ?? 0) << 8)) + ((zip[28] ?? 0) | ((zip[29] ?? 0) << 8));
    tocado[datos + 3] = (tocado[datos + 3] ?? 0) ^ 0xff;
    expect(await fallo(tocado)).toMatch(/zip\.(crc|entradaRota|tamanoDistinto|tamanoMayor)/);
    expect(await leerTexto(a, 'elementos/a.md')).toBe(ELEMENTO);
  });

  it('crc32 conocido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('las rutas listadas del almacén de prueba', async () => {
    const a = await espacio({ 'elementos/a.md': ELEMENTO });
    expect((await listarTodo(a)).map((e) => e.ruta).sort()).toEqual(['elementos/a.md', 'manifest.json']);
  });
});
