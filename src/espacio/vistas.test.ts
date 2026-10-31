import { describe, expect, it } from 'vitest';
import {
  borrarVista,
  crearVista,
  editarVista,
  escribirVistas,
  idDeNombre,
  juntarVistas,
  leerVistas,
  VISTAS_INICIALES,
  vistaConConsulta,
} from './vistas';

const AHORA = new Date('2026-10-31T18:00:00+01:00');

describe('vistas guardadas', () => {
  it('el id sale del nombre (sin acentos ni símbolos) y no se repite', () => {
    expect(idDeNombre('  Errores de «ureq» ')).toBe('errores-de-ureq');
    expect(idDeNombre('¡!')).toBe('vista');
    const una = crearVista(VISTAS_INICIALES, 'Errores', 'tipo:error', AHORA);
    const dos = una && crearVista(una.datos, 'errores', 'tipo:error ureq', AHORA);
    expect(dos?.datos.vistas.map((v) => v.id)).toEqual(['errores', 'errores-2']);
    expect(crearVista(VISTAS_INICIALES, '   ', 'x', AHORA)).toBeNull();
    expect(crearVista(VISTAS_INICIALES, 'x', '  ', AHORA)).toBeNull();
  });

  it('renombrar (el id no cambia), borrar, encontrar por consulta; se escribe y se lee igual', () => {
    const d = crearVista(VISTAS_INICIALES, 'Errores', '  tipo:error   ureq ', AHORA)?.datos ?? VISTAS_INICIALES;
    expect(d.vistas[0]?.consulta).toBe('tipo:error ureq');
    const renombrada = editarVista(d, 'errores', { nombre: 'Fallos de ureq' });
    expect(renombrada.vistas[0]).toMatchObject({ id: 'errores', nombre: 'Fallos de ureq' });
    expect(editarVista(d, 'errores', { nombre: '  ' })).toBe(d);
    expect(vistaConConsulta(d, 'tipo:error  ureq')?.id).toBe('errores');
    expect(borrarVista(d, 'errores').vistas).toEqual([]);
    expect(leerVistas(escribirVistas(d))).toEqual(d);
  });

  it('tolerante; roto o de un esquema más nuevo, null; al importar se juntan (ante el mismo id, la de aquí)', () => {
    expect(leerVistas(null)).toEqual(VISTAS_INICIALES);
    expect(
      leerVistas(
        JSON.stringify({
          vistas: [{ id: 'a', nombre: 'A', consulta: 'x' }, { id: 'a', nombre: 'B', consulta: 'y' }, { id: 'b' }, 3],
        }),
      )?.vistas.map((v) => v.id),
    ).toEqual(['a']);
    expect(leerVistas('{roto')).toBeNull();
    expect(leerVistas(JSON.stringify({ esquema: 2, vistas: [] }))).toBeNull();
    const aqui = escribirVistas({ esquema: 1, vistas: [{ id: 'a', nombre: 'Aquí', consulta: 'x', creada: '' }] });
    const paquete = escribirVistas({
      esquema: 1,
      vistas: [
        { id: 'a', nombre: 'Del paquete', consulta: 'z', creada: '' },
        { id: 'b', nombre: 'Nueva', consulta: 'y', creada: '' },
      ],
    });
    expect(JSON.parse(juntarVistas(aqui, paquete) ?? '{}').vistas.map((v: { nombre: string }) => v.nombre)).toEqual([
      'Aquí',
      'Nueva',
    ]);
    expect(juntarVistas('{roto', paquete)).toBeNull();
  });
});
