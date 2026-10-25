import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Elemento } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { AlmacenMemoria } from '../../almacen/memoria';
import { Repositorio } from '../../almacen/repositorio';
import { detectar } from '../../captura/detector';
import { capturar } from '../../captura/flujo';
import { anteriorDe } from '../../captura/versiones';
import { comprobarEstilo } from '../../respuestas/reglas';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizarDiff, filasLadoALado, puntuarDiff } from './analisis';
import { lectorDiff, tituloDeDiff } from './lector';

const fixture = (n: string) => readFileSync(join(process.cwd(), 'src/lectores/diff/fixtures', n), 'utf8');
const ctx = (idioma: 'es' | 'en') => ({ idioma, mismaHuella: [], versiones: [], notas: [], colecciones: [] });

describe('análisis de un diff', () => {
  it('git diff: modificado, nuevo, borrado, renombrado y binario, con sus cuentas', () => {
    const d = analizarDiff(fixture('git-varios.diff'));
    expect(d.archivos.map((a) => [a.ruta, a.estado, a.anadidas, a.quitadas, a.antes ?? null])).toEqual([
      ['src/cliente.rs', 'modificado', 2, 2, null],
      ['src/nuevo.rs', 'nuevo', 2, 0, null],
      ['src/viejo.rs', 'borrado', 0, 1, null],
      ['docs/b.md', 'renombrado', 1, 1, 'docs/a.md'],
      ['logo.png', 'binario', 0, 0, null],
    ]);
    expect([d.anadidas, d.quitadas]).toEqual([5, 4]);
    const trozo = d.archivos[0]?.trozos[0];
    expect(trozo?.cabecera).toBe('@@ -10,6 +10,8 @@');
    expect(trozo?.contexto).toBe('impl Cliente {');
    // Números de línea antes y después.
    expect(trozo?.lineas.slice(2, 5)).toEqual([
      { t: 'quitada', v: '            timeout: Duration::from_secs(30),', a: 12 },
      { t: 'anadida', v: '            timeout: Duration::from_secs(60),', b: 12 },
      { t: 'anadida', v: '            reintentos: 3,', b: 13 },
    ]);
    // Una línea vacía dentro de un trozo es una igual.
    expect(trozo?.lineas.at(-1)).toEqual({ t: 'igual', v: '', a: 15, b: 16 });
  });

  it('format-patch: el asunto (con su continuación, sin [PATCH]) y sin contar la firma', () => {
    const d = analizarDiff(fixture('format-patch.patch'));
    expect(d.asunto).toBe('Sube el timeout de lectura a 60 s para el streaming del gateway');
    expect([d.archivos.length, d.anadidas, d.quitadas]).toEqual([1, 1, 1]);
    expect(tituloDeDiff(d)).toBe('Sube el timeout de lectura a 60 s para el streaming del gateway');
  });

  it('diff unificado sin git: rutas sin la fecha y «\\ No newline» fuera', () => {
    const d = analizarDiff(fixture('unificado.diff'));
    expect(d.archivos.map((a) => [a.ruta, a.antes, a.anadidas, a.quitadas])).toEqual([
      ['config/despues.toml', 'config/antes.toml', 1, 1],
    ]);
    expect(d.archivos[0]?.trozos[0]?.lineas).toHaveLength(5);
  });

  it('filas lado a lado: iguales en las dos columnas y las quitadas junto a las añadidas', () => {
    const trozo = analizarDiff(fixture('git-varios.diff')).archivos[0]?.trozos[0];
    const filas = trozo ? filasLadoALado(trozo) : [];
    expect(filas.map((f) => [f.izquierda?.a ?? null, f.derecha?.b ?? null])).toEqual([
      [10, 10],
      [11, 11],
      [12, 12],
      [null, 13],
      [13, 14],
      [14, 15],
      [15, 16],
    ]);
    expect(filas[2]?.izquierda?.t).toBe('quitada');
    expect(filas[2]?.derecha?.t).toBe('anadida');
  });

  it('títulos: un archivo, varios o el genérico', () => {
    expect(
      tituloDeDiff({
        archivos: [{ ruta: 'a.ts', estado: 'modificado', anadidas: 1, quitadas: 0, trozos: [] }],
        parches: 1,
      }),
    ).toBe('Cambios en a.ts');
    expect(tituloDeDiff(analizarDiff(fixture('git-varios.diff')))).toBe('Parche de 5 archivos');
    expect(tituloDeDiff({ archivos: [], parches: 1 })).toBe('Parche');
  });
});

describe('detección', () => {
  it('los diffs van al lector diff (código) y no al de Código', () => {
    for (const n of ['git-varios.diff', 'format-patch.patch', 'unificado.diff']) {
      const det = detectar({ texto: fixture(n) }, REGISTRO);
      expect([n, det.tipo, det.lector]).toEqual([n, 'codigo', 'diff']);
      // La duda nunca es «Código» frente a «Código».
      expect(det.alternativa?.tipo).not.toBe('codigo');
    }
    expect(puntuarDiff('@@ -1,2 +1,2 @@\n a\n-b\n+c\n')).toBe(0.8);
  });

  it('lo que no es diff no puntúa: Markdown con un bloque de diff, una lista con guiones, código con + y -', () => {
    expect(puntuarDiff('# Cambios\n\n```diff\n--- a\n+++ b\n@@ -1 +1 @@\n-x\n+y\n```\n')).toBe(0);
    expect(puntuarDiff('- uno\n- dos\n- tres\n')).toBe(0);
    expect(puntuarDiff('let x = a + b;\nlet y = a - b;\n')).toBe(0);
    expect(puntuarDiff('--- a\n+++ b\nsin trozos\n')).toBe(0);
  });
});

describe('registro con dos lectores de código', () => {
  it('/codigo es el lector Código, aunque Diff vaya antes; un elemento sin lector, el de su tipo', () => {
    expect(REGISTRO.lectores.findIndex((l) => l.nombre === 'diff')).toBeLessThan(
      REGISTRO.lectores.findIndex((l) => l.nombre === 'codigo'),
    );
    expect(REGISTRO.deTipo('codigo')?.nombre).toBe('codigo');
    const huerfano = elementoFalso(1, 'x', 'desaparecido');
    expect(
      REGISTRO.paraElemento({ frontmatter: { ...huerfano.frontmatter, tipo: 'codigo' } as Elemento['frontmatter'] })
        ?.nombre,
    ).toBe('codigo');
  });

  it('capturar un diff con /codigo lo guarda con el lector Código; sin indicación, con Diff', async () => {
    const repositorio = new Repositorio(new AlmacenMemoria());
    await repositorio.cargar();
    const forzado = await capturar(
      { texto: fixture('unificado.diff'), tipo: 'codigo', origen: 'pegado' },
      { repositorio, registro: REGISTRO },
    );
    const solo = await capturar(
      { texto: fixture('format-patch.patch'), origen: 'pegado' },
      { repositorio, registro: REGISTRO },
    );
    const nombres = [forzado, solo].map((r) =>
      r.ok && r.valor.tipo === 'creado' ? r.valor.capturado.elemento.frontmatter.lector.nombre : r,
    );
    expect(nombres).toEqual(['codigo', 'diff']);
  });
});

describe('respuesta y cifras', () => {
  it('«Parche de 5 archivos: +5 −4.», binario, y las reglas de estilo', async () => {
    const d = analizarDiff(fixture('git-varios.diff'));
    const el = elementoFalso(1, fixture('git-varios.diff'), 'diff');
    expect(lectorDiff.respuesta(el, d, ctx('es')).texto[0]).toEqual({ t: 'texto', v: 'Parche de 5 archivos: +5 −4.' });
    expect(lectorDiff.respuesta(el, d, ctx('en')).texto[0]).toEqual({ t: 'texto', v: 'Patch of 5 files: +5 −4.' });
    const binario = analizarDiff(
      'diff --git a/x.png b/x.png\nindex 1..2 100644\nBinary files a/x.png and b/x.png differ\n',
    );
    expect(lectorDiff.respuesta(el, binario, ctx('es')).texto[0]).toEqual({
      t: 'texto',
      v: 'Parche de 1 archivo, binario.',
    });
    for (const n of ['git-varios.diff', 'format-patch.patch', 'unificado.diff'])
      for (const idioma of ['es', 'en'] as const)
        expect(comprobarEstilo(lectorDiff.respuesta(el, analizarDiff(fixture(n)), ctx(idioma)))).toEqual([]);
    expect(lectorDiff.cifras?.anadidas?.(d).texto).toBe('5');
    expect(lectorDiff.resumenLegible?.(lectorDiff.resumen(d), 'es')).toBe('5 archivos · +5 −4');
    expect(lectorDiff.etiqueta?.('es')).toBe('Diff o parche');
  });
});

describe('versiones', () => {
  it('un parche no es versión de un código, aunque los dos sean código', async () => {
    const repositorio = new Repositorio(new AlmacenMemoria());
    await repositorio.cargar();
    const texto = 'fn leer(&self) {\n    self.stream.next_chunk()\n}\n'.repeat(4);
    const codigo = elementoFalso(9, texto, 'codigo');
    await repositorio.guardarElemento({
      ...codigo,
      frontmatter: {
        ...codigo.frontmatter,
        tipo: 'codigo',
        ref: 'COD-0009' as Elemento['frontmatter']['ref'],
        titulo: 'leer',
      },
    });
    expect(
      await anteriorDe(
        texto,
        'leer',
        { tipo: 'codigo', mismoLector: (fm) => fm.lector.nombre === 'diff' },
        repositorio,
      ),
    ).toBeNull();
    expect(
      (
        await anteriorDe(
          texto,
          'leer',
          { tipo: 'codigo', mismoLector: (fm) => fm.lector.nombre === 'codigo' },
          repositorio,
        )
      )?.ref,
    ).toBe('COD-0009');
  });
});

describe('correcciones de la revisión', () => {
  it('un .patch soltado como archivo va al lector Diff', async () => {
    const texto = fixture('format-patch.patch');
    expect(lectorDiff.detectar({ texto, nombre: 'fix.patch', archivos: [new File([texto], 'fix.patch')] })).toBe(0.97);
    const repositorio = new Repositorio(new AlmacenMemoria());
    await repositorio.cargar();
    const r = await capturar(
      { archivo: new File([texto], 'fix.patch', { type: 'text/x-patch' }), origen: 'soltado' },
      { repositorio, registro: REGISTRO },
    );
    expect(r.ok && r.valor.tipo === 'creado' ? r.valor.capturado.elemento.frontmatter.lector.nombre : r).toBe('diff');
  });

  it('rutas de git entrecomilladas (no ASCII), sin prefijo y archivos nuevos de Subversion', () => {
    const comillas = analizarDiff(
      'diff --git "a/docs/a\\303\\261o.md" "b/docs/a\\303\\261o.md"\nindex 1..2 100644\n--- "a/docs/a\\303\\261o.md"\n+++ "b/docs/a\\303\\261o.md"\n@@ -1 +1 @@\n-a\n+b\n',
    );
    expect(comillas.archivos.map((a) => a.ruta)).toEqual(['docs/año.md']);
    const sinPrefijo = analizarDiff(
      'diff --git x.txt x.txt\nindex 1..2 100644\n--- x.txt\n+++ x.txt\n@@ -1 +1 @@\n-a\n+b\n',
    );
    expect(sinPrefijo.archivos.map((a) => a.ruta)).toEqual(['x.txt']);
    const svn = analizarDiff(
      'Index: nuevo.txt\n===================================================================\n--- nuevo.txt\t(nonexistent)\n+++ nuevo.txt\t(working copy)\n@@ -0,0 +1 @@\n+hola\n',
    );
    expect(svn.archivos.map((a) => [a.ruta, a.estado])).toEqual([['nuevo.txt', 'nuevo']]);
  });

  it('el asunto codificado (RFC 2047) se lee con sus acentos', () => {
    const d = analizarDiff(
      'From 2f6f3c1a9b8e7d6c5b4a39281706f5e4d3c2b1a0 Mon Sep 17 00:00:00 2001\nSubject: [PATCH] =?UTF-8?q?A=C3=B1ade=20reintentos?=\n =?UTF-8?q?_al_cliente?=\n---\ndiff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-x\n+y\n',
    );
    expect(d.asunto).toBe('Añade reintentos al cliente');
  });

  it('una serie de parches cuenta los archivos una vez y se titula como serie', () => {
    const parche = (n: number) =>
      `From ${String(n).repeat(40)} Mon Sep 17 00:00:00 2001\nSubject: [PATCH ${n}/3] Cambio ${n}\n---\ndiff --git a/src/a.rs b/src/a.rs\n--- a/src/a.rs\n+++ b/src/a.rs\n@@ -${n} +${n} @@\n-x\n+y\n-- \n2.39.0\n`;
    const d = analizarDiff([1, 2, 3].map(parche).join('\n'));
    expect([d.parches, d.archivos.length, d.anadidas, d.quitadas]).toEqual([3, 1, 3, 3]);
    expect(d.archivos[0]?.trozos).toHaveLength(3);
    expect(tituloDeDiff(d)).toBe('Serie de 3 parches');
  });

  it('detecta git show, diff -ruN, Mercurial, un bloque ```diff y un parche binario de git', () => {
    const git = 'diff --git a/a b/a\n--- a/a\n+++ b/a\n@@ -1 +1 @@\n-x\n+y\n';
    expect(
      puntuarDiff(`commit ${'a'.repeat(40)}\nAuthor: Ana <a@b.c>\nDate:   Fri Oct 17 2026\n\n    Cambia x\n\n${git}`),
    ).toBe(0.95);
    expect(
      puntuarDiff('diff -ruN a/x.txt b/x.txt\n--- a/x.txt\t2026-10-17\n+++ b/x.txt\t2026-10-17\n@@ -1 +1 @@\n-x\n+y\n'),
    ).toBe(0.95);
    expect(puntuarDiff(`# HG changeset patch\n# User Ana\n# Node ID ${'b'.repeat(40)}\nCambia x\n\n${git}`)).toBe(0.95);
    expect(puntuarDiff(`\`\`\`diff\n${git}\`\`\`\n`)).toBe(0.95);
    expect(analizarDiff(`\`\`\`diff\n${git}\`\`\`\n`).archivos).toHaveLength(1);
    const base85 = Array.from({ length: 30 }, () => 'zcmV-OEz$#5Jcf8%4qO}Pt2)V@Q1kAMy0').join('\n');
    expect(
      puntuarDiff(`diff --git a/x.png b/x.png\nindex 1..2 100644\nGIT binary patch\nliteral 1234\n${base85}\n\n`),
    ).toBe(0.95);
  });

  it('cambios solo de modo y renombrados sin contenido: se detectan y se dicen', () => {
    const modo = 'diff --git a/run.sh b/run.sh\nold mode 100644\nnew mode 100755\n';
    expect(puntuarDiff(modo)).toBe(0.95);
    expect(analizarDiff(modo).archivos[0]?.modo).toEqual({ antes: '100644', despues: '100755' });
    const renombrado = 'diff --git a/x.md b/y.md\nsimilarity index 100%\nrename from x.md\nrename to y.md\n';
    expect(puntuarDiff(renombrado)).toBe(0.95);
    expect(analizarDiff(renombrado).archivos.map((a) => [a.ruta, a.antes, a.estado])).toEqual([
      ['y.md', 'x.md', 'renombrado'],
    ]);
  });

  it('un parche nunca se guarda como versión de otro (sus títulos se repiten)', async () => {
    const repositorio = new Repositorio(new AlmacenMemoria());
    await repositorio.cargar();
    const base = fixture('git-varios.diff');
    const otro = base.replace('reintentos: 3', 'reintentos: 5');
    const r1 = await capturar({ texto: base, origen: 'pegado' }, { repositorio, registro: REGISTRO });
    const r2 = await capturar({ texto: otro, origen: 'pegado' }, { repositorio, registro: REGISTRO });
    expect([r1, r2].map((r) => (r.ok ? r.valor.tipo : r))).toEqual(['creado', 'creado']);
  });
});
