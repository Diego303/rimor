import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import { Repositorio } from '../../almacen/repositorio';
import { crearCapturador } from '../../captura/flujo';
import { construirContexto } from '../../respuestas/contexto';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizar, lectorEnlace } from './lector';
import { type ClaseEnlace, clasificar, normalizar, tituloDe } from './urls';

const corpus = JSON.parse(readFileSync(join(process.cwd(), 'fixtures/enlaces/clasificacion.json'), 'utf8')) as {
  url: string;
  clase: ClaseEnlace;
}[];

const ctx = (idioma: 'es' | 'en' = 'es', cambios: Partial<Contexto> = {}): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
  ...cambios,
});

describe('normalizar', () => {
  it('quita el seguimiento, ordena los parámetros y limpia host, puerto, fragmentos y barra final', () => {
    expect(normalizar('https://Example.COM:443/a/b/?utm_source=x&b=2&fbclid=1&a=1&gclid=2&ref=hn#')).toBe(
      'https://example.com/a/b?a=1&b=2',
    );
    expect(normalizar('https://user:pw@example.com/x#:~:text=hola')).toBe('https://example.com/x');
    expect(normalizar('https://example.com/docs#instalar')).toBe('https://example.com/docs#instalar');
    expect(normalizar('https://example.com/')).toBe('https://example.com/');
    expect(normalizar('http://example.com:80/x?ref_src=twsrc&q=1')).toBe('http://example.com/x?q=1');
  });

  it('DOI en todas sus formas a https://doi.org/…', () => {
    for (const d of [
      '10.1145/3368089.3409741',
      'doi:10.1145/3368089.3409741',
      'https://dx.doi.org/10.1145/3368089.3409741',
    ])
      expect(normalizar(d)).toBe('https://doi.org/10.1145/3368089.3409741');
  });

  it('es idempotente y rechaza lo que no es una URL', () => {
    for (const { url } of corpus) {
      const una = normalizar(url);
      expect(una, url).not.toBeNull();
      expect(normalizar(una ?? ''), url).toBe(una);
    }
    expect(normalizar('ftp://example.com')).toBeNull();
    expect(normalizar('no es una url')).toBeNull();
  });
});

describe('clasificar', () => {
  it('las 60 URL reales del corpus, todas bien', () => {
    expect(corpus).toHaveLength(60);
    const fallos = corpus.filter(({ url, clase }) => clasificar(normalizar(url) ?? '').clase !== clase);
    expect(fallos.map((f) => `${f.url} → ${clasificar(normalizar(f.url) ?? '').clase}, no ${f.clase}`)).toEqual([]);
  });

  it('casos límite: GitHub sin repo es otro; un repo con su árbol sigue siendo el repo', () => {
    expect(clasificar('https://github.com/').clase).toBe('otro');
    expect(clasificar('https://github.com/rust-lang').clase).toBe('otro');
    expect(clasificar('https://github.com/rust-lang/rust/tree/master/library')).toMatchObject({
      clase: 'repositorio',
      nombre: 'rust-lang/rust',
    });
  });
});

describe('título provisional', () => {
  it('legible según el destino', () => {
    const titulo = (u: string) => {
      const url = normalizar(u) ?? '';
      return tituloDe(url, clasificar(url));
    };
    expect(titulo('https://docs.rs/ureq/latest/ureq/')).toBe('ureq en docs.rs');
    expect(titulo('https://github.com/rust-lang/rust')).toBe('rust-lang/rust');
    expect(titulo('https://github.com/rust-lang/rust/issues/12345')).toBe('rust-lang/rust #12345');
    expect(titulo('https://crates.io/crates/serde')).toBe('serde en crates.io');
    expect(titulo('https://arxiv.org/abs/2310.06825')).toBe('arXiv 2310.06825');
    expect(titulo('10.1145/3368089.3409741')).toBe('DOI 10.1145/3368089.3409741');
    expect(titulo('https://martinfowler.com/articles/microservices.html')).toBe(
      'martinfowler.com · articles · microservices',
    );
  });
});

describe('respuesta', () => {
  const responder = async (texto: string, idioma: 'es' | 'en' = 'es', c: Partial<Contexto> = {}) => {
    const el = elementoFalso(1, texto, 'enlace');
    const d = await lectorEnlace.derivar(el);
    return lectorEnlace
      .respuesta(el, d, ctx(idioma, c))
      .texto.map((f) => ('v' in f ? f.v : ''))
      .join('');
  };

  it('una frase por destino, en es y en', async () => {
    expect(await responder('https://docs.rs/ureq/latest/ureq/')).toBe('Documentación de ureq en docs.rs.');
    expect(await responder('https://docs.rs/ureq/latest/ureq/', 'en')).toBe('ureq documentation on docs.rs.');
    expect(await responder('https://github.com/rust-lang/rust')).toBe('Repositorio rust-lang/rust en GitHub.');
    expect(await responder('https://github.com/microsoft/TypeScript/pull/57465')).toBe(
      'Pull request #57465 de microsoft/TypeScript en GitHub.',
    );
    expect(await responder('https://crates.io/crates/serde')).toBe('Paquete serde en crates.io.');
    expect(await responder('https://arxiv.org/abs/2310.06825')).toBe('Paper de arXiv 2310.06825.');
    expect(await responder('https://stackoverflow.com/questions/1/x')).toBe('Pregunta de Stack Overflow.');
    expect(await responder('https://youtu.be/abc')).toBe('Vídeo de YouTube.');
    expect(await responder('https://ejemplo.org/algo')).toBe('Enlace a ejemplo.org.');
  });

  it('si ya existía, «Ya lo guardaste el …» con la vez más antigua', async () => {
    const antiguo = { ...elementoFalso(2, 'x', 'enlace').frontmatter, creado: '2026-10-02T09:00:00+02:00' };
    const reciente = { ...elementoFalso(3, 'y', 'enlace').frontmatter, creado: '2026-10-10T09:00:00+02:00' };
    expect(await responder('https://docs.rs/ureq', 'es', { mismaHuella: [reciente, antiguo] })).toBe(
      'Documentación de ureq en docs.rs. Ya lo guardaste el 2 oct.',
    );
  });

  it('de punta a punta: la misma URL con otro seguimiento se recuerda', async () => {
    const repositorio = new Repositorio(new AlmacenMemoria());
    const capturador = crearCapturador({ repositorio, registro: REGISTRO, reloj: () => new Date(2026, 9, 2, 9) });
    const primera = await capturador.capturar({ texto: 'https://docs.rs/ureq?utm_source=a', origen: 'pegado' });
    expect(primera.ok && primera.valor.tipo === 'creado' && primera.valor.capturado.elemento.frontmatter).toMatchObject(
      {
        tipo: 'enlace',
        ref: 'URL-0001',
        titulo: 'ureq en docs.rs',
        url: 'https://docs.rs/ureq',
      },
    );
    const r = await capturador.capturar({ texto: 'https://docs.rs/ureq?utm_source=b', origen: 'pegado' });
    if (!r.ok || r.valor.tipo !== 'creado') throw new Error('no creado');
    const el = r.valor.capturado.elemento;
    const datos = await lectorEnlace.derivar(el);
    const contexto = await construirContexto(el, repositorio, 'es', { resumen: lectorEnlace.resumen(datos) });
    const frase = lectorEnlace
      .respuesta(el, datos, contexto)
      .texto.map((f) => ('v' in f ? f.v : ''))
      .join('');
    expect(frase).toBe('Documentación de ureq en docs.rs. Ya lo guardaste el 2 oct.');
  });

  it('sin red: analizar no hace ninguna petición', () => {
    expect(analizar('https://github.com/rust-lang/rust')).toMatchObject({ clase: 'repositorio' });
    expect(analizar('hola')).toBeNull();
  });
});
