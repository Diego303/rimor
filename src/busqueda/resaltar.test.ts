import { describe, expect, it } from 'vitest';
import { resaltar } from './resaltar';

const marcas = (texto: string, terminos: string[]) =>
  resaltar(texto, terminos)
    .map((t) => (t.marca ? `[${t.texto}]` : t.texto))
    .join('');

describe('resaltar', () => {
  it('marca lo que casa, sin acentos ni mayúsculas, con el texto tal cual', () => {
    expect(marcas('Timeout en streaming', ['timeout', 'stream'])).toBe('[Timeout] en [stream]ing');
    expect(marcas('La Canción de ÁLVARO', ['cancion', 'alvaro'])).toBe('La [Canción] de [ÁLVARO]');
    expect(marcas('timeout timeout', ['timeout'])).toBe('[timeout] [timeout]');
    expect(marcas('readtimeout', ['read', 'timeout'])).toBe('[readtimeout]');
  });

  it('nada que marcar: términos de una letra, sin términos o texto vacío', () => {
    expect(marcas('a b c', ['a'])).toBe('a b c');
    expect(marcas('hola', [])).toBe('hola');
    expect(resaltar('', ['hola'])).toEqual([]);
  });

  it('caracteres que se descomponen (ligaduras, emojis) no descuadran las posiciones', () => {
    expect(marcas('ﬁn del ﬁchero', ['fichero'])).toBe('ﬁn del [ﬁchero]');
    expect(marcas('🔥 timeout 🔥', ['timeout'])).toBe('🔥 [timeout] 🔥');
  });
});
