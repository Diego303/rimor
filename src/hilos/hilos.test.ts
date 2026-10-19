import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Elemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { RepositorioEntidades } from '../almacen/entidades';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { crearCapturador } from '../captura/flujo';
import { lectorError } from '../lectores/error/lector';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { REGISTRO } from '../lectores/registro';
import { construirContexto } from '../respuestas/contexto';
import { formarPorHuella } from './formar';
import { anadirAHilo, crearHilo, elementosDe, hiloDe, hiloPara, moverAHilo, reabrir, resolver } from './hilos';

function montar() {
  const almacen = new AlmacenMemoria();
  const repositorio = new Repositorio(almacen);
  const entidades = new RepositorioEntidades(almacen, ['hilo']);
  return { repositorio, entidades, d: { repositorio, entidades } };
}

/** Un error con su huella ya en el resumen (lo que deja el lector al derivar), creado `n` minutos después. */
function error(n: number, huella: string): Elemento {
  const base = elementoFalso(n, `traza ${n}`, 'error');
  return {
    ...base,
    frontmatter: {
      ...base.frontmatter,
      ref: `ERR-${String(n).padStart(4, '0')}` as Elemento['frontmatter']['ref'],
      tipo: 'error',
      titulo: `read timeout ${n}`,
      creado: `2026-10-0${n}T10:00:00+02:00`,
      lector: { nombre: 'error', version: 1, resumen: { huella } },
    },
  };
}

describe('hilos', () => {
  it('crear, añadir, mover y sacar: un elemento en un solo hilo, en el orden en que se capturaron', async () => {
    const { repositorio, entidades, d } = montar();
    for (const n of [1, 2, 3]) await repositorio.guardarElemento(error(n, `h${n}`));
    const a = await crearHilo('Uno', ['ERR-0002', 'ERR-0001'], d);
    expect(a).toBe('HIL-0001');
    expect(elementosDe(a, repositorio).map((fm) => fm.ref)).toEqual(['ERR-0001', 'ERR-0002']);
    const b = await crearHilo('Dos', ['ERR-0003'], d);
    // Mover: sale del que tenía.
    await moverAHilo('ERR-0002', b, d);
    expect(elementosDe(a, repositorio).map((fm) => fm.ref)).toEqual(['ERR-0001']);
    expect(elementosDe(b, repositorio).map((fm) => fm.ref)).toEqual(['ERR-0002', 'ERR-0003']);
    await moverAHilo('ERR-0001', null, d);
    expect(repositorio.frontmatter('ERR-0001')?.hilo).toBeUndefined();
    expect(hiloDe(a, entidades)?.titulo).toBe('Uno');
    // Para responder: el hilo que ya tiene, o uno nuevo con él.
    expect(await hiloPara('ERR-0003', d)).toBe(b);
    const c = await hiloPara('ERR-0001', d);
    expect(c).toBe('HIL-0003');
    expect(hiloDe(c ?? undefined, entidades)?.titulo).toBe('read timeout 1');
  });

  it('resolver deja la nota en el hilo y en su último elemento; añadir a uno resuelto lo reabre', async () => {
    const { repositorio, entidades, d } = montar();
    for (const n of [1, 2]) await repositorio.guardarElemento(error(n, 'h'));
    const h = await crearHilo('read timeout', ['ERR-0001', 'ERR-0002'], d);
    expect(await resolver(h, '  Subí el timeout a 60 s ', d)).toBe(true);
    expect(hiloDe(h, entidades)).toMatchObject({ estado: 'resuelto', nota: 'Subí el timeout a 60 s' });
    const ultimo = await repositorio.leerElemento('ERR-0002');
    expect(ultimo.ok && [ultimo.valor.frontmatter.estado, ultimo.valor.notas]).toEqual([
      'resuelto',
      'Subí el timeout a 60 s',
    ]);
    // La nota es una edición: deja copia en el historial.
    expect(await repositorio.versiones('ERR-0002')).toHaveLength(1);
    await repositorio.guardarElemento(error(3, 'h'));
    await anadirAHilo(h, 'ERR-0003', d);
    expect(hiloDe(h, entidades)?.estado).toBe('abierto');
    expect(hiloDe(h, entidades)?.resuelto).toBeUndefined();
    expect(await reabrir(h, d)).toBe(false);
  });

  it('la nota va al último error (no a una respuesta en el hilo); meter en un hilo no es editar', async () => {
    const { repositorio, d } = montar();
    for (const n of [1, 2]) await repositorio.guardarElemento(error(n, 'h'));
    const antes = repositorio.frontmatter('ERR-0002')?.modificado;
    const h = await crearHilo('read timeout', ['ERR-0001', 'ERR-0002'], d);
    expect(repositorio.frontmatter('ERR-0002')?.modificado).toBe(antes);
    // Una nota respondida en el hilo, después del último error.
    const respuesta = elementoFalso(5, 'Lo probé con otro cliente', 'texto');
    await repositorio.guardarElemento({
      ...respuesta,
      frontmatter: { ...respuesta.frontmatter, creado: '2026-10-09T10:00:00+02:00', estado: 'en-uso' },
    });
    await anadirAHilo(h, 'TXT-0005', d);
    await resolver(h, 'Con keep-alive', d);
    expect(repositorio.frontmatter('ERR-0002')?.estado).toBe('resuelto');
    expect(repositorio.frontmatter('TXT-0005')?.estado).toBe('en-uso');
  });

  it('un error que entra respondiendo en un hilo resuelto lo reabre', async () => {
    const { repositorio, entidades, d } = montar();
    await repositorio.guardarElemento(error(1, 'h'));
    const h = await crearHilo('read timeout', ['ERR-0001'], d);
    await resolver(h, 'Hecho', d);
    const tercero = error(3, 'h');
    await repositorio.guardarElemento({ ...tercero, frontmatter: { ...tercero.frontmatter, hilo: h as never } });
    expect(await formarPorHuella(tercero.frontmatter.id, 'h', d)).toBe(h);
    expect(hiloDe(h, entidades)?.estado).toBe('abierto');
  });

  it('formar por huella: el primero solo; el segundo crea el hilo con los dos; el tercero entra', async () => {
    const { repositorio, d } = montar();
    await repositorio.guardarElemento(error(1, 'h'));
    expect(await formarPorHuella(repositorio.frontmatter('ERR-0001')?.id ?? '', 'h', d)).toBeNull();
    await repositorio.guardarElemento(error(2, 'h'));
    const h = await formarPorHuella(repositorio.frontmatter('ERR-0002')?.id ?? '', 'h', d);
    expect(h).toBe('HIL-0001');
    expect(elementosDe(h ?? '', repositorio).map((fm) => fm.ref)).toEqual(['ERR-0001', 'ERR-0002']);
    await repositorio.guardarElemento(error(3, 'h'));
    await repositorio.guardarElemento(error(4, 'otra'));
    // A la vez: no crean dos hilos.
    const [h3, h4] = await Promise.all([
      formarPorHuella(repositorio.frontmatter('ERR-0003')?.id ?? '', 'h', d),
      formarPorHuella(repositorio.frontmatter('ERR-0004')?.id ?? '', 'otra', d),
    ]);
    expect(h3).toBe(h);
    expect(h4).toBeNull();
    expect(elementosDe(h ?? '', repositorio)).toHaveLength(3);
  });
});

describe('aceptación', () => {
  it('tres veces la misma traza con números distintos: un hilo con tres, y la tercera cita la nota del segundo', async () => {
    const { repositorio, entidades, d } = montar();
    // Una captura por día (como las del 2, el 15 y el 17 de octubre): la respuesta mira las anteriores.
    let dia = 0;
    const reloj = () => new Date(2026, 9, 2 + 7 * dia++, 10, 0, 0);
    const capturador = crearCapturador({ repositorio, registro: REGISTRO, reloj });
    const traza = readFileSync(join(process.cwd(), 'fixtures/trazas/rust/01.txt'), 'utf8');
    const variantes = [traza, traza.replace(':142:17', ':150:3').replace('30s', '45s'), traza.replace('30s', '12s')];
    const refs: string[] = [];
    for (const [i, texto] of variantes.entries()) {
      const r = await capturador.capturar({ texto, origen: 'pegado' });
      if (!r.ok || r.valor.tipo !== 'creado') throw new Error('no creado');
      const el = r.valor.capturado.elemento;
      // Lo que hacen la cola (el resumen con la huella) y la captura (el hilo) al llegar los derivados.
      const datos = await lectorError.derivar(el);
      const resumen = lectorError.resumen(datos);
      await repositorio.actualizarElemento(el.frontmatter.id, (e) => ({
        ...e,
        frontmatter: { ...e.frontmatter, lector: { ...e.frontmatter.lector, resumen } },
      }));
      await formarPorHuella(el.frontmatter.id, String(resumen.huella), d);
      refs.push(el.frontmatter.ref);
      // El segundo se resuelve con una nota (desde su hilo).
      if (i === 1) {
        const hilo = repositorio.frontmatter(el.frontmatter.ref)?.hilo ?? '';
        await resolver(hilo, 'Pasa cuando la respuesta no trae content-length', d);
      }
      if (i === 2) {
        const leido = await repositorio.leerElemento(el.frontmatter.ref);
        if (!leido.ok) throw new Error('sin leer');
        const ctx = await construirContexto(leido.valor, repositorio, 'es', { resumen });
        const frase = lectorError
          .respuesta(leido.valor, datos, ctx)
          .texto.map((f) => ('v' in f ? f.v : ''))
          .join('');
        expect(frase).toContain('Pasa cuando la respuesta no trae content-length');
      }
    }
    const hilo = repositorio.frontmatter(refs[0] ?? '')?.hilo ?? '';
    expect(hilo).toMatch(/^HIL-/);
    expect(elementosDe(hilo, repositorio).map((fm) => fm.ref)).toEqual(refs);
    // Volvió a pasar: el hilo, abierto otra vez.
    expect(hiloDe(hilo, entidades)?.estado).toBe('abierto');
  });
});
