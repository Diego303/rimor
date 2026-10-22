import { describe, expect, it } from 'vitest';
import { claveIndice, type DocumentoBusqueda, MAX_INDEXADO } from './contrato';
import { apiIndice, IndiceBusqueda, VERSION_INDICE } from './indice';

function doc(id: string, cambios: Partial<DocumentoBusqueda> = {}): DocumentoBusqueda {
  return { id, titulo: '', ref: '', etiquetas: '', notas: '', cuerpo: '', indexable: '', ...cambios };
}

function indice(...docs: DocumentoBusqueda[]): IndiceBusqueda {
  const i = new IndiceBusqueda();
  i.poner(docs.map((d) => ({ doc: d, clave: `c-${d.id}` })));
  return i;
}

const ids = (i: IndiceBusqueda, ...palabras: string[]) => i.buscar(palabras).map((a) => a.id);

describe('índice de búsqueda', () => {
  it('busca en todos los campos, sin acentos ni mayúsculas, con todas las palabras', () => {
    const i = indice(
      doc('a', { titulo: 'Timeout en streaming' }),
      doc('b', { ref: 'ERR-0003' }),
      doc('c', { etiquetas: 'ureq staging' }),
      doc('d', { notas: 'Pasó con la Canción' }),
      doc('e', { cuerpo: 'thread main panicked at read body' }),
      doc('f', { indexable: 'StreamHandler connect' }),
    );
    expect(ids(i, 'timeout')).toEqual(['a']);
    expect(ids(i, 'err', '0003')).toEqual(['b']);
    expect(ids(i, 'UREQ')).toEqual(['c']);
    expect(ids(i, 'cancion')).toEqual(['d']);
    expect(ids(i, 'panicked', 'body')).toEqual(['e']);
    expect(ids(i, 'streamhandler')).toEqual(['f']);
    expect(ids(i, 'timeout', 'body')).toEqual([]);
  });

  it('difuso solo en palabras de más de 3 letras y prefijo solo en la última (con 2 letras o más)', () => {
    const i = indice(doc('a', { titulo: 'timeout gateway' }), doc('b', { titulo: 'gato' }));
    expect(ids(i, 'timeot')).toEqual(['a']);
    expect(ids(i, 'gto')).toEqual([]);
    expect(ids(i, 'gat')).toEqual(expect.arrayContaining(['a', 'b']));
    expect(ids(i, 'g')).toEqual([]);
    // «time» no es prefijo si no es la última palabra; «timeou» con difuso sí casa.
    expect(ids(i, 'tim', 'gateway')).toEqual([]);
    expect(ids(i, 'gateway', 'tim')).toEqual(['a']);
  });

  it('el título, la ref y las etiquetas pesan más que el contenido; «coincide dentro» si solo casa ahí', () => {
    const i = indice(doc('cuerpo', { cuerpo: 'timeout' }), doc('titulo', { titulo: 'timeout' }));
    const r = i.buscar(['timeout']);
    expect(r.map((a) => a.id)).toEqual(['titulo', 'cuerpo']);
    expect(r.map((a) => a.enContenido)).toEqual([false, true]);
    expect(r[0]?.terminos).toEqual(['timeout']);
  });

  it('solo los primeros 4 KB del cuerpo y de lo derivado', () => {
    const relleno = 'x '.repeat(MAX_INDEXADO / 2);
    const i = indice(doc('a', { cuerpo: `${relleno} tardio` }), doc('b', { indexable: `pronto ${relleno}` }));
    expect(ids(i, 'tardio')).toEqual([]);
    expect(ids(i, 'pronto')).toEqual(['b']);
  });

  it('poner reemplaza, quitar quita; conPalabras sin difuso ni prefijo', () => {
    const i = indice(doc('a', { titulo: 'uno' }), doc('b', { titulo: 'dos' }));
    i.poner([{ doc: doc('a', { titulo: 'tres' }), clave: 'otra' }]);
    expect(ids(i, 'uno')).toEqual([]);
    expect(ids(i, 'tres')).toEqual(['a']);
    i.quitar(['b', 'no-existe']);
    expect(ids(i, 'dos')).toEqual([]);
    expect(i.tamano).toBe(1);
    expect(i.todasLasClaves()).toEqual([['a', 'otra']]);
    const j = indice(doc('a', { titulo: 'timeout' }));
    expect(j.conPalabras(['timeot'])).toEqual([]);
    expect(j.conPalabras(['time'])).toEqual([]);
    expect(j.conPalabras(['timeout'])).toEqual(['a']);
    // Excluir en la misma pasada: tal cual (sin difuso ni prefijo).
    const k = indice(doc('a', { titulo: 'timeout staging' }), doc('b', { titulo: 'timeout prod' }));
    expect(k.buscar(['timeout'], ['staging']).map((a) => a.id)).toEqual(['b']);
    expect(
      k
        .buscar(['timeout'], ['stag'])
        .map((a) => a.id)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(k.buscar(['timeout'], ['prod', 'staging'])).toEqual([]);
  });

  it('exportar y cargar; uno de otra versión o ilegible no se carga', async () => {
    const i = indice(doc('a', { titulo: 'timeout' }), doc('b', { notas: 'gateway' }));
    i.quitar(['b']);
    const copia = await IndiceBusqueda.cargar(i.exportar());
    expect(copia && ids(copia, 'timeout')).toEqual(['a']);
    expect(copia?.todasLasClaves()).toEqual([['a', 'c-a']]);
    const otra = JSON.parse(i.exportar());
    expect(await IndiceBusqueda.cargar(JSON.stringify({ ...otra, version: VERSION_INDICE + 1 }))).toBeNull();
    expect(await IndiceBusqueda.cargar(JSON.stringify({ ...otra, claves: {} }))).toBeNull();
    expect(await IndiceBusqueda.cargar('{')).toBeNull();
    expect(await IndiceBusqueda.cargar('null')).toBeNull();
  });

  it('la interfaz asíncrona (la del Worker) carga vacío si lo guardado no vale', async () => {
    const api = apiIndice();
    await api.poner([{ doc: doc('a', { titulo: 'uno' }), clave: 'k' }]);
    const json = await api.exportar();
    expect(await api.cargar('roto')).toBe(false);
    expect(await api.claves()).toEqual([]);
    expect(await api.cargar(json)).toBe(true);
    expect((await api.buscar(['uno'])).map((a) => a.id)).toEqual(['a']);
  });

  it('la clave cambia con el original, la edición, el lector, el título o las etiquetas; no con las colecciones', () => {
    const fm = {
      modificado: '2026-10-18T10:00:00+02:00',
      hash: 'sha256:aa',
      ref: 'TXT-0001',
      titulo: 'Uno',
      etiquetas: ['a'],
      lector: { nombre: 'texto', version: 1 },
      colecciones: ['gateway'],
    };
    const base = claveIndice(fm);
    const otraColeccion = { ...fm, colecciones: ['otra'] };
    expect(claveIndice(otraColeccion)).toBe(base);
    for (const cambio of [
      { hash: 'sha256:bb' },
      { modificado: '2026-10-19T10:00:00+02:00' },
      { lector: { nombre: 'texto', version: 2 } },
      { titulo: 'Dos' },
      { etiquetas: ['a', 'b'] },
    ])
      expect(claveIndice({ ...fm, ...cambio })).not.toBe(base);
  });
});
