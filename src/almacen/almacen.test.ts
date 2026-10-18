import { describe, expect, it } from 'vitest';
import { crearOpfsFalso } from '../pruebas/opfs-falso';
import { probarAlmacen } from './almacen.suite';
import { ColaEscrituras } from './cola';
import { type Almacen, escribirTexto, leerTexto, listarTodo } from './contrato';
import { AlmacenMemoria } from './memoria';
import { AlmacenOpfs } from './opfs/opfs';

probarAlmacen('memoria', () => new AlmacenMemoria());
probarAlmacen('OPFS', () => new AlmacenOpfs(crearOpfsFalso().comoHandle));
probarAlmacen('OPFS sin move()', () => new AlmacenOpfs(crearOpfsFalso({ sinMove: true }).comoHandle));
probarAlmacen('cola sobre memoria', () => new ColaEscrituras(new AlmacenMemoria()));

describe('escritura atómica en OPFS', () => {
  it('un corte a mitad de escritura deja el archivo en su versión anterior', async () => {
    let cortar = false;
    const { comoHandle } = crearOpfsFalso({ cortarSi: (n) => cortar && n.endsWith('.rimor-tmp') });
    const a = new AlmacenOpfs(comoHandle);
    await escribirTexto(a, 'elementos/x.md', 'versión 1');
    cortar = true;
    await expect(escribirTexto(a, 'elementos/x.md', 'versión 2 mucho más larga')).rejects.toThrow('corte simulado');
    cortar = false;
    expect(await leerTexto(a, 'elementos/x.md')).toBe('versión 1');
    // El temporal huérfano no aparece al listar y se limpia al abrir.
    expect((await listarTodo(a)).map((e) => e.ruta)).toEqual(['elementos/x.md']);
    expect(await a.limpiarHuerfanos()).toBe(1);
    expect(await a.limpiarHuerfanos()).toBe(0);
    await escribirTexto(a, 'elementos/x.md', 'versión 2');
    expect(await leerTexto(a, 'elementos/x.md')).toBe('versión 2');
  });
});

describe('escritura atómica sin move()', () => {
  it('un corte al escribir el temporal deja la versión anterior', async () => {
    let cortar = false;
    const a = new AlmacenOpfs(
      crearOpfsFalso({ sinMove: true, cortarSi: (n) => cortar && n.endsWith('.rimor-tmp') }).comoHandle,
    );
    await escribirTexto(a, 'x.md', 'versión 1 larga');
    cortar = true;
    await expect(escribirTexto(a, 'x.md', 'versión 2')).rejects.toThrow();
    cortar = false;
    expect(await a.limpiarHuerfanos()).toBe(1);
    expect(await leerTexto(a, 'x.md')).toBe('versión 1 larga');
  });

  it('un corte al copiar sobre el destino se termina al limpiar (el temporal completo manda)', async () => {
    let cortar = false;
    const a = new AlmacenOpfs(crearOpfsFalso({ sinMove: true, cortarSi: (n) => cortar && n === 'x.md' }).comoHandle);
    await escribirTexto(a, 'x.md', 'versión 1 larga');
    cortar = true;
    await expect(escribirTexto(a, 'x.md', 'versión 2 nueva')).rejects.toThrow();
    cortar = false;
    expect(await leerTexto(a, 'x.md')).not.toBe('versión 2 nueva');
    expect(await a.limpiarHuerfanos()).toBe(1);
    expect(await leerTexto(a, 'x.md')).toBe('versión 2 nueva');
    expect((await listarTodo(a)).map((e) => e.ruta)).toEqual(['x.md']);
  });
});

describe('OPFS: rutas y concurrencia', () => {
  it('un archivo que acaba en .tmp es un archivo más; los sufijos reservados se rechazan', async () => {
    const a = new AlmacenOpfs(crearOpfsFalso().comoHandle);
    await escribirTexto(a, 'adjuntos/notas.tmp', 'x');
    await a.limpiarHuerfanos();
    expect(await a.existe('adjuntos/notas.tmp')).toBe(true);
    await expect(a.escribir('x.rimor-tmp', new Uint8Array())).rejects.toThrow();
  });

  it('operaciones simultáneas sobre el mismo archivo no chocan con el bloqueo exclusivo de OPFS', async () => {
    const a = new AlmacenOpfs(crearOpfsFalso().comoHandle);
    await escribirTexto(a, 'x.md', '0');
    const ops = Array.from({ length: 20 }, (_, i) =>
      i % 2 ? leerTexto(a, 'x.md') : escribirTexto(a, 'x.md', String(i)),
    );
    await expect(Promise.all(ops)).resolves.toBeDefined();
    await Promise.all([a.mover('x.md', 'y.md'), escribirTexto(a, 'y.md', 'después')]);
    expect(await leerTexto(a, 'y.md')).toBe('después');
  });
});

describe('ColaEscrituras', () => {
  class Contador extends AlmacenMemoria {
    escrituras = 0;
    override async escribir(ruta: string, datos: Uint8Array) {
      this.escrituras++;
      await new Promise((r) => setTimeout(r, 5));
      return super.escribir(ruta, datos);
    }
  }

  it('agrupa escrituras seguidas de la misma ruta y deja la última', async () => {
    const base = new Contador();
    const cola = new ColaEscrituras(base);
    const t = new TextEncoder();
    await Promise.all(Array.from({ length: 10 }, (_, i) => cola.escribir('a.md', t.encode(`v${i}`))));
    expect(await leerTexto(cola, 'a.md')).toBe('v9');
    expect(base.escrituras).toBeLessThanOrEqual(2);
  });

  it('no agrupa escrituras separadas por un borrado o un movimiento', async () => {
    const cola = new ColaEscrituras(new Contador());
    const a = escribirTexto(cola, 'a.md', 'A');
    const b = cola.borrar('a.md');
    const c = escribirTexto(cola, 'a.md', 'B');
    await Promise.all([a, b, c]);
    expect(await leerTexto(cola, 'a.md')).toBe('B');
    const d = escribirTexto(cola, 'de.md', 'DE');
    const e = cola.mover('de.md', 'a.md');
    const f = escribirTexto(cola, 'a.md', 'NUEVO');
    await Promise.all([d, e, f]);
    expect(await leerTexto(cola, 'a.md')).toBe('NUEVO');
  });

  it('una lectura tras un movimiento ve el destino, y los movimientos cruzados terminan', async () => {
    const cola = new ColaEscrituras(new Contador());
    await escribirTexto(cola, 'x.md', 'X');
    await escribirTexto(cola, 'z.md', 'Z');
    void cola.mover('x.md', 'y.md');
    expect(await leerTexto(cola, 'y.md')).toBe('X');
    await Promise.all([cola.mover('y.md', 'w.md'), cola.mover('z.md', 'y.md'), cola.mover('w.md', 'z.md')]);
    expect([await leerTexto(cola, 'y.md'), await leerTexto(cola, 'z.md')]).toEqual(['Z', 'X']);
  });

  it('una lectura durante una escritura pendiente ve el valor nuevo', async () => {
    const cola = new ColaEscrituras(new Contador());
    const p = escribirTexto(cola, 'a.md', 'nuevo');
    expect(await leerTexto(cola, 'a.md')).toBe('nuevo');
    await p;
  });

  it('un fallo de escritura llega a quien escribió y no bloquea la cola', async () => {
    let fallar = true;
    const base: Almacen = Object.assign(new AlmacenMemoria(), {
      async escribir(this: AlmacenMemoria, ruta: string, datos: Uint8Array) {
        if (fallar) throw new Error('disco lleno');
        return AlmacenMemoria.prototype.escribir.call(this, ruta, datos);
      },
    });
    const cola = new ColaEscrituras(base);
    await expect(escribirTexto(cola, 'a.md', '1')).rejects.toThrow('disco lleno');
    fallar = false;
    await escribirTexto(cola, 'a.md', '2');
    expect(await leerTexto(cola, 'a.md')).toBe('2');
  });
});

describe('5.000 elementos', () => {
  it('se escriben, se listan y se leen enteros (memoria y OPFS falso)', async () => {
    for (const a of [new AlmacenMemoria(), new AlmacenOpfs(crearOpfsFalso().comoHandle)]) {
      const texto = 'x'.repeat(4000);
      for (let i = 0; i < 5000; i++)
        await escribirTexto(a, `elementos/2026/${String(1 + (i % 12)).padStart(2, '0')}/E-${i}.md`, texto);
      const t0 = performance.now();
      const lista = await listarTodo(a, 'elementos/');
      let bytes = 0;
      for (const e of lista) bytes += (await a.leer(e.ruta))?.length ?? 0;
      expect(lista).toHaveLength(5000);
      expect(bytes).toBe(5000 * 4000);
      expect(performance.now() - t0).toBeLessThan(5000);
    }
  }, 60_000);
});
