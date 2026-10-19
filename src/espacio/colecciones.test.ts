import type { Elemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { leerTexto } from '../almacen/contrato';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { elementoFalso } from '../lectores/pruebas/falsos';
import {
  borrar,
  crear,
  GestorColecciones,
  leerRegistro,
  mover,
  ordenadas,
  RUTA_COLECCIONES,
  registroVacio,
  renombrar,
  sincronizar,
} from './colecciones';

const AHORA = '2026-10-19T10:00:00+02:00';

function conColecciones(n: number, colecciones: string[]): Elemento {
  const base = elementoFalso(n, `texto ${n}`, 'texto');
  return { ...base, frontmatter: { ...base.frontmatter, colecciones } };
}

describe('registro de colecciones (puro)', () => {
  it('sincronizar añade al final lo que usan los elementos; crear, renombrar, borrar y mover', () => {
    const r1 = sincronizar(registroVacio(), ['gateway', 'prompts', 'gateway'], AHORA);
    expect(r1 && ordenadas(r1).map((c) => [c.id, c.orden])).toEqual([
      ['gateway', 0],
      ['prompts', 1],
    ]);
    expect(sincronizar(r1 ?? registroVacio(), ['prompts'], AHORA)).toBeNull();
    const r2 = crear(r1 ?? registroVacio(), ' @Lecturas ', AHORA);
    expect(r2 && ordenadas(r2).map((c) => c.id)).toEqual(['gateway', 'prompts', 'lecturas']);
    expect(crear(r2 ?? registroVacio(), 'gateway', AHORA)).toBeNull();
    const r3 = mover(r2 ?? registroVacio(), 'lecturas', -1);
    expect(r3 && ordenadas(r3).map((c) => c.id)).toEqual(['gateway', 'lecturas', 'prompts']);
    expect(mover(r3 ?? registroVacio(), 'gateway', -1)).toBeNull();
    const r4 = renombrar(r3 ?? registroVacio(), 'prompts', 'Revisión de prompts');
    expect(r4 && ordenadas(r4).map((c) => c.id)).toEqual(['gateway', 'lecturas', 'revisión-de-prompts']);
    // A una que ya existe: se juntan.
    const r5 = renombrar(r4 ?? registroVacio(), 'lecturas', 'gateway');
    expect(r5 && ordenadas(r5).map((c) => c.id)).toEqual(['gateway', 'revisión-de-prompts']);
    expect(borrar(r5 ?? registroVacio(), 'gateway')?.colecciones.map((c) => c.id)).toEqual(['revisión-de-prompts']);
    expect(borrar(r5 ?? registroVacio(), 'otra')).toBeNull();
  });

  it('un archivo que falta es un registro vacío; uno que no se entiende, null (no se pisa)', () => {
    expect(leerRegistro(null)).toEqual(registroVacio());
    expect(leerRegistro('{"esquema": 9}')).toBeNull();
    expect(leerRegistro('no es json')).toBeNull();
  });
});

describe('GestorColecciones', () => {
  async function montar(puedeEscribir = () => true) {
    const almacen = new AlmacenMemoria();
    const repositorio = new Repositorio(almacen);
    await repositorio.guardarElemento(conColecciones(1, ['gateway']));
    await repositorio.guardarElemento(conColecciones(2, ['gateway', 'prompts']));
    const gestor = new GestorColecciones(almacen, repositorio, { puedeEscribir, reloj: () => new Date(AHORA) });
    await gestor.cargar();
    return { almacen, repositorio, gestor };
  }

  it('sincroniza, crea y mueve en el archivo', async () => {
    const { almacen, gestor } = await montar();
    await gestor.sincronizar();
    await gestor.crear('vacía');
    await gestor.mover('vacía', -1);
    expect(gestor.lista().map((c) => c.id)).toEqual(['gateway', 'vacía', 'prompts']);
    const archivo = leerRegistro(await leerTexto(almacen, RUTA_COLECCIONES));
    expect(archivo && ordenadas(archivo).map((c) => c.id)).toEqual(['gateway', 'vacía', 'prompts']);
  });

  it('renombrar y borrar cambian sus elementos (sin tocar modificado); los elementos se quedan', async () => {
    const { repositorio, gestor } = await montar();
    const antes = repositorio.frontmatter('TXT-0002')?.modificado;
    expect(await gestor.renombrar('gateway', 'Pasarela')).toBe(true);
    expect(repositorio.frontmatter('TXT-0001')?.colecciones).toEqual(['pasarela']);
    expect(repositorio.frontmatter('TXT-0002')?.colecciones).toEqual(['pasarela', 'prompts']);
    expect(repositorio.frontmatter('TXT-0002')?.modificado).toBe(antes);
    expect(await gestor.borrar('pasarela')).toBe(true);
    expect(repositorio.frontmatter('TXT-0001')?.colecciones).toBeUndefined();
    expect(repositorio.frontmatter('TXT-0002')?.colecciones).toEqual(['prompts']);
    expect(repositorio.elementos()).toHaveLength(2);
    expect(gestor.lista().map((c) => c.id)).toEqual(['prompts']);
  });

  it('un archivo ilegible no se pisa; una pestaña que solo lee no escribe (pero ve las colecciones)', async () => {
    const { almacen, gestor } = await montar();
    await almacen.escribir(RUTA_COLECCIONES, new TextEncoder().encode('{roto'));
    await gestor.cargar();
    expect(await gestor.crear('nueva')).toBe(false);
    expect(await leerTexto(almacen, RUTA_COLECCIONES)).toBe('{roto');
    const lectora = await montar(() => false);
    expect(await lectora.gestor.crear('nueva')).toBe(false);
    expect(lectora.gestor.lista().map((c) => c.id)).toEqual(['gateway', 'prompts']);
  });
});
