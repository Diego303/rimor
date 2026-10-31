import type { FrontmatterComun } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../lectores/pruebas/falsos';
import {
  escribirSesiones,
  franjaDe,
  franjaDeId,
  juntarSesiones,
  leerSesiones,
  nombrePropuesto,
  renombrar,
  SESIONES_INICIALES,
  sesionPara,
  UMBRAL_SESION_MS,
} from './sesiones';

/** Un elemento creado a una hora local del 16 oct (con su sesión, si se da). */
function fm(i: number, hora: number, minuto: number, cambios: Partial<FrontmatterComun> = {}): FrontmatterComun {
  const creado = new Date(2026, 9, 16, hora, minuto).toISOString();
  return { ...elementoFalso(i).frontmatter, creado, ...cambios };
}
const a = (hora: number, minuto: number) => new Date(2026, 9, 16, hora, minuto);

describe('franjas', () => {
  it('madrugada antes de las 6, mañana hasta las 14, tarde hasta las 21, noche después', () => {
    expect([5, 6, 13, 14, 20, 21, 23].map((h) => franjaDe(a(h, 30)))).toEqual([
      'madrugada',
      'manana',
      'manana',
      'tarde',
      'tarde',
      'noche',
      'noche',
    ]);
    expect(franjaDeId('2026-10-16-tarde-2')).toBe('tarde');
    expect(franjaDeId('otra cosa')).toBeNull();
  });
});

describe('la sesión de una captura', () => {
  it('sigue la del más reciente si es de hace menos de 45 minutos; si no, una nueva por día y franja', () => {
    const antes = [fm(1, 16, 0, { sesion: '2026-10-16-tarde' }), fm(2, 15, 0, { sesion: 'vieja' })];
    expect(sesionPara(antes, a(16, 44))).toBe('2026-10-16-tarde');
    expect(UMBRAL_SESION_MS).toBe(45 * 60_000);
    // A 46 minutos: otra, con sufijo porque ese id ya se usa.
    expect(sesionPara(antes, a(16, 46))).toBe('2026-10-16-tarde-2');
    expect(sesionPara([...antes, fm(3, 10, 0, { sesion: '2026-10-16-tarde-2' })], a(16, 46))).toBe(
      '2026-10-16-tarde-3',
    );
    // El más reciente sin sesión (de antes de las sesiones): una nueva.
    expect(sesionPara([fm(4, 16, 30)], a(16, 40))).toBe('2026-10-16-tarde');
    // Nada antes, o solo cosas «del futuro»: una nueva.
    expect(sesionPara([], a(9, 0))).toBe('2026-10-16-manana');
    expect(sesionPara([fm(5, 18, 0, { sesion: 'futura' })], a(17, 50))).toBe('2026-10-16-tarde');
  });
});

describe('el nombre propuesto', () => {
  it('la colección de al menos la mitad; si no, las etiquetas repetidas (una o dos); si no, la franja', () => {
    const col = (c: string[], e: string[] = []) => fm(1, 16, 0, { colecciones: c, etiquetas: e });
    expect(nombrePropuesto('2026-10-16-tarde', [col(['gateway']), col(['gateway']), col([])])).toEqual({
      t: 'coleccion',
      coleccion: 'gateway',
    });
    expect(
      nombrePropuesto('2026-10-16-tarde', [
        col(['a'], ['ureq', 'streaming', 'x']),
        col(['b'], ['ureq', 'streaming']),
        col(['c'], ['streaming']),
      ]),
    ).toEqual({ t: 'etiquetas', etiquetas: ['streaming', 'ureq'] });
    expect(nombrePropuesto('2026-10-16-noche-2', [col(['a'], ['x']), col(['b'], ['y']), col(['c'])])).toEqual({
      t: 'franja',
      franja: 'noche',
    });
  });
});

describe('sesiones.json', () => {
  it('renombrar, vacío vuelve al propuesto; se escribe y se lee igual', () => {
    const d = renombrar(SESIONES_INICIALES, '2026-10-16-tarde', '  Evaluación\nde clientes  ');
    expect(d.nombres).toEqual({ '2026-10-16-tarde': 'Evaluación de clientes' });
    expect(leerSesiones(escribirSesiones(d))).toEqual(d);
    expect(renombrar(d, '2026-10-16-tarde', '   ').nombres).toEqual({});
    expect(renombrar(d, 'x', 'y'.repeat(200)).nombres.x).toHaveLength(80);
  });

  it('tolerante; roto o de un esquema más nuevo, null', () => {
    expect(leerSesiones(null)).toEqual(SESIONES_INICIALES);
    expect(leerSesiones(JSON.stringify({ esquema: 1, nombres: { a: 'Uno', b: 3, c: '  ' } }))).toEqual({
      esquema: 1,
      nombres: { a: 'Uno' },
    });
    expect(leerSesiones('{roto')).toBeNull();
    expect(leerSesiones(JSON.stringify({ esquema: 2, nombres: {} }))).toBeNull();
  });

  it('al importar se juntan; ante el mismo id, el de aquí; uno que no se entiende, null', () => {
    const aqui = escribirSesiones({ esquema: 1, nombres: { a: 'Aquí', b: 'Solo aquí' } });
    const paquete = escribirSesiones({ esquema: 1, nombres: { a: 'Del paquete', c: 'Nuevo' } });
    expect(JSON.parse(juntarSesiones(aqui, paquete) ?? '{}').nombres).toEqual({
      a: 'Aquí',
      b: 'Solo aquí',
      c: 'Nuevo',
    });
    expect(JSON.parse(juntarSesiones(null, paquete) ?? '{}').nombres).toEqual({ a: 'Del paquete', c: 'Nuevo' });
    expect(juntarSesiones(aqui, '{roto')).toBeNull();
  });
});
