import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type Elemento, hashOriginal } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { RepositorioEntidades } from '../almacen/entidades';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { analizar, partirLineas } from '../lectores/log/analisis';
import { lectorLog } from '../lectores/log/lector';
import { lectorMediciones } from '../lectores/mediciones/lector';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { comparables } from './clases';
import { calcular, crearComparacion } from './crear';
import { compararLogs } from './logs';
import { compararMediciones } from './mediciones';
import { cifrasDeResultado, fuentesCambiadas, leerResultado, textoCambio } from './resultado';

const leer = (ruta: string) => readFileSync(join(process.cwd(), ruta), 'utf8');
const esperado = JSON.parse(leer('fixtures/comparaciones/esperado.json'));
const buena = leer('fixtures/comparaciones/buena.log');
const mala = leer('fixtures/comparaciones/mala.log');
const reqwest = leer('fixtures/mediciones/reqwest.txt');
const ureq = leer('fixtures/mediciones/ureq.txt');

/** Un elemento del tipo y lector dados con su original. */
function elemento(n: number, tipo: 'log' | 'mediciones' | 'texto', original: string, titulo = `E${n}`): Elemento {
  const base = elementoFalso(n, original, tipo === 'texto' ? 'texto' : tipo === 'log' ? 'log' : 'mediciones');
  const prefijo = { log: 'LOG', mediciones: 'MED', texto: 'TXT' }[tipo];
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      ref: `${prefijo}-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      tipo,
      titulo,
      hash: hashOriginal(original),
    },
  };
}

const derivar = (el: Elemento) =>
  el.frontmatter.tipo === 'log' ? lectorLog.derivar(el) : lectorMediciones.derivar(el);

describe('comparar logs', () => {
  it('CMP-0005 da lo de la referencia: se separan en la línea 4, 4 nuevos, 4 ausentes y 2 que cambian', () => {
    const c = compararLogs(analizar(buena), analizar(mala));
    const e = esperado['CMP-0005'];
    expect((c.divergencia ?? -1) + 1).toBe(e.divergencia);
    expect(c.nuevos).toHaveLength(e.nuevos);
    expect(c.ausentes).toHaveLength(e.ausentes);
    expect(c.cambian).toHaveLength(e.cambian);
    // Las líneas de cada una en ese punto (alineadas con las del original).
    expect(partirLineas(buena)[c.divergencia ?? 0]).toBe(e.linea_buena);
    expect(partirLineas(mala)[c.divergencia ?? 0]).toBe(e.linea_mala);
    expect(c.nuevos[0]).toMatch(/^WARN +http: response has no content-length/);
    expect(c.cambian.map((x) => [x.a, x.b])).toEqual([
      [1, 2],
      [1, 2],
    ]);
  });

  it('iguales (aunque cambien fechas, IDs y números): sin divergencia ni diferencias', () => {
    const otra = buena.replaceAll('16:40', '09:12').replaceAll('bytes=212', 'bytes=999');
    const c = compararLogs(analizar(buena), analizar(otra));
    expect(c).toMatchObject({ divergencia: null, nuevos: [], ausentes: [], cambian: [] });
    // Un salto de línea de más al final tampoco los separa.
    expect(compararLogs(analizar(buena), analizar(`${buena}\n\n`)).divergencia).toBeNull();
  });

  it('una que sigue igual pero es más larga se separa donde se acaba la otra; una vacía, en la primera', () => {
    const corta = partirLineas(buena).slice(0, 5).join('\n');
    expect(compararLogs(analizar(corta), analizar(buena)).divergencia).toBe(5);
    const vacia = compararLogs(analizar(''), analizar(buena));
    expect(vacia.divergencia).toBe(0);
    expect(vacia.ausentes).toEqual([]);
    expect(vacia.nuevos.length).toBeGreaterThan(0);
  });
});

describe('comparar mediciones', () => {
  it('CMP-0004 da lo de la referencia: −4,5 % y p < 0,001', async () => {
    const a = await lectorMediciones.derivar(elemento(7, 'mediciones', reqwest));
    const b = await lectorMediciones.derivar(elemento(8, 'mediciones', ureq));
    const c = compararMediciones(a, b);
    if (!c) throw new Error('sin comparación');
    const e = esperado['CMP-0004'];
    expect(c.a.d.mediana).toBeCloseTo(e.mediana_a, 6);
    expect(c.b.d.mediana).toBeCloseTo(e.mediana_b, 6);
    expect(c.resultado.significativo).toBe(e.significativo);
    expect(c.resultado.sentido).toBe('baja');
    const cifras = Object.fromEntries(
      cifrasDeResultado(
        {
          version: 1,
          clase: 'mediciones',
          fuentes_hash: [],
          cambio: c.resultado.cambio,
          p: c.resultado.p,
          significativo: true,
          sentido: 'baja',
          mediana_a: c.a.d.mediana,
          mediana_b: c.b.d.mediana,
          unidad: c.unidad,
          n_a: 20,
          n_b: 20,
        },
        'es',
      ),
    );
    const sinNbsp = (s: string | undefined) => s?.replaceAll(' ', ' ');
    expect(sinNbsp(cifras.cambio)).toBe(e.cambio);
    expect(sinNbsp(cifras.p)).toBe(e.p);
    expect(sinNbsp(cifras.mediana_a)).toBe('38,54 ms');
  });

  it('unidades distintas se pasan a ms; sin valores no hay comparación', async () => {
    const enS = await lectorMediciones.derivar(elemento(9, 'mediciones', '# lenta\n12.1 s\n12.4 s\n11.9 s\n12.2 s'));
    const enMs = await lectorMediciones.derivar(elemento(10, 'mediciones', '# rápida\n9800 ms\n9900 ms\n9750 ms'));
    const c = compararMediciones(enS, enMs);
    expect(c?.unidad).toBe('ms');
    expect(c?.a.d.mediana).toBeCloseTo(12150, 6);
    expect(c?.resultado.sentido === 'baja' || c?.resultado.sentido === 'igual').toBe(true);
    expect(compararMediciones({ formato: 'lineas', series: [] }, enMs)).toBeNull();
  });
});

describe('qué se compara y lo que se guarda', () => {
  it('solo dos del mismo tipo comparable, y no consigo mismo', () => {
    const log = elemento(1, 'log', buena).frontmatter;
    expect(comparables(log, elemento(2, 'log', mala).frontmatter)).toEqual({ clase: 'logs' });
    expect(comparables(log, log)).toEqual({ motivo: 'mismo' });
    expect(comparables(log, elemento(3, 'mediciones', reqwest).frontmatter)).toEqual({ motivo: 'distintoTipo' });
    expect(comparables(elemento(4, 'texto', 'a').frontmatter, elemento(5, 'texto', 'b').frontmatter)).toEqual({
      motivo: 'sinComparacion',
    });
  });

  it('un log que leyó otro lector no se compara; el motivo llega como error', async () => {
    const a = elemento(1, 'log', buena);
    const b = { ...elemento(2, 'log', mala) };
    b.frontmatter = { ...b.frontmatter, lector: { nombre: 'archivo', version: 1, resumen: {} } };
    const r = await calcular(a, b, derivar);
    expect(!r.ok && r.error.codigo).toBe('comparacion.sinComparacion');
    const distinto = await calcular(a, elemento(3, 'mediciones', reqwest), derivar);
    expect(!distinto.ok && distinto.error.codigo).toBe('comparacion.distintoTipo');
  });

  it('crear guarda la comparación con sus fuentes, su resultado y la huella de cada fuente', async () => {
    const almacen = new AlmacenMemoria();
    const repositorio = new Repositorio(almacen);
    const entidades = new RepositorioEntidades(almacen, ['comparacion']);
    await repositorio.guardarElemento(elemento(7, 'mediciones', reqwest, 'reqwest 64 KB'));
    await repositorio.guardarElemento(elemento(8, 'mediciones', ureq, 'ureq 64 KB'));
    const r = await crearComparacion('MED-0007', 'MED-0008', {
      repositorio,
      entidades,
      derivar,
      titular: (a, b) => `${a} frente a ${b}`,
      reloj: () => new Date('2026-10-16T18:21:00+02:00'),
    });
    expect(r.ok && r.valor).toBe('CMP-0001');
    const fm = entidades.frontmatter('CMP-0001');
    expect(fm).toMatchObject({
      titulo: 'reqwest frente a ureq',
      clase: 'mediciones',
      fuentes: ['MED-0007', 'MED-0008'],
    });
    const resultado = leerResultado((fm as { resultado: Record<string, unknown> }).resultado);
    expect(resultado?.clase).toBe('mediciones');
    expect(fuentesCambiadas(resultado, [hashOriginal(reqwest), hashOriginal(ureq)])).toEqual([]);
    expect(fuentesCambiadas(resultado, [hashOriginal(reqwest), hashOriginal('otra')])).toEqual([1]);
    // Una segunda, con la siguiente ref.
    const otra = await crearComparacion('MED-0008', 'MED-0007', {
      repositorio,
      entidades,
      derivar,
      titular: (a, b) => `${a} frente a ${b}`,
    });
    expect(otra.ok && otra.valor).toBe('CMP-0002');
    // Una que no existe.
    const falta = await crearComparacion('MED-0007', 'MED-0099', { repositorio, entidades, derivar, titular: String });
    expect(!falta.ok && falta.error.codigo).toBe('almacen.noEncontrado');
  });

  it('el resultado guardado de otra versión o editado a mano no se usa (se recalcula)', () => {
    expect(leerResultado({ version: 99, clase: 'logs', fuentes_hash: [] })).toBeNull();
    expect(leerResultado({ version: 1, clase: 'logs', fuentes_hash: [], divergencia: 'x', nuevos: 1 })).toBeNull();
    expect(fuentesCambiadas(null, ['a', 'b'])).toEqual([0, 1]);
    expect(textoCambio(3.14, 'es').replace(' ', ' ')).toBe('+3,1 %');
    expect(textoCambio(null, 'es')).toBe('—');
  });
});
