import { describe, expect, it } from 'vitest';
import { REGISTRO } from '../lectores/registro';
import { LARGO_MAXIMO, MAX_BLOQUES, MAX_ENLACES, partes } from './dividir';
import { previsualizar } from './previa';

const TRAZA = [
  'Traceback (most recent call last):',
  '  File "/app/pagos.py", line 42, in cobrar',
  '    total = importe / cantidad',
  'ZeroDivisionError: division by zero',
].join('\n');
const CURL = "curl -X POST https://api.ejemplo.es/v1/pagos -H 'Content-Type: application/json' -d '{\"id\": 7}'";

describe('partir un pegado', () => {
  it('varias URL o DOI, una por línea (con líneas en blanco entre medias), son una parte cada una', () => {
    expect(partes('https://a.es/x\n\nhttps://b.es/y \n10.1000/xyz123')).toEqual({
      via: 'enlaces',
      partes: ['https://a.es/x', 'https://b.es/y', '10.1000/xyz123'],
    });
  });

  it('si no, los bloques separados por una o más líneas en blanco (también con espacios)', () => {
    expect(partes('uno\ndos\n\n\n tres\n  \t\ncuatro\r\n\r\ncinco  ')).toEqual({
      via: 'bloques',
      partes: ['uno\ndos', ' tres', 'cuatro', 'cinco'],
    });
  });

  it('una sola cosa, demasiadas o demasiado largo: nada', () => {
    expect(partes('https://a.es/x')).toBeNull();
    expect(partes('\n\nuna cosa\n\n')).toBeNull();
    expect(partes('https://a.es/x y algo más\nhttps://b.es')).toBeNull();
    const enlaces = Array.from({ length: MAX_ENLACES + 1 }, (_, i) => `https://a.es/${i}`).join('\n');
    expect(partes(enlaces)).toBeNull();
    const bloques = Array.from({ length: MAX_BLOQUES + 1 }, (_, i) => `b${i}`).join('\n\n');
    expect(partes(bloques)).toBeNull();
    expect(partes(`a\n\nb${'x'.repeat(LARGO_MAXIMO)}`)).toBeNull();
  });

  it('un tramo largo de espacios dentro de un bloque no lo vuelve lento (sin retroceso cuadrático)', () => {
    const texto = `uno\n\nb${' '.repeat(200_000)}c`;
    const inicio = performance.now();
    expect(partes(texto)?.partes).toHaveLength(2);
    expect(performance.now() - inicio).toBeLessThan(200);
  });
});

describe('cuándo ofrece dividir la vista previa', () => {
  it('varias URL, siempre', () => {
    expect(previsualizar('https://a.es/x\nhttps://b.es/y\nhttps://c.es/z', REGISTRO).division).toEqual({
      n: 3,
      via: 'enlaces',
    });
  });

  it('bloques que son cosas (dos trazas, una traza y un curl detrás), sí', () => {
    expect(previsualizar(`${TRAZA}\n\n${TRAZA.replace('42', '43')}`, REGISTRO).division).toEqual({
      n: 2,
      via: 'bloques',
    });
    expect(previsualizar(`${TRAZA}\n\n${CURL}`, REGISTRO).division?.n).toBe(2);
    // Una mezcla que nadie reconoce entera (Texto) también.
    const json = '{"pedido": 7, "estado": "pagado", "lineas": [1, 2]}';
    expect(previsualizar(`${json}\n\n${TRAZA}\n\n${CURL}`, REGISTRO).division?.n).toBe(3);
  });

  it('una orden con su salida es una sola cosa: no se divide', () => {
    const peticion =
      '$ curl -i https://api.ejemplo.es/v1/pagos\nHTTP/2 500\ncontent-type: application/json\n\n{"error": "fallo", "codigo": 7}';
    expect(previsualizar(peticion, REGISTRO).division).toBeUndefined();
    const prueba =
      '$ npm test\n> vitest run\n\n FAIL  src/a.test.ts\nError: boom\n    at Object.<anonymous> (src/a.test.ts:3:9)';
    expect(previsualizar(prueba, REGISTRO).division).toBeUndefined();
  });

  it('notas con párrafos, un código, un log con huecos o un Markdown, no', () => {
    expect(previsualizar('Primera idea de la reunión.\n\nSegunda idea, distinta.', REGISTRO).division).toBeUndefined();
    const codigo = 'def a():\n    return 1\n\n\ndef b():\n    return 2\n';
    expect(previsualizar(codigo, REGISTRO).division).toBeUndefined();
    const log = [
      '2026-10-17T17:40:00Z INFO arranque',
      '2026-10-17T17:40:01Z ERROR fallo',
      '',
      '2026-10-17T17:41:00Z INFO otra vez',
      '2026-10-17T17:41:01Z WARN lento',
    ].join('\n');
    expect(previsualizar(log, REGISTRO).division).toBeUndefined();
    expect(previsualizar('# Título\n\nPárrafo.\n\n## Otro\n\nMás.', REGISTRO).division).toBeUndefined();
  });

  it('con las indicaciones fuera: un /log no divide; @colección y #etiqueta no cuentan como bloque', () => {
    expect(previsualizar(`/log ${TRAZA}\n\n${TRAZA}`, REGISTRO).division).toBeUndefined();
    expect(previsualizar('https://a.es/x\nhttps://b.es/y\n@lecturas #web', REGISTRO).division?.n).toBe(2);
  });
});
