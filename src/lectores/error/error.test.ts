import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { huellaDe, mensajeNormalizado } from './huella';
import { analizarError, lectorError, ordinal } from './lector';
import { analizarTraza } from './trazas';

const raiz = join(process.cwd(), 'fixtures/trazas');
const esperado = JSON.parse(readFileSync(join(raiz, 'esperado.json'), 'utf8')) as Record<
  string,
  { tipo: string; mensaje: string; propios: number }
>;
const leer = (archivo: string) => readFileSync(join(raiz, archivo), 'utf8');
const LENGUAJE: Record<string, string> = {
  rust: 'rust',
  python: 'python',
  javascript: 'javascript',
  java: 'java',
  go: 'go',
  dotnet: 'dotnet',
};

const ctx = (idioma: 'es' | 'en' = 'es', cambios: Partial<Contexto> = {}): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
  ...cambios,
});

describe('las 30 trazas (6 lenguajes × 5)', () => {
  expect(Object.keys(esperado)).toHaveLength(30);
  for (const [archivo, e] of Object.entries(esperado))
    it(archivo, () => {
      const t = analizarTraza(leer(archivo));
      expect(t, archivo).not.toBeNull();
      expect({
        lenguaje: t?.lenguaje,
        tipo: t?.tipo,
        mensaje: t?.mensaje,
        propios: t?.marcos.filter((m) => m.propio).length,
      }).toEqual({
        lenguaje: LENGUAJE[archivo.split('/')[0] ?? ''],
        ...e,
      });
      expect(lectorError.detectar({ texto: leer(archivo) })).toBe(0.9);
    });
});

describe('huella', () => {
  it('la misma traza con otras rutas, números y direcciones da la misma huella', () => {
    const original = leer('rust/01.txt');
    const otra = original
      .replaceAll('/home/diego/', '/Users/ana/')
      .replaceAll('142:17', '150:3')
      .replaceAll('30s', '45s')
      .replaceAll('90b35a6239c3d8bdabc530a6a0816f7ff89a0aaf', '129f3b9964af4d4a709d1383930ade12dfe7c081');
    expect(analizarError(otra).huella).toBe(analizarError(original).huella);
    const go = leer('go/02.txt');
    expect(analizarError(go.replaceAll('0xc0001a2000', '0xc000999000').replaceAll(':41', ':44')).huella).toBe(
      analizarError(go).huella,
    );
    const py = leer('python/01.txt');
    expect(analizarError(py.replaceAll('/home/ana/proyectos/', '/srv/')).huella).toBe(analizarError(py).huella);
  });

  it('dos errores con el mismo mensaje y distintos marcos propios no la comparten', () => {
    const a = analizarError(leer('java/01.txt'));
    const b = analizarError(
      leer('java/01.txt').replace('com.ejemplo.tienda.Cliente.validar', 'com.ejemplo.tienda.Proveedor.validar'),
    );
    expect(a.mensaje).toBe(b.mensaje);
    expect(a.huella).not.toBe(b.huella);
  });

  it('normaliza números, rutas, UUID e IP del mensaje', () => {
    expect(mensajeNormalizado("Could not find file '/app/datos/clientes.csv'. retry 3 at 10.0.0.1")).toBe(
      "Could not find file '<RUTA>'. retry <N> at <IP>",
    );
    expect(huellaDe({ lenguaje: 'go', tipo: 'panic', mensaje: 'x 1', marcos: [] })).toBe(
      huellaDe({ lenguaje: 'go', tipo: 'panic', mensaje: 'x 2', marcos: [] }),
    );
  });
});

describe('lector Error', () => {
  it('detecta un error suelto con menos confianza y no toma un log ni un texto', () => {
    expect(lectorError.detectar({ texto: 'TypeError: x is not a function' })).toBe(0.7);
    expect(lectorError.detectar({ texto: '2026-10-17T17:40:15Z ERROR gateway: read timeout' })).toBe(0);
    expect(lectorError.detectar({ texto: 'Hoy he revisado los errores del despliegue.' })).toBe(0);
  });

  it('respuesta nueva y repetida (con su nota), en es y en', async () => {
    const el = elementoFalso(1, leer('rust/01.txt'), 'error');
    const d = await lectorError.derivar(el);
    const frase = (c: Contexto) =>
      lectorError
        .respuesta(el, d, c)
        .texto.map((f) => ('v' in f ? f.v : f.ref))
        .join('');
    expect(frase(ctx())).toBe('Error de Rust nuevo. 2 marcos de tu código.');
    expect(frase(ctx('en'))).toBe('New Rust error. 2 frames from your code.');
    const antes = (n: number, dia: number) => ({
      ...elementoFalso(n, 'x', 'error').frontmatter,
      creado: `2026-10-${String(dia).padStart(2, '0')}T10:00:00+02:00`,
    });
    const repetida = ctx('es', {
      mismaHuella: [antes(2, 15), antes(3, 2)],
      notas: [
        {
          ref: 'ERR-0002',
          texto: 'Pasa cuando la respuesta no trae content-length',
          fecha: '2026-10-15T10:00:00+02:00',
        },
      ],
    });
    const r = lectorError.respuesta(el, d, repetida);
    expect(r.texto.map((f) => ('v' in f ? f.v : '')).join('')).toBe(
      'Es la tercera vez. El 15 oct escribiste: Pasa cuando la respuesta no trae content-length.',
    );
    expect(r.texto.find((f) => f.t === 'cita')).toBeTruthy();
    expect(lectorError.respuesta(el, d, ctx('es', { mismaHuella: [antes(2, 15)] })).texto[0]).toEqual({
      t: 'texto',
      v: 'Es la segunda vez.',
    });
    const sinPropios = elementoFalso(4, leer('rust/02.txt'), 'error');
    expect(lectorError.respuesta(sinPropios, await lectorError.derivar(sinPropios), ctx()).texto[0]).toEqual({
      t: 'texto',
      v: 'Error de Rust nuevo. Ningún marco es de tu código.',
    });
  });

  it('ordinales y cifras con el contexto', async () => {
    expect(ordinal(3, 'es')).toBe('tercera');
    expect(ordinal(11, 'es')).toBe('11.ª');
    expect(ordinal(3, 'en')).toBe('third');
    const el = elementoFalso(1, leer('python/03.txt'), 'error');
    const d = await lectorError.derivar(el);
    const otro = { ...elementoFalso(2, 'x', 'error').frontmatter, creado: '2026-10-02T10:00:00+02:00' };
    const c = ctx('es', { mismaHuella: [otro] });
    expect(lectorError.cifras?.ocurrencias?.(d, c, el).texto).toBe('2');
    expect(lectorError.cifras?.primera_vez?.(d, c, el).texto).toBe('2 oct');
    expect(lectorError.cifras?.ultima_vez?.(d, c, el).texto).toBe('18 oct');
  });

  it('título y resumen con la huella', async () => {
    const b = await lectorError.leer({ texto: leer('python/04.txt') });
    expect(b.titulo).toBe("AttributeError: 'NoneType' object has no attribute 'nombre'");
    expect(b.resumen).toMatchObject({ lenguaje: 'python', tipo: 'AttributeError', huellaVersion: 1 });
    expect(typeof b.resumen?.huella).toBe('string');
  });
});
