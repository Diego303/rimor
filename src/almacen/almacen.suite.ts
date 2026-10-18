/** Conjunto de pruebas común a cualquier Almacen: lo pasan el de memoria y el de OPFS. */
import { describe, expect, it } from 'vitest';
import { type Almacen, escribirTexto, leerTexto, listarTodo, validarRuta } from './contrato';

export function probarAlmacen(nombre: string, crear: () => Promise<Almacen> | Almacen): void {
  describe(`Almacen: ${nombre}`, () => {
    it('lee lo que escribe y devuelve null si no existe', async () => {
      const a = await crear();
      expect(await a.leer('elementos/2026/10/a.md')).toBeNull();
      await escribirTexto(a, 'elementos/2026/10/a.md', 'hola ñ');
      expect(await leerTexto(a, 'elementos/2026/10/a.md')).toBe('hola ñ');
      expect(await a.existe('elementos/2026/10/a.md')).toBe(true);
      expect(await a.existe('elementos/2026/10/b.md')).toBe(false);
    });

    it('sobrescribe entero (más corto que antes)', async () => {
      const a = await crear();
      await escribirTexto(a, 'x.md', 'un texto largo');
      await escribirTexto(a, 'x.md', 'corto');
      expect(await leerTexto(a, 'x.md')).toBe('corto');
    });

    it('mueve y borra; borrar lo que no existe no falla', async () => {
      const a = await crear();
      await escribirTexto(a, 'a/b.md', '1');
      await a.mover('a/b.md', 'papelera/a/b.md');
      expect(await a.existe('a/b.md')).toBe(false);
      expect(await leerTexto(a, 'papelera/a/b.md')).toBe('1');
      await a.borrar('papelera/a/b.md');
      await a.borrar('no/existe.md');
      expect(await a.existe('papelera/a/b.md')).toBe(false);
    });

    it('mover sobre un destino existente lo sustituye', async () => {
      const a = await crear();
      await escribirTexto(a, 'a.md', 'nuevo');
      await escribirTexto(a, 'b.md', 'viejo');
      await a.mover('a.md', 'b.md');
      expect(await leerTexto(a, 'b.md')).toBe('nuevo');
    });

    it('lista por prefijo con tamaños', async () => {
      const a = await crear();
      await escribirTexto(a, 'elementos/2026/10/a.md', 'abc');
      await escribirTexto(a, 'elementos/2026/11/b.md', 'de');
      await escribirTexto(a, 'hilos/c.md', 'f');
      const todos = (await listarTodo(a)).map((e) => e.ruta).sort();
      expect(todos).toEqual(['elementos/2026/10/a.md', 'elementos/2026/11/b.md', 'hilos/c.md']);
      const elementos = await listarTodo(a, 'elementos/');
      expect(elementos.map((e) => [e.ruta, e.tam]).sort()).toEqual([
        ['elementos/2026/10/a.md', 3],
        ['elementos/2026/11/b.md', 2],
      ]);
      expect((await listarTodo(a, 'elementos/2026/10/')).map((e) => e.ruta)).toEqual(['elementos/2026/10/a.md']);
    });

    it('rechaza rutas peligrosas', async () => {
      const a = await crear();
      for (const r of ['../x', '/x', 'a//b', 'a/./b', 'a/', '', 'a\\b']) {
        await expect(a.leer(r)).rejects.toThrow();
        expect(() => validarRuta(r)).toThrow();
      }
    });
  });
}
