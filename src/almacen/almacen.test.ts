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
    const { comoHandle } = crearOpfsFalso({ cortarSi: (n) => cortar && n.endsWith('.tmp') });
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
