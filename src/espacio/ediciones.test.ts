import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../lectores/pruebas/falsos';
import {
  anadirColeccion,
  aplicarCambios,
  conColecciones,
  conEstado,
  conEtiquetas,
  conFijado,
  limpiarColeccion,
  limpiarEtiqueta,
  listaDeTexto,
  tituloNuevo,
} from './ediciones';
import { estadosPosibles, estadoVisible, tonoDeEstado } from './estados';

const fm = () => elementoFalso(1, 'hola', 'texto').frontmatter;

describe('ediciones del frontmatter', () => {
  it('fijar y soltar: soltar quita la clave (no deja `fijado: false`)', () => {
    const fijado = conFijado(fm(), true);
    expect(fijado.fijado).toBe(true);
    expect('fijado' in conFijado(fijado, false)).toBe(false);
  });

  it('estado: «nuevo» o ninguno es no tener estado', () => {
    expect(conEstado(fm(), 'resuelto').estado).toBe('resuelto');
    expect('estado' in conEstado(conEstado(fm(), 'resuelto'), 'nuevo')).toBe(false);
    expect('estado' in conEstado(conEstado(fm(), 'resuelto'), undefined)).toBe(false);
  });

  it('colecciones y etiquetas: la lista vacía quita la clave; añadir no repite', () => {
    const con = conColecciones(fm(), ['gateway']);
    expect(anadirColeccion(con, 'gateway').colecciones).toEqual(['gateway']);
    expect(anadirColeccion(con, 'prompts').colecciones).toEqual(['gateway', 'prompts']);
    expect('colecciones' in conColecciones(con, [])).toBe(false);
    expect(conEtiquetas(fm(), ['ureq']).etiquetas).toEqual(['ureq']);
    expect('etiquetas' in conEtiquetas(conEtiquetas(fm(), ['ureq']), [])).toBe(false);
  });

  it('listas escritas a mano: con @ o #, comas o espacios, sin repetir', () => {
    expect(listaDeTexto(' @Gateway, prompts  @gateway ', limpiarColeccion)).toEqual(['gateway', 'prompts']);
    expect(listaDeTexto('#ureq #staging,#ureq', limpiarEtiqueta)).toEqual(['ureq', 'staging']);
    expect(listaDeTexto('   ', limpiarEtiqueta)).toEqual([]);
    expect(listaDeTexto('# @', limpiarColeccion)).toEqual(['#']);
  });

  it('aplicar cambios de una lista sobre la de ahora: no pierde lo que otro añadió mientras se editaba', () => {
    // Se empezó con [a, b]; mientras se escribía, otro añadió c; se guardó «a d».
    expect(aplicarCambios(['a', 'b', 'c'], ['a', 'b'], ['a', 'd'])).toEqual(['a', 'c', 'd']);
    // Sin cambios de otro, queda lo escrito.
    expect(aplicarCambios(['a', 'b'], ['a', 'b'], ['b', 'e'])).toEqual(['b', 'e']);
    // Lo que otro quitó mientras tanto no vuelve si no se escribió de nuevo.
    expect(aplicarCambios(['a'], ['a', 'b'], ['a', 'b'])).toEqual(['a']);
  });

  it('título: en una línea y sin espacios de más; vacío o igual no cambia', () => {
    expect(tituloNuevo('Viejo', '  Nuevo\n  título ')).toBe('Nuevo título');
    expect(tituloNuevo('Viejo', '   ')).toBeNull();
    expect(tituloNuevo('Viejo', ' Viejo ')).toBeNull();
  });
});

describe('estados ligeros', () => {
  const idea = { estados: ['semilla', 'explorando', 'convertida'], estadosElegibles: ['semilla', 'explorando'] };

  it('sin estado es «nuevo», o el primero propio del tipo', () => {
    expect(estadoVisible(undefined, null)).toBe('nuevo');
    expect(estadoVisible(undefined, idea)).toBe('semilla');
    expect(estadoVisible('resuelto', idea)).toBe('resuelto');
  });

  it('los que se eligen: «nuevo» y los comunes; con propios, los elegibles y los comunes', () => {
    expect(estadosPosibles(null)).toEqual(['nuevo', 'en-uso', 'resuelto', 'archivado']);
    expect(estadosPosibles(idea)).toEqual(['semilla', 'explorando', 'en-uso', 'resuelto', 'archivado']);
    // El actual siempre está, aunque no se elija a mano (una idea convertida, un estado de otra versión).
    expect(estadosPosibles(idea, 'convertida')[0]).toBe('convertida');
    expect(estadosPosibles(null, 'bloqueado')).toEqual(['bloqueado', 'nuevo', 'en-uso', 'resuelto', 'archivado']);
  });

  it('tonos como los de la referencia', () => {
    expect(tonoDeEstado('nuevo')).toBe('acc');
    expect(tonoDeEstado('resuelto')).toBe('ok');
    expect(tonoDeEstado('semilla')).toBe('warn');
    expect(tonoDeEstado('archivado')).toBe('neutro');
  });
});
