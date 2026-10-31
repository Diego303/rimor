import { describe, expect, it } from 'vitest';
import {
  aceptarPropuesta,
  anotarCorreccion,
  borrarRegla,
  CORRECCIONES_PARA_PROPONER,
  type DatosReglas,
  descartarPropuesta,
  editarRegla,
  escribirReglas,
  firmaDe,
  huellaDe,
  leerReglas,
  MAX_CORRECCIONES,
  REGLAS_INICIALES,
  reglaPara,
} from './reglas';

const EN = '2026-10-31T18:00:00+01:00';
/** Las correcciones de `textos` a `tipo`, una tras otra; la última propuesta. */
function corregir(d: DatosReglas, textos: string[], tipo: 'log' | 'error' = 'log') {
  let datos = d;
  let propuesta = null;
  for (const t of textos) ({ datos, propuesta } = anotarCorreccion(datos, t, tipo, EN));
  return { datos, propuesta };
}

describe('firma de un contenido', () => {
  it('la primera palabra de la primera línea con contenido, si lleva una letra y un signo', () => {
    expect(firmaDe('[app] arrancado en 3 s')).toBe('[app]');
    expect(firmaDe('\n\n   svc: listo\nmás')).toBe('svc:');
    expect(firmaDe('<pago> rechazado')).toBe('<pago>');
  });

  it('una palabra corriente (también con su puntuación), un número, una fecha, lo vacío o lo larguísimo no', () => {
    for (const t of [
      'Error al abrir',
      '¿Por qué falla?',
      'Hola, equipo',
      'Hi, all',
      "I'm here",
      '(nota) algo',
      '"Cita" de alguien',
      'buen-día a todos',
      '2026-10-31 algo',
      '2026-10-31T18:00:00Z INFO x',
      '18:00:00 arranque',
      'app-2026-10-31: x',
      '1234 líneas',
      '',
      '   \n  ',
      `[${'a'.repeat(40)}] x`,
      '---',
    ])
      expect(firmaDe(t), t).toBeNull();
    // Con un signo propio, sí: aunque lleve guion entre letras o puntuación al final.
    expect(firmaDe('mi-app: listo')).toBe('mi-app:');
    expect(firmaDe('[app], arrancado')).toBe('[app],');
  });
});

describe('aprender de las correcciones', () => {
  const tres = ['[app] uno', '[app] dos', '  [app] tres'];

  it(`a la ${CORRECCIONES_PARA_PROPONER}.ª corrección con la misma firma y el mismo tipo, la propuesta`, () => {
    const dos = corregir(REGLAS_INICIALES, tres.slice(0, 2));
    expect(dos.propuesta).toBeNull();
    expect(corregir(dos.datos, tres.slice(2)).propuesta).toEqual({ firma: '[app]', tipo: 'log' });
  });

  it('con firmas o tipos distintos, o sin firma, no', () => {
    expect(corregir(REGLAS_INICIALES, ['[app] uno', '[otra] dos', '[app] tres']).propuesta).toBeNull();
    let d = corregir(REGLAS_INICIALES, tres.slice(0, 2)).datos;
    d = anotarCorreccion(d, '[app] tres', 'error', EN).datos;
    expect(corregir(d, []).propuesta).toBeNull();
    const sinFirma = anotarCorreccion(REGLAS_INICIALES, 'Error al abrir', 'log', EN);
    expect(sinFirma.datos).toBe(REGLAS_INICIALES);
    // A un binario (no se detecta por su texto), tampoco.
    expect(anotarCorreccion(REGLAS_INICIALES, '[app] x', 'imagen', EN).datos).toBe(REGLAS_INICIALES);
  });

  it('no guarda la firma de las correcciones ni de lo rechazado: solo su huella', () => {
    const { datos, propuesta } = corregir(REGLAS_INICIALES, tres.slice(0, 2));
    expect(propuesta).toBeNull();
    const rechazada = descartarPropuesta(datos, { firma: 'secreto:', tipo: 'log' });
    const texto = escribirReglas(rechazada);
    expect(texto).not.toContain('[app]');
    expect(texto).not.toContain('secreto:');
    expect(datos.correcciones[0]?.huella).toBe(huellaDe('[app]'));
  });

  it('ni si ya hay una regla que lo dice, ni si se rechazó; aceptar la crea y rechazar no la vuelve a ofrecer', () => {
    const { datos, propuesta } = corregir(REGLAS_INICIALES, tres);
    if (!propuesta) throw new Error('sin propuesta');
    const aceptada = aceptarPropuesta(datos, propuesta, EN);
    expect(aceptada.reglas).toEqual([{ prefijo: '[app]', tipo: 'log', creada: EN }]);
    expect(aceptada.correcciones).toEqual([]);
    expect(corregir(aceptada, tres).propuesta).toBeNull();
    // La del feed lleva su momento: no se guarda (ni la firma: su huella).
    const rechazada = descartarPropuesta(datos, { ...propuesta, en: EN } as typeof propuesta);
    expect(rechazada.descartadas).toEqual([{ huella: huellaDe('[app]'), tipo: 'log' }]);
    expect(corregir(rechazada, tres).propuesta).toBeNull();
    // A otro tipo, sí: y al aceptarla, la regla cambia de tipo (no hay dos con el mismo prefijo).
    const otra = corregir(aceptada, tres, 'error');
    expect(otra.propuesta).toEqual({ firma: '[app]', tipo: 'error' });
    expect(aceptarPropuesta(otra.datos, { firma: '[app]', tipo: 'error' }, EN).reglas).toEqual([
      { prefijo: '[app]', tipo: 'error', creada: EN },
    ]);
  });

  it(`solo recuerda las ${MAX_CORRECCIONES} últimas correcciones`, () => {
    const muchas = Array.from({ length: MAX_CORRECCIONES + 10 }, (_, i) => `[a${i}] x`);
    expect(corregir(REGLAS_INICIALES, muchas).datos.correcciones).toHaveLength(MAX_CORRECCIONES);
  });
});

describe('aplicar y editar', () => {
  const d: DatosReglas = {
    ...REGLAS_INICIALES,
    reglas: [
      { prefijo: '[app]', tipo: 'log', creada: EN },
      { prefijo: '[app] ERROR', tipo: 'error', creada: EN },
    ],
  };

  it('de las reglas cuyo prefijo empieza la primera línea con contenido, la del prefijo más largo', () => {
    expect(reglaPara('\n  [app] ERROR algo', d.reglas)?.tipo).toBe('error');
    expect(reglaPara('[app] INFO algo', d.reglas)?.tipo).toBe('log');
    // En cualquier orden: una general (`[`) añadida antes no tapa a la concreta.
    const general = [{ prefijo: '[', tipo: 'codigo' as const, creada: EN }, ...d.reglas];
    expect(reglaPara('[app] x', general)?.tipo).toBe('log');
    expect(reglaPara('[otra] x', general)?.tipo).toBe('codigo');
    expect(reglaPara('otra [app] cosa', d.reglas)).toBeUndefined();
    expect(reglaPara('[app] x', [])).toBeUndefined();
    // Sin partir un texto enorme en líneas (solo mira el principio).
    expect(reglaPara(`[app] x\n${'y\n'.repeat(1_000_000)}`, d.reglas)?.tipo).toBe('log');
  });

  it('editar el prefijo y el tipo; un prefijo vacío, con salto o repetido no se aplica; borrar', () => {
    // Por su prefijo, no por su posición.
    expect(editarRegla(d, '[app]', { prefijo: 'app:' }).reglas[0]?.prefijo).toBe('app:');
    expect(editarRegla(d, '[app] ERROR', { tipo: 'log' }).reglas[1]?.tipo).toBe('log');
    for (const prefijo of ['', '   ', 'a\nb', '[app] ERROR', ' x', 'x'.repeat(65)])
      expect(editarRegla(d, '[app]', { prefijo })).toBe(d);
    expect(editarRegla(d, 'no:', { prefijo: 'x:' })).toBe(d);
    expect(borrarRegla(d, '[app]').reglas.map((r) => r.prefijo)).toEqual(['[app] ERROR']);
    expect(borrarRegla(d, 'no:')).toEqual(d);
  });
});

describe('el archivo', () => {
  it('se escribe y se vuelve a leer igual', () => {
    const { datos, propuesta } = corregir(REGLAS_INICIALES, ['[app] uno', '[app] dos', '[app] tres']);
    const d = descartarPropuesta(aceptarPropuesta(datos, propuesta ?? { firma: '', tipo: 'log' }, EN), {
      firma: 'svc:',
      tipo: 'error',
    });
    expect(leerReglas(escribirReglas(d))).toEqual(d);
    expect(leerReglas(null)).toEqual(REGLAS_INICIALES);
  });

  it('tolerante: lo que no se entiende se ignora; un JSON roto o que no es un objeto, null (no se sobrescribe)', () => {
    const texto = JSON.stringify({
      esquema: 1,
      reglas: [
        { prefijo: '[app]', tipo: 'log', creada: EN },
        { prefijo: '[app]', tipo: 'error' },
        { prefijo: 'x', tipo: 'inventado' },
        { prefijo: 'a\nb', tipo: 'log' },
        'basura',
        { prefijo: 'svc:', tipo: 'error' },
      ],
      correcciones: [{ huella: 'abc', tipo: 'log', en: EN }, { huella: 3 }],
      descartadas: [{ huella: 'def', tipo: 'json' }, null],
    });
    expect(leerReglas(texto)).toEqual({
      esquema: 1,
      reglas: [
        { prefijo: '[app]', tipo: 'log', creada: EN },
        { prefijo: 'svc:', tipo: 'error', creada: '' },
      ],
      correcciones: [{ huella: 'abc', tipo: 'log', en: EN }],
      descartadas: [{ huella: 'def', tipo: 'json' }],
    });
    // De un esquema más nuevo: no se entiende (y no se sobrescribe lo que no se conoce).
    expect(leerReglas(JSON.stringify({ esquema: 2, reglas: [], nuevo: 1 }))).toBeNull();
    expect(leerReglas('{roto')).toBeNull();
    expect(leerReglas('[1, 2]')).toBeNull();
    expect(leerReglas('{}')).toEqual(REGLAS_INICIALES);
  });
});
