import { type Elemento, hashOriginal } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../almacen/memoria';
import { Repositorio } from '../almacen/repositorio';
import { lectorCodigo } from '../lectores/codigo/lector';
import type { Lector } from '../lectores/contrato';
import { lectorDiff } from '../lectores/diff/lector';
import { lectorEnlace } from '../lectores/enlace/lector';
import { lectorIdea } from '../lectores/idea/lector';
import { elementoFalso } from '../lectores/pruebas/falsos';
import { lectorTexto } from '../lectores/texto/lector';
import { cambiarTipo, sePuedeCambiar } from './reprocesar';

function texto(i: number, original: string): Elemento {
  const base = elementoFalso(i, original, 'texto');
  return { ...base, frontmatter: { ...base.frontmatter, hash: hashOriginal(original) } };
}

describe('cambiarTipo', () => {
  it('entre lectores del mismo tipo (Código y Diff) la ref no cambia', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    const parche = 'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-x\n+y\n';
    const base = elementoFalso(3, parche, 'codigo');
    await repo.guardarElemento({
      ...base,
      frontmatter: {
        ...base.frontmatter,
        tipo: 'codigo',
        ref: 'COD-0003' as Elemento['frontmatter']['ref'],
        hash: hashOriginal(parche),
      },
    });
    expect(await cambiarTipo('COD-0003', lectorDiff, repo, { anterior: lectorCodigo })).toBe('COD-0003');
    const fm = repo.frontmatter('COD-0003');
    expect([fm?.lector.nombre, fm?.alias ?? []]).toEqual(['diff', []]);
  });

  it('ref nueva, la vieja en alias: sigue llevando al elemento y no se vuelve a asignar', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    await repo.guardarElemento(texto(2, 'Exportar minipapers con Typst'));
    const nueva = await cambiarTipo('TXT-0002', lectorIdea, repo, { anterior: lectorTexto });
    expect(nueva).toBe('IDE-0001');
    expect(repo.frontmatter('IDE-0001')?.alias).toEqual(['TXT-0002']);
    expect(repo.buscar('TXT-0002')?.ref).toBe('IDE-0001');
    expect([...repo.refs()]).toContain('TXT-0002');
    // Tras releer desde los archivos, igual.
    const otro = new Repositorio((repo as unknown as { almacen: AlmacenMemoria }).almacen);
    await otro.cargar();
    expect(otro.buscar('TXT-0002')?.ref).toBe('IDE-0001');
  });

  it('lo propio del lector anterior no pasa al nuevo; el estado de un tipo, solo si vale en el nuevo', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    await repo.guardarElemento(texto(1, 'Exportar minipapers con Typst'));
    const idea = await cambiarTipo('TXT-0001', lectorIdea, repo, { anterior: lectorTexto });
    expect(repo.frontmatter(idea ?? '')?.estado).toBe('semilla');
    const vuelta = await cambiarTipo(idea ?? '', lectorTexto, repo, { anterior: lectorIdea });
    const fm = repo.frontmatter(vuelta ?? '');
    expect(fm?.estado).toBeUndefined();
    // Ida y vuelta: el alias no contiene la ref que vuelve a tener.
    expect(fm?.alias).not.toContain(vuelta);
    // Un estado común se conserva.
    await repo.actualizarElemento(vuelta ?? '', (el) => ({
      ...el,
      frontmatter: { ...el.frontmatter, estado: 'resuelto' },
    }));
    const otra = await cambiarTipo(vuelta ?? '', lectorIdea, repo, { anterior: lectorTexto });
    expect(repo.frontmatter(otra ?? '')?.estado).toBe('resuelto');
  });

  it('si el lector nuevo no sabe leerlo, no se guarda nada', async () => {
    const repo = new Repositorio(new AlmacenMemoria());
    await repo.guardarElemento(texto(1, 'Notas de la reunión'));
    const roto: Lector = { ...lectorEnlace, leer: async () => Promise.reject(new Error('no es una URL')) };
    expect(await cambiarTipo('TXT-0001', roto, repo)).toBeNull();
    expect(repo.frontmatter('TXT-0001')?.tipo).toBe('texto');
  });

  it('solo entre lectores de texto, y a otro distinto', () => {
    const fm = texto(1, 'x').frontmatter;
    expect(sePuedeCambiar({ frontmatter: fm }, lectorIdea)).toBe(true);
    expect(sePuedeCambiar({ frontmatter: fm }, lectorTexto)).toBe(false);
    expect(sePuedeCambiar({ frontmatter: fm }, { tipo: 'archivo', nombre: 'archivo' })).toBe(false);
  });
});
