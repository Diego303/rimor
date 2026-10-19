import { type Elemento, hashOriginal } from '@rimor/formato';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { nombreZipPapelera, vaciarConCopia } from './papelera';

const elemento = (n: number): Elemento => ({
  frontmatter: {
    id: `01JAB4C2Q2X8M5N7P0R4S6T8V${n}`,
    ref: `TXT-000${n}`,
    tipo: 'texto',
    titulo: `Nota ${n}`,
    creado: '2026-10-16T18:44:03+02:00',
    modificado: '2026-10-16T18:44:03+02:00',
    origen: 'pegado',
    hash: hashOriginal(`texto ${n}`),
    ocultados: 0,
    lector: { nombre: 'texto', version: 1, resumen: {} },
  },
  notas: '',
  original: `texto ${n}`,
});

async function conPapelera() {
  const repo = new Repositorio(new AlmacenMemoria());
  for (const n of [1, 2, 3]) await repo.guardarElemento(elemento(n));
  await repo.moverAPapelera('TXT-0001');
  await repo.moverAPapelera('TXT-0002');
  return repo;
}

describe('vaciar la papelera con copia', () => {
  it('entrega un ZIP con lo que había y después lo borra', async () => {
    const repo = await conPapelera();
    const zips: Uint8Array[] = [];
    expect(await vaciarConCopia(repo, (z) => zips.push(z))).toBe(2);
    const archivos = unzipSync(zips[0] ?? new Uint8Array());
    expect(Object.keys(archivos).sort()).toEqual([
      'papelera/elementos/2026/10/TXT-0001--nota-1.md',
      'papelera/elementos/2026/10/TXT-0002--nota-2.md',
    ]);
    expect(strFromU8(archivos['papelera/elementos/2026/10/TXT-0001--nota-1.md'] ?? new Uint8Array())).toContain(
      'texto 1',
    );
    expect(repo.enPapelera()).toEqual([]);
    expect(repo.elementos().map((fm) => fm.ref)).toEqual(['TXT-0003']);
  });

  it('si la copia no se puede entregar, no se borra nada', async () => {
    const repo = await conPapelera();
    await expect(
      vaciarConCopia(repo, () => {
        throw new Error('sin descarga');
      }),
    ).rejects.toThrow('sin descarga');
    expect(repo.enPapelera()).toHaveLength(2);
  });

  it('con la papelera vacía no hay copia', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    let llamado = false;
    expect(await vaciarConCopia(repo, () => (llamado = true))).toBe(0);
    expect(llamado).toBe(false);
  });

  it('nombre del ZIP con el espacio y el día', () => {
    expect(nombreZipPapelera('Trabajo de campo', new Date(2026, 9, 19, 12))).toBe(
      'rimor-trabajo-de-campo-papelera-2026-10-19.zip',
    );
    expect(nombreZipPapelera('***', new Date(2026, 9, 19, 12))).toBe('rimor-espacio-papelera-2026-10-19.zip');
  });
});
