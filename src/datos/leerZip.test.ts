import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { ErrorZip, entradasZip, LIMITES_ZIP, leerEntrada, trozosDe } from './leerZip';

const u32 = (d: Uint8Array, i: number) =>
  ((d[i] ?? 0) | ((d[i + 1] ?? 0) << 8) | ((d[i + 2] ?? 0) << 16) | ((d[i + 3] ?? 0) << 24)) >>> 0;
const poner32 = (d: Uint8Array, i: number, v: number) => {
  d[i] = v & 0xff;
  d[i + 1] = (v >>> 8) & 0xff;
  d[i + 2] = (v >>> 16) & 0xff;
  d[i + 3] = (v >>> 24) & 0xff;
};

/** Dónde empieza cada entrada del directorio central. */
function centrales(zip: Uint8Array): number[] {
  const salida: number[] = [];
  for (let i = 0; i + 4 <= zip.length; i++) if (u32(zip, i) === 0x02014b50) salida.push(i);
  return salida;
}

async function codigo(zip: Uint8Array, leerTodo = true): Promise<string> {
  try {
    const { tam, leer } = trozosDe(zip);
    const entradas = await entradasZip(tam, leer);
    if (leerTodo) for (const e of entradas) await leerEntrada(e, leer);
    return 'sin error';
  } catch (e) {
    return e instanceof ErrorZip ? e.codigo : `otro: ${String(e)}`;
  }
}

const texto = (s: string) => new TextEncoder().encode(s);

describe('ZIP maliciosos: se rechazan antes de escribir nada', () => {
  it('rutas que salen del espacio o no son rutas (zip slip, absolutas, unidades, \\, NUL)', async () => {
    for (const ruta of [
      '../fuera.md',
      'a/../../fuera.md',
      '/etc/passwd',
      'C:/Windows/x',
      'a\\b.md',
      'a/\0.md',
      'a//b.md',
      './a.md',
    ])
      expect(await codigo(zipSync({ [ruta]: texto('x') }), false), ruta).toBe('zip.rutaInsegura');
    expect(await codigo(zipSync({ 'elementos/2026/ñandú 🦤.md': texto('x') }))).toBe('sin error');
  });

  it('rutas repetidas y entradas que se solapan (la bomba por solapamiento)', async () => {
    const dos = zipSync({ 'a.md': texto('uno'), 'b.md': texto('dos') }, { level: 0 });
    const [, segunda] = centrales(dos);
    if (segunda === undefined) throw new Error('sin segunda entrada');
    // El nombre de la segunda («b.md») pasa a «a.md».
    const repetida = dos.slice();
    repetida[segunda + 46] = 'a'.charCodeAt(0);
    expect(await codigo(repetida, false)).toBe('zip.rutaRepetida');
    // La segunda apunta a los datos de la primera.
    const solapada = dos.slice();
    poner32(solapada, segunda + 42, 0);
    expect(await codigo(solapada, false)).toBe('zip.solapadas');
  });

  it('una bomba que declara 10 bytes se corta en el primer trozo, sin inflarla entera', async () => {
    const trae = 64 * 1024 * 1024;
    const zip = zipSync({ 'bomba.bin': new Uint8Array(trae) });
    expect(zip.length).toBeLessThan(200_000);
    const [central] = centrales(zip);
    if (central === undefined) throw new Error('sin entrada');
    poner32(zip, central + 24, 10);
    const { tam, leer } = trozosDe(zip);
    const [e] = await entradasZip(tam, leer);
    if (!e) throw new Error('sin entrada');
    const error = await leerEntrada(e, leer).catch((x: unknown) => x);
    expect(error).toMatchObject({ codigo: 'zip.tamanoMayor' });
    // Lo inflado antes de cortar es un trozo, no los 64 MB que trae.
    expect((error as ErrorZip).inflado).toBeLessThan(trae / 8);
  });

  it('un tamaño declarado enorme no reserva memoria: pasa del límite y se rechaza', async () => {
    const zip = zipSync({ 'a.bin': texto('poco') });
    const [central] = centrales(zip);
    if (central === undefined) throw new Error('sin entrada');
    poner32(zip, central + 24, 0xfffffff0);
    expect(await codigo(zip, false)).toBe('zip.demasiadoGrande');
    // Con un límite mayor, se lee y no casa con lo que trae.
    const { tam, leer } = trozosDe(zip);
    const [e] = await entradasZip(tam, leer, { ...LIMITES_ZIP, total: 2 ** 33 });
    if (!e) throw new Error('sin entrada');
    await expect(leerEntrada(e, leer)).rejects.toMatchObject({ codigo: 'zip.tamanoDistinto' });
  });

  it('demasiados archivos y datos fuera del archivo', async () => {
    const tres = zipSync({ a: texto('1'), b: texto('2'), c: texto('3') });
    const { tam, leer } = trozosDe(tres);
    await expect(entradasZip(tam, leer, { archivos: 2, total: LIMITES_ZIP.total })).rejects.toMatchObject({
      codigo: 'zip.demasiadosArchivos',
    });
    const [central] = centrales(tres);
    if (central === undefined) throw new Error('sin entrada');
    const fuera = tres.slice();
    poner32(fuera, central + 20, 0x7fffffff);
    expect(await codigo(fuera, false)).toBe('zip.fueraDelArchivo');
  });

  it('el error dice qué entrada y qué regla', async () => {
    try {
      const zip = zipSync({ '../x.md': texto('x') });
      const { tam, leer } = trozosDe(zip);
      await entradasZip(tam, leer);
    } catch (e) {
      expect(e).toMatchObject({ codigo: 'zip.rutaInsegura', ruta: '../x.md', message: 'zip.rutaInsegura: ../x.md' });
    }
  });
});
