import { describe, expect, it } from 'vitest';
import { obtenerMotor } from '../lectores/datos/motor';
import { perfilar } from '../lectores/datos/perfil';
import { compararDatos } from './datos';
import { leerResultado, resultadoDeDatos } from './resultado';

const csv = (s: string) => new TextEncoder().encode(s);

describe('comparar dos conjuntos de datos', () => {
  it('filas, columnas añadidas y quitadas, tipo cambiado y cambios de distribución (lo que más cambia, primero)', async () => {
    const motor = await obtenerMotor();
    const antes = await perfilar(
      motor,
      csv('id,cliente,latencia_ms,viejo\n1,ureq,30,a\n2,reqwest,31,b\n3,ureq,32,c\n4,ureq,33,d\n'),
      'csv',
    );
    const despues = await perfilar(
      motor,
      csv(
        'id,cliente,latencia_ms,nuevo\n1,ureq,300,x\n2,reqwest,,y\n3,ureq,320,z\n4,ureq,330,w\n5,curl,340,v\n6,ureq,350,u\n',
      ),
      'csv',
    );
    const c = compararDatos(antes, despues);
    expect(c.filas).toEqual([4, 6]);
    expect([c.anadidas, c.quitadas]).toEqual([['nuevo'], ['viejo']]);
    expect(c.cambianTipo).toEqual([]);
    expect(c.cambios[0]?.nombre).toBe('latencia_ms');
    expect(c.cambios[0]).toMatchObject({ nulos: [0, 1], media: [31.5, 328] });
    expect(c.cambios.map((x) => x.nombre)).toContain('cliente');
    const r = resultadoDeDatos(c, { hashes: ['a', 'b'] });
    expect(leerResultado(r as unknown as Record<string, unknown>)).toMatchObject({
      clase: 'datos',
      filas_a: 4,
      filas_b: 6,
      columnas_anadidas: 1,
      columnas_quitadas: 1,
    });
  }, 60_000);

  it('una columna que cambia de tipo; sin cambios, nada', async () => {
    const motor = await obtenerMotor();
    const a = await perfilar(motor, csv('x,y\n1,2\n3,4\n5,6\n'), 'csv');
    const b = await perfilar(motor, csv('x,y\nuno,2\ndos,4\ntres,6\n'), 'csv');
    expect(compararDatos(a, b).cambianTipo).toEqual([{ nombre: 'x', antes: 'BIGINT', despues: 'VARCHAR' }]);
    expect(compararDatos(a, a).cambios).toEqual([]);
  }, 60_000);
});

describe('calcular una comparación de datos', () => {
  it('con los derivados de las dos fuentes', async () => {
    const { calcular } = await import('./crear');
    const { lectorDatos } = await import('../lectores/datos/lector');
    const { elementoFalso } = await import('../lectores/pruebas/falsos');
    const el = (n: number, texto: string) => {
      const base = elementoFalso(n, texto, 'datos');
      return {
        ...base,
        frontmatter: { ...base.frontmatter, id: `${base.frontmatter.id.slice(0, -1)}${n}`, tipo: 'datos' as const },
      };
    };
    const r = await calcular(el(1, 'a,b\n1,2\n3,4\n5,6\n'), el(2, 'a,b\n1,2\n3,40\n5,6\n7,8\n'), (e) =>
      lectorDatos.derivar(e),
    );
    expect(r.ok && r.valor.clase === 'datos' ? r.valor.datos.filas : r).toEqual([3, 4]);
  }, 60_000);
});
