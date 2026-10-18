import { type Elemento, hashOriginal } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { leerTexto, listarTodo } from './contrato';
import { AlmacenMemoria } from './memoria';
import { Repositorio } from './repositorio';

function elemento(cambios: Partial<Elemento['frontmatter']> = {}): Elemento {
  return {
    frontmatter: {
      id: '01JAB4C2Q2X8M5N7P0R4S6T8V0',
      ref: 'LOG-0042',
      tipo: 'log',
      titulo: 'Timeout en streaming',
      creado: '2026-10-16T18:44:03+02:00',
      modificado: '2026-10-16T18:44:03+02:00',
      origen: 'pegado',
      hash: hashOriginal('a'),
      ocultados: 0,
      lector: { nombre: 'log', version: 1, resumen: {} },
      ...cambios,
    },
    notas: '',
    original: 'a',
  };
}

describe('Repositorio', () => {
  it('guarda en la ruta por fecha y lee por ref y por id', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    expect(await repo.guardarElemento(elemento())).toBe('elementos/2026/10/LOG-0042--timeout-en-streaming.md');
    const porRef = await repo.leerElemento('LOG-0042');
    const porId = await repo.leerElemento('01JAB4C2Q2X8M5N7P0R4S6T8V0');
    expect(porRef.ok && porRef.valor.frontmatter.titulo).toBe('Timeout en streaming');
    expect(porId.ok && porId.valor.frontmatter.ref).toBe('LOG-0042');
    expect((await repo.leerElemento('LOG-9999')).ok).toBe(false);
  });

  it('renombra el archivo al cambiar el título; el id no cambia y el YAML previo se conserva', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    const ruta = await repo.guardarElemento(elemento());
    const conComentario = ((await leerTexto(almacen, ruta)) ?? '').replace('ocultados: 0\n', 'ocultados: 0 # a mano\n');
    await almacen.escribir(ruta, new TextEncoder().encode(conComentario));
    const nueva = await repo.guardarElemento(elemento({ titulo: 'Otro título' }));
    expect(nueva).toBe('elementos/2026/10/LOG-0042--otro-titulo.md');
    expect((await listarTodo(almacen)).map((e) => e.ruta)).toEqual([nueva]);
    expect(await leerTexto(almacen, nueva)).toContain('ocultados: 0 # a mano');
    expect(repo.buscar('LOG-0042')?.ruta).toBe(nueva);
  });

  it('papelera y restauración, y vaciarla', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    const ruta = await repo.guardarElemento(elemento());
    const enPapelera = await repo.moverAPapelera('LOG-0042');
    expect(enPapelera.ok && enPapelera.valor).toBe(`papelera/${ruta}`);
    expect(repo.buscar('LOG-0042')?.enPapelera).toBe(true);
    const restaurado = await repo.restaurar('LOG-0042');
    expect(restaurado.ok && restaurado.valor).toBe(ruta);
    await repo.moverAPapelera('LOG-0042');
    expect(await repo.vaciarPapelera()).toBe(1);
    expect(repo.buscar('LOG-0042')).toBeUndefined();
    expect(await listarTodo(almacen)).toEqual([]);
  });

  it('cargar reconstruye el índice desde los archivos, también la papelera', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    await repo.guardarElemento(elemento());
    await repo.guardarElemento(elemento({ id: '01JAB4C2Q2X8M5N7P0R4S6T8V1', ref: 'LOG-0043', titulo: 'Otro' }));
    await repo.moverAPapelera('LOG-0043');
    await almacen.escribir('elementos/2026/10/roto.md', new TextEncoder().encode('no es un elemento'));
    const otro = new Repositorio(almacen);
    const fallidos = await otro.cargar();
    expect(fallidos).toEqual([{ ruta: 'elementos/2026/10/roto.md', codigo: 'formato.sinFrontmatter' }]);
    expect([...otro.refs()].sort()).toEqual(['LOG-0042', 'LOG-0043']);
    expect(otro.buscar('LOG-0043')?.enPapelera).toBe(true);
  });

  it('un renombrado cortado entre escribir y borrar se termina al cargar', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    const viejo = await repo.guardarElemento(elemento());
    const original = almacen.borrar.bind(almacen);
    // Se corta justo al borrar el origen: quedan dos copias y el diario.
    almacen.borrar = async () => {
      throw new Error('corte');
    };
    await expect(repo.guardarElemento(elemento({ titulo: 'Nuevo' }))).rejects.toThrow('corte');
    almacen.borrar = original;
    expect((await listarTodo(almacen)).length).toBe(3);
    const otro = new Repositorio(almacen);
    expect(await otro.cargar()).toEqual([]);
    expect((await listarTodo(almacen)).map((e) => e.ruta)).toEqual(['elementos/2026/10/LOG-0042--nuevo.md']);
    expect(otro.buscar('LOG-0042')?.ruta).not.toBe(viejo);
  });

  it('restaurar sobre una copia del mismo elemento no queda bloqueado; dos archivos con el mismo id se avisan', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    const ruta = await repo.guardarElemento(elemento());
    const texto = (await leerTexto(almacen, ruta)) ?? '';
    await repo.moverAPapelera('LOG-0042');
    await almacen.escribir(ruta, new TextEncoder().encode(texto));
    const r = await repo.restaurar('LOG-0042');
    expect(r.ok && r.valor).toBe(ruta);
    expect((await listarTodo(almacen)).map((e) => e.ruta)).toEqual([ruta]);
    await almacen.escribir('elementos/2026/10/copia.md', new TextEncoder().encode(texto));
    const otro = new Repositorio(almacen);
    expect(await otro.cargar()).toEqual([{ ruta: 'elementos/2026/10/copia.md', codigo: 'almacen.duplicado' }]);
    expect(otro.buscar('LOG-0042')?.ruta).toBe(ruta);
  });

  it('los adjuntos se guardan por hash y no se duplican', async () => {
    const almacen = new AlmacenMemoria();
    const repo = new Repositorio(almacen);
    const bytes = new TextEncoder().encode('contenido grande');
    const a = await repo.guardarAdjunto(bytes, 'log');
    const b = await repo.guardarAdjunto(bytes, 'log');
    expect(a.nuevo).toBe(true);
    expect(b).toEqual({ ...a, nuevo: false });
    expect(a.ruta).toBe(`adjuntos/${a.hash.slice(0, 2)}/${a.hash}.log`);
  });
});
