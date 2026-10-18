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
  it('actualizarElemento lee y escribe en el turno del elemento: no pisa una edición pedida a la vez', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    await repo.guardarElemento(elemento());
    // La edición del usuario y el cambio automático salen a la vez; el automático relee dentro de su turno.
    const edicion = repo.guardarElemento({ ...elemento(), notas: 'nota del usuario' });
    const automatico = repo.actualizarElemento('LOG-0042', (el) => ({
      ...el,
      frontmatter: { ...el.frontmatter, lector: { nombre: 'log', version: 2, resumen: { lineas: 3 } } },
    }));
    await Promise.all([edicion, automatico]);
    const leido = await repo.leerElemento('LOG-0042');
    expect(leido.ok && leido.valor.notas).toBe('nota del usuario');
    expect(leido.ok && leido.valor.frontmatter.lector.version).toBe(2);
    expect(await repo.actualizarElemento('LOG-0042', () => null)).toEqual({ ok: true, valor: false });
    expect((await repo.actualizarElemento('LOG-9999', (el) => el)).ok).toBe(false);
  });

  it('en modo lectura, cualquier escritura falla con almacen.soloLectura', async () => {
    const repo = new Repositorio(new AlmacenMemoria(), undefined, { puedeEscribir: () => false });
    await expect(repo.guardarElemento(elemento())).rejects.toThrow('almacen.soloLectura');
    await expect(repo.guardarAdjunto(new Uint8Array([1]), 'bin')).rejects.toThrow('almacen.soloLectura');
    await expect(repo.vaciarPapelera()).rejects.toThrow('almacen.soloLectura');
  });

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

describe('historial', () => {
  it('guarda sin pisar: el segundo del mismo día lleva -2; a la vez, tampoco eligen la misma ruta', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    const base = 'historial/PRM-0001/resultado-2026-10-18';
    expect(await repo.guardarEnHistorial(base, 'uno')).toBe(`${base}.md`);
    expect(await repo.guardarEnHistorial(base, 'dos')).toBe(`${base}-2.md`);
    const [a, b] = await Promise.all([repo.guardarEnHistorial(base, 'tres'), repo.guardarEnHistorial(base, 'cuatro')]);
    expect([a, b]).toEqual([`${base}-3.md`, `${base}-4.md`]);
    expect(await repo.leerHistorial(`${base}-2.md`)).toBe('dos');
    expect(await repo.leerHistorial('elementos/x.md')).toBeNull();
  });

  it('fuera de historial/ o en una pestaña que solo lee, no escribe', async () => {
    await expect(new Repositorio(new AlmacenMemoria()).guardarEnHistorial('elementos/x', 'y')).rejects.toThrow();
    await expect(new Repositorio(new AlmacenMemoria()).guardarEnHistorial('historial/../x', 'y')).rejects.toThrow();
    const lectora = new Repositorio(new AlmacenMemoria(), undefined, { puedeEscribir: () => false });
    await expect(lectora.guardarEnHistorial('historial/PRM-0001/r', 'y')).rejects.toThrow('almacen.soloLectura');
  });
});
