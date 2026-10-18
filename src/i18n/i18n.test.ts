import { afterEach, describe, expect, it } from 'vitest';
import en from './en.json';
import es from './es.json';
import { type Clave, cambiarIdioma, idiomaActivo, idiomaInicial, suscribir, t, traducir } from './i18n';

/** Hojas `ruta → texto` de un catálogo (los plurales, por categoría). */
function hojas(nodo: unknown, prefijo = ''): Map<string, string> {
  const salida = new Map<string, string>();
  if (typeof nodo === 'string') salida.set(prefijo, nodo);
  else if (nodo && typeof nodo === 'object')
    for (const [k, v] of Object.entries(nodo))
      for (const [r, x] of hojas(v, prefijo ? `${prefijo}.${k}` : k)) salida.set(r, x);
  return salida;
}
const variables = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('catálogos', () => {
  const hes = hojas(es);
  const hen = hojas(en);

  it('es y en tienen las mismas claves', () => {
    expect([...hen.keys()].sort()).toEqual([...hes.keys()].sort());
  });

  it('cada texto tiene las mismas variables en los dos idiomas', () => {
    for (const [clave, texto] of hes) expect(variables(hen.get(clave) ?? ''), clave).toEqual(variables(texto));
  });

  it('ningún texto está vacío', () => {
    for (const [clave, texto] of [...hes, ...hen]) expect(texto.trim(), clave).not.toBe('');
  });
});

describe('traducir', () => {
  it('interpola variables y deja visibles las que faltan', () => {
    expect(traducir('es', 'comun.enesimaVez', { ordinal: '3.ª' })).toBe('3.ª vez');
    expect(traducir('es', 'comun.enesimaVez')).toBe('{ordinal} vez');
  });

  it('elige la forma plural por idioma', () => {
    expect(traducir('es', 'comun.vez', { n: 1 })).toBe('1 vez');
    expect(traducir('es', 'comun.vez', { n: 3 })).toBe('3 veces');
    expect(traducir('en', 'comun.vez', { n: 1 })).toBe('1 time');
    expect(traducir('en', 'comun.vez', { n: 0 })).toBe('0 times');
  });

  it('una clave inexistente se devuelve tal cual', () => {
    expect(traducir('en', 'no.existe' as Clave)).toBe('no.existe');
  });
});

describe('idioma activo', () => {
  afterEach(() => cambiarIdioma('es'));

  it('cambia en caliente y avisa a los suscriptores', () => {
    let avisos = 0;
    const baja = suscribir(() => avisos++);
    expect(t('tipos.hilo')).toBe('Hilo');
    cambiarIdioma('en');
    expect(idiomaActivo()).toBe('en');
    expect(t('tipos.hilo')).toBe('Thread');
    cambiarIdioma('en');
    expect(avisos).toBe(1);
    baja();
    cambiarIdioma('es');
    expect(avisos).toBe(1);
  });

  it('idioma inicial: el guardado, el inglés del navegador o el español', () => {
    expect(idiomaInicial('en', 'es-ES')).toBe('en');
    expect(idiomaInicial(null, 'en-US')).toBe('en');
    expect(idiomaInicial(null, 'fr-FR')).toBe('es');
    expect(idiomaInicial('xx', undefined)).toBe('es');
  });
});
