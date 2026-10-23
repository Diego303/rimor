import { type Elemento, escribirElemento, leerElemento, rutaElemento } from '@rimor/formato';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { escribirTexto, leerTexto, listarTodo } from '../../almacen/contrato';
import { AlmacenMemoria } from '../../almacen/memoria';
import { elementoFalso } from '../../lectores/pruebas/falsos';
import { exportarJson, exportarZip, sha256 } from '../exportar';
import { enEspacioNuevo, fusionar, manifestNuevo, reemplazar } from './aplicar';
import { ErrorImportar, leerPaquete } from './paquete';
import { type EspacioLocal, planear, reescribirRefs } from './plan';

const EXPORTADO = new Date('2026-10-15T12:00:00+02:00');
const O = { ahora: EXPORTADO, version: '0.1.0', ceder: async () => undefined };
const MANIFEST = {
  formato: 'rimor',
  esquema: 1,
  espacio: { id: '01JAB3K9Q2X8M5N7P0R4S6T8V0', nombre: 'Trabajo' },
  app: { version: '0.1.0' },
};

function el(n: number, cambios: Partial<Elemento['frontmatter']> = {}, notas = '', original = `texto ${n}`): Elemento {
  const base = elementoFalso(n, original, 'texto');
  return { ...base, notas, frontmatter: { ...base.frontmatter, ...cambios } };
}
const ruta = (e: Elemento) => rutaElemento(e.frontmatter.ref, e.frontmatter.titulo, e.frontmatter.creado);
const md = (e: Elemento) => escribirElemento(e);

async function espacio(elementos: Elemento[], otros: Record<string, string | Uint8Array> = {}) {
  const a = new AlmacenMemoria();
  await escribirTexto(a, 'manifest.json', JSON.stringify(MANIFEST));
  for (const e of elementos) await escribirTexto(a, ruta(e), md(e));
  for (const [r, d] of Object.entries(otros))
    if (typeof d === 'string') await escribirTexto(a, r, d);
    else await a.escribir(r, d);
  return a;
}

const unirTrozos = (trozos: Uint8Array[]) => {
  const t = new Uint8Array(trozos.reduce((s, x) => s + x.length, 0));
  let i = 0;
  for (const x of trozos) {
    t.set(x, i);
    i += x.length;
  }
  return t;
};
const zipDe = async (a: AlmacenMemoria) => unirTrozos((await exportarZip(a, O)).trozos);

/** Lo que el plan necesita de un almacén de prueba. */
async function localDe(a: AlmacenMemoria): Promise<EspacioLocal> {
  const elementos = [];
  for (const { ruta: r } of await listarTodo(a, ''))
    if (/^(papelera\/)?elementos\/.+\.md$/.test(r)) {
      const leido = leerElemento((await leerTexto(a, r)) ?? '');
      if (leido.ok) {
        const fm = leido.valor.frontmatter;
        elementos.push({ id: fm.id, ref: fm.ref, alias: fm.alias ?? [], ruta: r, modificado: fm.modificado });
      }
    }
  return { elementos, entidades: [], leer: (r) => a.leer(r) };
}

/** Todo lo del almacén, ruta → texto, para comparar espacios. */
async function volcado(a: AlmacenMemoria): Promise<Record<string, string>> {
  const salida: Record<string, string> = {};
  for (const { ruta: r } of await listarTodo(a, '')) salida[r] = (await leerTexto(a, r)) ?? '';
  return salida;
}

const rechazo = async (bytes: Uint8Array, nombre = 'x.zip') => {
  try {
    await leerPaquete(bytes, nombre);
    return 'sin error';
  } catch (e) {
    return e instanceof ErrorImportar ? `${e.codigo}${e.ruta ? ` ${e.ruta}` : ''}` : `otro: ${String(e)}`;
  }
};

const enc = (s: string) => new TextEncoder().encode(s);

/** Un ZIP con un manifest cuyos hashes casan con sus archivos (para que solo falle la regla que se prueba). */
async function zipConManifest(archivos: Record<string, Uint8Array>, extra: Record<string, unknown> = {}) {
  const hashes: Record<string, string> = {};
  for (const [r, d] of Object.entries(archivos)) hashes[r] = await sha256(d);
  const manifest = {
    ...MANIFEST,
    exportado: '2026-10-15T12:00:00+02:00',
    hashes: { algoritmo: 'SHA-256', archivos: hashes },
    ...extra,
  };
  return zipSync({ ...archivos, 'manifest.json': enc(JSON.stringify(manifest)) });
}

describe('leer un paquete: lo malicioso se rechaza con su regla y su archivo', () => {
  it('un ZIP exportado y su JSON dan los mismos archivos', async () => {
    const a = await espacio([el(1), el(2, {}, 'nota con TXT-0001')], {
      'adjuntos/aa/x.bin': new Uint8Array([1, 2, 3]),
    });
    const zip = await leerPaquete(await zipDe(a), 'rimor-trabajo.zip');
    const json = await leerPaquete(enc((await exportarJson(a, O)).texto), 'rimor-trabajo.json');
    expect(zip.origen).toBe('zip');
    expect(json.origen).toBe('json');
    expect([...json.archivos.keys()].sort()).toEqual([...zip.archivos.keys()].sort());
    for (const [r, d] of zip.archivos) expect(json.archivos.get(r), r).toEqual(d);
    expect(zip.archivos.has('manifest.json')).toBe(false);
    expect(zip.avisos).toEqual([]);
  });

  it('el corpus: zip slip, absolutas, enlaces, bomba, repetidas, hashes, sobrantes, manifest y esquemas', async () => {
    const bueno = md(el(1));
    expect(await rechazo(await zipConManifest({ '../fuera.md': enc('x') }))).toBe('zip.rutaInsegura ../fuera.md');
    expect(await rechazo(await zipConManifest({ '/etc/passwd': enc('x') }))).toBe('zip.rutaInsegura /etc/passwd');
    const enlace = zipSync({
      'manifest.json': enc(JSON.stringify(MANIFEST)),
      'elementos/enlace.md': [enc('/etc/passwd'), { os: 3, attrs: 0o120777 << 16 }],
    });
    expect(await rechazo(enlace)).toBe('zip.enlace elementos/enlace.md');
    // La bomba: declara 10 bytes y trae megas.
    const bomba = zipSync({
      'manifest.json': enc(JSON.stringify(MANIFEST)),
      'adjuntos/b.bin': new Uint8Array(8 << 20),
    });
    for (let i = 0; i + 4 <= bomba.length; i++)
      if (
        bomba[i] === 0x50 &&
        bomba[i + 1] === 0x4b &&
        bomba[i + 2] === 1 &&
        bomba[i + 3] === 2 &&
        bomba[i + 46] === 0x61
      ) {
        bomba.set([10, 0, 0, 0], i + 24);
      }
    expect(await rechazo(bomba)).toBe('zip.tamanoMayor adjuntos/b.bin');
    // Un archivo cambiado tras exportar, uno que el manifest no lista, uno que falta.
    const hashes = { 'elementos/a.md': await sha256(enc(bueno)) };
    const conManifest = (archivos: Record<string, Uint8Array>, h: Record<string, string>) =>
      zipSync({
        ...archivos,
        'manifest.json': enc(JSON.stringify({ ...MANIFEST, hashes: { algoritmo: 'SHA-256', archivos: h } })),
      });
    expect(await rechazo(conManifest({ 'elementos/a.md': enc(`${bueno}cambio`) }, hashes))).toBe(
      'importar.hash elementos/a.md',
    );
    expect(await rechazo(conManifest({ 'elementos/a.md': enc(bueno), 'colado.md': enc('x') }, hashes))).toBe(
      'importar.sobra colado.md',
    );
    expect(await rechazo(conManifest({}, hashes))).toBe('importar.falta elementos/a.md');
    // El manifest: falta, es de otro formato o de un esquema futuro.
    expect(await rechazo(zipSync({ 'elementos/a.md': enc(bueno) }))).toBe('importar.sinManifest');
    expect(await rechazo(await zipConManifest({}, { formato: 'otro' }))).toBe('importar.manifest manifest.json');
    expect(await rechazo(await zipConManifest({}, { esquema: 99 }))).toBe('importar.esquemaNuevo manifest.json');
    // Esquemas: un elemento sin frontmatter válido y un registro de colecciones roto.
    expect(await rechazo(await zipConManifest({ 'elementos/malo.md': enc('---\nid: 1\n---\n') }))).toBe(
      'importar.elemento elementos/malo.md',
    );
    expect(await rechazo(await zipConManifest({ 'colecciones.json': enc('{') }))).toBe(
      'importar.colecciones colecciones.json',
    );
    // Ni un ZIP ni un JSON.
    expect(await rechazo(enc('hola'), 'x.zip')).toBe('zip.noEsZip');
    expect(await rechazo(enc('{roto'), 'x.json')).toBe('importar.jsonRoto');
    expect(
      await rechazo(
        enc(JSON.stringify({ manifest: MANIFEST, elementos: [{ ruta: '../x.md', yaml: '', cuerpo: '' }] })),
        'x.json',
      ),
    ).toBe('zip.rutaInsegura ../x.md');
  });

  it('un manifest sin hashes (hecho a mano) se importa con aviso', async () => {
    const p = await leerPaquete(
      zipSync({ 'manifest.json': enc(JSON.stringify(MANIFEST)), 'elementos/a.md': enc(md(el(1))) }),
      'x.zip',
    );
    expect(p.avisos).toEqual(['importar.sinHashes']);
    expect([...p.archivos.keys()]).toEqual(['elementos/a.md']);
  });
});

describe('plan', () => {
  it('nuevos, idénticos, actualizados y en conflicto; el perdedor va al historial', async () => {
    // El paquete se exportó el 15; aquí, el 3 cambió el 14 (antes) y el 4 el 16 (después: los dos cambiaron).
    const aquiAntes = el(3, { titulo: 'Tres', modificado: '2026-10-14T10:00:00+02:00' });
    const aquiDespues = el(4, { titulo: 'Cuatro aquí', modificado: '2026-10-16T10:00:00+02:00' });
    const local = await espacio([el(1), aquiAntes, aquiDespues]);
    const delPaquete = [
      el(1),
      el(2, { titulo: 'Nuevo' }),
      el(3, { titulo: 'Tres', modificado: '2026-10-15T09:00:00+02:00' }, 'nota del paquete'),
      el(4, { titulo: 'Cuatro allí', modificado: '2026-10-15T08:00:00+02:00' }),
    ];
    const paquete = await espacio(delPaquete);
    const p = await leerPaquete(await zipDe(paquete), 'x.zip');
    const plan = await planear(p.archivos, p.manifest, await localDe(local));
    expect(plan.recuentos).toEqual({ nuevo: 1, identico: 1, actualizado: 1, conflicto: 1 });
    expect(plan.elementos.find((c) => c.ref === 'TXT-0003')).toMatchObject({
      categoria: 'actualizado',
      ganador: 'paquete',
    });
    expect(plan.elementos.find((c) => c.ref === 'TXT-0004')).toMatchObject({ categoria: 'conflicto', ganador: 'aqui' });

    await fusionar(local, plan);
    const despues = await volcado(local);
    // El nuevo, el actualizado del paquete (con el de aquí al historial) y el conflicto se queda el de aquí.
    expect(despues[ruta(el(2, { titulo: 'Nuevo' }))]).toBe(md(el(2, { titulo: 'Nuevo' })));
    expect(despues[ruta(aquiAntes)]).toContain('nota del paquete');
    expect(despues['historial/TXT-0003/2026-10-14T10-00-00.md']).toBe(md(aquiAntes));
    expect(despues[ruta(aquiDespues)]).toBe(md(aquiDespues));
    expect(despues['historial/TXT-0004/2026-10-15T08-00-00.md']).toContain('Cuatro allí');
  });

  it('un nuevo cuya ref ya se usa aquí recibe otra, con la vieja en alias, sus menciones y su historial', async () => {
    const local = await espacio([el(1, { id: '01JAB4C2Q2X8M5N7P0RZZZZ001' as never, titulo: 'De aquí' })]);
    const suyo = el(1, { titulo: 'Del paquete' }, 'Ver TXT-0001 y TXT-0002; no TXT-00010.');
    const otro = el(2, {}, 'Relacionado con TXT-0001.');
    const paquete = await espacio([suyo, otro], { 'historial/TXT-0001/2026-10-10T10-00-00.md': md(suyo) });
    const p = await leerPaquete(await zipDe(paquete), 'x.zip');
    const plan = await planear(p.archivos, p.manifest, await localDe(local));
    expect(plan.reasignadas).toEqual([{ de: 'TXT-0001', a: 'TXT-0003' }]);
    await fusionar(local, plan);
    const despues = await volcado(local);
    const reasignado = leerElemento(despues[rutaElemento('TXT-0003', 'Del paquete', suyo.frontmatter.creado)] ?? '');
    expect(reasignado.ok && reasignado.valor.frontmatter).toMatchObject({ ref: 'TXT-0003', alias: ['TXT-0001'] });
    expect(reasignado.ok && reasignado.valor.notas).toBe('Ver TXT-0003 y TXT-0002; no TXT-00010.');
    expect(despues[ruta(otro)]).toContain('Relacionado con TXT-0003.');
    expect(despues['historial/TXT-0003/2026-10-10T10-00-00.md']).toBeDefined();
    // Lo de aquí, intacto.
    expect(despues[ruta(el(1, { titulo: 'De aquí' }))]).toContain('De aquí');
  });

  it('reescribir refs: palabras enteras, de una pasada', () => {
    const cambios = new Map([
      ['TXT-0001', 'TXT-0002'],
      ['TXT-0002', 'TXT-0003'],
    ]);
    expect(reescribirRefs('TXT-0001, TXT-0002, XTXT-0001, TXT-00011, LOG-TXT-0001', cambios)).toBe(
      'TXT-0002, TXT-0003, XTXT-0001, TXT-00011, LOG-TXT-0001',
    );
  });

  it('adjuntos e historial se suman; colecciones se juntan; lo de este navegador se queda', async () => {
    const local = await espacio([el(1)], {
      'colecciones.json': JSON.stringify({
        esquema: 1,
        colecciones: [{ id: 'gateway', nombre: 'gateway', orden: 0, creado: '2026-10-01T10:00:00+02:00' }],
      }),
      '.rimor/ajustes.json': '{"aqui":true}',
    });
    const paquete = await espacio([el(1)], {
      'adjuntos/aa/x.bin': new Uint8Array([9]),
      'colecciones.json': JSON.stringify({
        esquema: 1,
        colecciones: [
          { id: 'api', nombre: 'api', orden: 0, creado: '2026-10-01T10:00:00+02:00' },
          { id: 'gateway', nombre: 'gateway', orden: 1, creado: '2026-10-01T10:00:00+02:00' },
        ],
      }),
      '.rimor/ajustes.json': '{"alli":true}',
    });
    const p = await leerPaquete(await zipDe(paquete), 'x.zip');
    await fusionar(local, await planear(p.archivos, p.manifest, await localDe(local)));
    const despues = await volcado(local);
    expect(despues['adjuntos/aa/x.bin']).toBeDefined();
    expect(
      JSON.parse(despues['colecciones.json'] ?? '{}').colecciones.map((c: { id: string; orden: number }) => [
        c.id,
        c.orden,
      ]),
    ).toEqual([
      ['gateway', 0],
      ['api', 1],
    ]);
    expect(despues['.rimor/ajustes.json']).toBe('{"aqui":true}');
    expect(despues['manifest.json']).toBe(JSON.stringify(MANIFEST));
  });
});

describe('modos', () => {
  it('reemplazar: queda lo del paquete; lo de aquí que no viene, fuera; manifest y .rimor se quedan', async () => {
    const local = await espacio([el(1), el(5, { titulo: 'Solo aquí' })], { '.rimor/estado.json': '{"aqui":1}' });
    const paquete = await espacio([el(1, {}, 'del paquete'), el(2)], { '.rimor/estado.json': '{"alli":1}' });
    const p = await leerPaquete(await zipDe(paquete), 'x.zip');
    await reemplazar(local, p);
    const despues = await volcado(local);
    expect(Object.keys(despues).sort()).toEqual(
      ['.rimor/estado.json', 'manifest.json', ruta(el(2)), ruta(el(1))].sort(),
    );
    expect(despues[ruta(el(1))]).toContain('del paquete');
    expect(despues['.rimor/estado.json']).toBe('{"aqui":1}');
  });

  it('espacio nuevo: todo lo del paquete con su manifest (id nuevo y «(importado)»)', async () => {
    const paquete = await espacio([el(1)], { '.rimor/ajustes.json': '{"alli":true}' });
    const p = await leerPaquete(await zipDe(paquete), 'x.zip');
    const nuevo = new AlmacenMemoria();
    const manifest = manifestNuevo(p.manifest, 'Trabajo (importado)', new Date('2026-10-22T10:00:00+02:00'), 'NUEVO');
    await enEspacioNuevo(nuevo, p, manifest);
    const despues = await volcado(nuevo);
    expect(Object.keys(despues).sort()).toEqual(['.rimor/ajustes.json', 'manifest.json', ruta(el(1))].sort());
    expect(JSON.parse(despues['manifest.json'] ?? '{}')).toMatchObject({
      espacio: { id: 'NUEVO', nombre: 'Trabajo (importado)' },
      creado: '2026-10-22T10:00:00+02:00',
    });
    expect(JSON.parse(despues['manifest.json'] ?? '{}').hashes).toBeUndefined();
  });
});
