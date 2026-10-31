import type { FrontmatterComun } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { clavesDe, DIAS_CUANDO, elementosDe, enGrupo, mesDe, panelDe, rutasDeGrupo } from './grupos';

/** Un elemento del día `dia` de octubre de 2026 a las 12:00 locales. */
function fm(i: number, dia: number, cambios: Partial<FrontmatterComun> = {}, resumen = {}): FrontmatterComun {
  const base = elementoFalso(i).frontmatter;
  return {
    ...base,
    creado: new Date(2026, 9, dia, 12).toISOString(),
    ...cambios,
    lector: { ...base.lector, resumen },
  };
}

const claves = (f: FrontmatterComun) => clavesDe(f).map((c) => `${c.clase}:${c.valor}`);

describe('las claves de grupo de un elemento', () => {
  it('colección, sesión, etiquetas, tipo y mes de cualquiera', () => {
    expect(claves(fm(1, 16, { colecciones: ['gateway'], sesion: 's', etiquetas: ['ureq', 'ureq'] }))).toEqual([
      'coleccion:gateway',
      'sesion:s',
      'etiqueta:ureq',
      'tipo:texto',
      'mes:2026-10',
    ]);
  });

  it('la huella de un error; el dominio, el repositorio o el paquete de un enlace; el dominio de una petición', () => {
    expect(claves(fm(1, 16, { tipo: 'error' }, { huella: 'abc123' }))).toContain('huella:abc123');
    // La huella de un enlace (su URL) no es la de un error.
    expect(claves(fm(1, 16, { tipo: 'enlace' }, { huella: 'https://x.es' })).some((c) => c.startsWith('huella'))).toBe(
      false,
    );
    expect(claves(fm(1, 16, { tipo: 'enlace' }, { url: 'https://github.com/algesten/ureq/issues/12' }))).toEqual(
      expect.arrayContaining(['dominio:github.com', 'repositorio:GitHub/algesten/ureq']),
    );
    expect(claves(fm(1, 16, { tipo: 'enlace' }, { url: 'https://www.npmjs.com/package/react' }))).toEqual(
      expect.arrayContaining(['dominio:npmjs.com', 'paquete:npm/react']),
    );
    expect(claves(fm(1, 16, { tipo: 'enlace' }, { url: 'https://www.ejemplo.es/a' }))).toContain('dominio:ejemplo.es');
    expect(claves(fm(1, 16, { tipo: 'http' }, { host: 'API.Ejemplo.es' }))).toContain('dominio:api.ejemplo.es');
    // Sin URL que se entienda, nada.
    expect(claves(fm(1, 16, { tipo: 'enlace' }, { url: 'no es una url' })).some((c) => c.startsWith('dominio'))).toBe(
      false,
    );
  });

  it('dominios, repositorios y paquetes comparables: sin www ni m, legibles, sin puerto ni credenciales, sin .git', () => {
    const de = (url: string) => claves(fm(1, 16, { tipo: 'enlace' }, { url }));
    expect(de('https://m.youtube.com/watch?v=x')).toContain('dominio:youtube.com');
    expect(de('https://xn--mnchen-3ya.de/a')).toContain('dominio:münchen.de');
    expect(de('https://github.com/Algesten/Ureq.git')).toContain('repositorio:GitHub/algesten/ureq');
    expect(de('https://pypi.org/project/Requests/')).toContain('paquete:PyPI/requests');
    expect(claves(fm(2, 16, { tipo: 'http' }, { host: 'yo:secreto@API.local:8080' }))).toContain('dominio:api.local');
    // Las etiquetas que solo cambian en mayúsculas, una vez.
    expect(claves(fm(3, 16, { etiquetas: ['Ureq', 'ureq'] })).filter((c) => c.startsWith('etiqueta'))).toEqual([
      'etiqueta:Ureq',
    ]);
  });

  it('el orden y «desde» por el instante, aunque las fechas lleven desfases distintos (cambio de hora)', () => {
    // 02:50+02:00 es 00:50Z; 02:10+01:00 es 01:10Z: el segundo es el más reciente.
    const antes = { ...fm(1, 25), creado: '2026-10-25T02:50:00+02:00' };
    const despues = { ...fm(2, 25), creado: '2026-10-25T02:10:00+01:00' };
    expect(elementosDe('mes', '2026-10', [antes, despues]).map((f) => f.ref)).toEqual([despues.ref, antes.ref]);
    expect(panelDe([despues, antes], new Date(2026, 9, 26)).desde).toBe(antes.creado);
  });

  it('los de un grupo, de lo más reciente a lo más antiguo; la etiqueta sin distinguir mayúsculas', () => {
    const lista = [fm(1, 2, { etiquetas: ['Ureq'] }), fm(2, 9, { etiquetas: ['ureq'] }), fm(3, 5)];
    expect(elementosDe('etiqueta', 'ureq', lista).map((f) => f.ref)).toEqual([lista[1]?.ref, lista[0]?.ref]);
    expect(enGrupo(fm(4, 16), 'mes', '2026-10')).toBe(true);
    expect(enGrupo(fm(4, 16), 'tipo', 'log')).toBe(false);
    expect(mesDe('nada')).toBeUndefined();
  });
});

describe('el panel de un grupo', () => {
  const ahora = new Date(2026, 9, 17, 18);

  it('qué hay (por tipo), cuándo (14 días con su pico) y desde cuándo', () => {
    const lista = [
      fm(1, 16, { tipo: 'log' }),
      fm(2, 16, { tipo: 'log' }),
      fm(3, 15, { tipo: 'error' }),
      fm(4, 1, { tipo: 'enlace' }),
    ];
    const p = panelDe(lista, ahora);
    expect(p.total).toBe(4);
    expect(p.tipos).toEqual([
      { tipo: 'log', n: 2 },
      { tipo: 'error', n: 1 },
      { tipo: 'enlace', n: 1 },
    ]);
    expect(p.dias).toHaveLength(DIAS_CUANDO);
    expect(p.dias.at(-1)).toEqual({ dia: '2026-10-17', n: 0 });
    expect(p.dias.find((d) => d.dia === '2026-10-16')?.n).toBe(2);
    expect(p.pico).toBe('2026-10-16');
    expect(p.desde).toBe(lista[3]?.creado);
    expect(panelDe([fm(5, 1)], ahora).pico).toBeNull();
  });

  it('se repite: la huella de error con más veces (al menos dos), con la última', () => {
    const error = (i: number, dia: number, huella: string) => fm(i, dia, { tipo: 'error' }, { huella });
    const p = panelDe([error(1, 10, 'a'), error(2, 12, 'a'), error(3, 11, 'b'), error(4, 13, 'a')], ahora);
    expect(p.repetido?.huella).toBe('a');
    expect(p.repetido?.veces).toBe(3);
    expect(p.repetido?.ultimo.ref).toBe(error(4, 13, 'a').ref);
    expect(panelDe([error(1, 10, 'a'), error(2, 12, 'b')], ahora).repetido).toBeNull();
  });
});

describe('lo que exporta un grupo', () => {
  it('el .md de cada uno, su adjunto, su historial (también el de sus alias), sus hilos y los registros', () => {
    const conAdjunto = fm(2, 16, {
      adjunto: { hash: 'sha256:x', ruta: 'adjuntos/ab/x.bin', tam: 3 },
      alias: ['TXT-0099'],
      hilo: 'HIL-0001',
    } as Partial<FrontmatterComun>);
    const r = rutasDeGrupo(
      [fm(1, 16), conAdjunto, fm(3, 16)],
      (id) => (id === fm(3, 16).id ? undefined : `elementos/${id}.md`),
      (ref) => (ref === 'HIL-0001' ? 'hilos/HIL-0001--timeout.md' : undefined),
    );
    expect(r.rutas).toEqual([
      'colecciones.json',
      'sesiones.json',
      `elementos/${fm(1, 16).id}.md`,
      `elementos/${conAdjunto.id}.md`,
      'adjuntos/ab/x.bin',
      'hilos/HIL-0001--timeout.md',
    ]);
    expect(r.prefijos).toEqual([`historial/${fm(1, 16).ref}/`, `historial/${conAdjunto.ref}/`, 'historial/TXT-0099/']);
  });
});
