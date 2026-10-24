import { leerElemento } from '@rimor/formato';
import { describe, expect, it, vi } from 'vitest';
import { REGISTRO } from '../../lectores/registro';
import { leerPaquete } from '../importar/paquete';
import { NOMBRE_EJEMPLO, zipDeEjemplo } from './ejemplo';

const AHORA = new Date('2026-10-24T12:00:00+02:00');

describe('espacio de ejemplo', () => {
  it('pasa la validación de importar y trae la colección gateway con sus tipos', async () => {
    const p = await leerPaquete(await zipDeEjemplo(REGISTRO, AHORA), 'ejemplo.zip');
    expect(p.manifest.espacio.nombre).toBe(NOMBRE_EJEMPLO);
    const elementos = [...p.archivos]
      .filter(([r]) => r.startsWith('elementos/'))
      .map(([, d]) => {
        const el = leerElemento(new TextDecoder().decode(d));
        if (!el.ok) throw new Error('elemento ilegible');
        return el.valor.frontmatter;
      });
    expect(elementos.map((fm) => fm.tipo).sort()).toEqual(
      ['enlace', 'error', 'idea', 'log', 'log', 'mediciones', 'mediciones', 'prompt'].sort(),
    );
    expect(elementos.every((fm) => fm.colecciones?.includes('gateway'))).toBe(true);
    expect(new Set(elementos.map((fm) => fm.ref)).size).toBe(8);
    expect(JSON.parse(new TextDecoder().decode(p.archivos.get('colecciones.json'))).colecciones[0].id).toBe('gateway');
  });

  it('dos generaciones con el mismo reloj dan los mismos archivos', async () => {
    const a = await leerPaquete(await zipDeEjemplo(REGISTRO, AHORA), 'a.zip');
    const b = await leerPaquete(await zipDeEjemplo(REGISTRO, AHORA), 'b.zip');
    expect([...b.archivos.keys()]).toEqual([...a.archivos.keys()]);
    for (const [r, d] of a.archivos) expect(b.archivos.get(r), r).toEqual(d);
  });
});

describe('crear el espacio de ejemplo', () => {
  it('si escribirlo falla a medias, se borra lo escrito y no se apunta', async () => {
    const { crearEspacioDeEjemplo } = await import('./crear');
    const { AlmacenMemoria } = await import('../../almacen/memoria');
    const borrado = vi.fn(async () => undefined);
    const apuntado = vi.fn();
    const roto = Object.assign(new AlmacenMemoria(), {
      escribir: async () => Promise.reject(new Error('cuota')),
    });
    const espacio = {} as never;
    await expect(
      crearEspacioDeEjemplo(espacio, REGISTRO, {
        crearAlmacen: async () => roto,
        alFallarEspacio: borrado,
        alCrearEspacio: apuntado,
      }),
    ).rejects.toThrow('cuota');
    expect(borrado).toHaveBeenCalledOnce();
    expect(apuntado).not.toHaveBeenCalled();
  });
});
