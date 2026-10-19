import { type Elemento, hashOriginal } from '@rimor/formato';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { nombreZipPapelera, prepararCopia } from './papelera';

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
  it('el ZIP lleva lo que había; vaciar con él borra solo eso', async () => {
    const repo = await conPapelera();
    const copia = await prepararCopia(repo);
    if (!copia) throw new Error('sin copia');
    const archivos = unzipSync(copia.zip);
    expect(Object.keys(archivos).sort()).toEqual([
      'papelera/elementos/2026/10/TXT-0001--nota-1.md',
      'papelera/elementos/2026/10/TXT-0002--nota-2.md',
    ]);
    expect(strFromU8(archivos['papelera/elementos/2026/10/TXT-0001--nota-1.md'] ?? new Uint8Array())).toContain(
      'texto 1',
    );
    // Preparar no borra nada.
    expect(repo.enPapelera()).toHaveLength(2);
    // Lo que llega a la papelera después de la copia no se borra con ella.
    await repo.moverAPapelera('TXT-0003');
    expect(await repo.vaciarPapelera(copia)).toBe(2);
    expect(repo.enPapelera().map((fm) => fm.ref)).toEqual(['TXT-0003']);
  });

  it('con la papelera vacía no hay copia', async () => {
    expect(await prepararCopia(new Repositorio(new AlmacenMemoria()))).toBeNull();
  });

  it('nombre del ZIP con el espacio y el día', () => {
    expect(nombreZipPapelera('Trabajo de campo', new Date(2026, 9, 19, 12))).toBe(
      'rimor-trabajo-de-campo-papelera-2026-10-19.zip',
    );
    expect(nombreZipPapelera('***', new Date(2026, 9, 19, 12))).toBe('rimor-espacio-papelera-2026-10-19.zip');
  });
});
