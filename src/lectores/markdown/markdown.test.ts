import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectar } from '../../captura/detector';
import { comprobarEstilo, textoDe } from '../../respuestas/reglas';
import { anclaDe, crearAnclador } from '../../ui/anclas';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import { analizarMarkdown } from './analisis';
import { confianzaMarkdown, palabrasAprox } from './deteccion';
import { indiceDe } from './indice';
import { lectorMarkdown, tituloDeDocumento } from './lector';

const leer = (archivo: string) => readFileSync(join(process.cwd(), 'fixtures/markdown', archivo), 'utf8');
const ctx = (idioma: 'es' | 'en' = 'es'): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
});
const frase = (d: ReturnType<typeof analizarMarkdown>, idioma: 'es' | 'en' = 'es') =>
  lectorMarkdown.respuesta(elementoFalso(1), d, ctx(idioma)).texto.map(textoDe).join('');

describe('el plan con tareas (como la pantalla de referencia)', () => {
  const d = analizarMarkdown(leer('plan-cliente-http.md'));

  it('el título del documento no es una sección; las subsecciones suman en la suya', () => {
    expect(d.conTitulo).toBe(true);
    expect(indiceDe(d).map((s) => [s.titulo, `${s.tareas.hechas}/${s.tareas.total}`])).toEqual([
      ['1. Objetivo', '0/0'],
      ['2. Cliente HTTP', '3/5'],
      ['3. Streaming', '2/5'],
      ['4. Dependencias', '1/2'],
      ['5. Pruebas', '0/2'],
    ]);
    expect(d.tareas).toEqual({ hechas: 6, total: 14 });
  });

  it('enlaces, menciones y bloques de código', () => {
    expect(d.enlaces).toEqual(['https://docs.rs/ureq']);
    expect(d.menciones).toEqual(['CMP-0004']);
    expect(d.bloques).toEqual({ total: 1, lenguajes: { rust: 1 } });
  });

  it('respuesta de la ficha, en es y en, y cifras', () => {
    expect(frase(d)).toBe('Documento con 5 secciones y 14 tareas (6 hechas).');
    expect(frase(d, 'en')).toBe('Document with 5 sections and 14 tasks (6 done).');
    expect(comprobarEstilo(lectorMarkdown.respuesta(elementoFalso(1), d, ctx()))).toEqual([]);
    expect(lectorMarkdown.cifras?.tareas_hechas?.(d)).toEqual({ texto: '6', valor: 6 });
    expect(lectorMarkdown.cifras?.tareas_total?.(d)).toEqual({ texto: '14', valor: 14 });
    expect(lectorMarkdown.cifras?.palabras?.(d).valor).toBe(d.palabras);
  });
});

describe('palabras, anclas y secciones', () => {
  it('las palabras no cuentan los bloques de código', () => {
    const d = analizarMarkdown(leer('sin-tareas.md'));
    expect(d.palabras).toBe(30);
    expect(d.bloques).toEqual({ total: 2, lenguajes: { ts: 1, texto: 1 } });
    expect(frase(d)).toBe('Documento con 2 secciones y 30 palabras.');
  });

  it('anclas estables: sin acentos ni signos, repetidas con -2', () => {
    const d = analizarMarkdown(leer('notas-repetidas.md'));
    expect(d.secciones.map((s) => s.ancla)).toEqual(['notas', 'ideas', 'ideas-2', 'que-falta']);
    expect(anclaDe('Canción: «pingüino» & 2.º')).toBe('cancion-pinguino-2-o');
    expect(anclaDe('Привет мир')).toBe('привет-мир');
    expect(anclaDe('¡¿?!')).toBe('seccion');
    const anclar = crearAnclador();
    expect(['A', 'a', 'A'].map(anclar)).toEqual(['a', 'a-2', 'a-3']);
  });

  it('encabezados Setext y autoenlaces', () => {
    const d = analizarMarkdown(leer('setext.md'));
    expect(d.secciones.map((s) => [s.nivel, s.titulo])).toEqual([
      [1, 'Guía de instalación'],
      [2, 'Requisitos'],
      [2, 'Pasos'],
    ]);
    expect(d.enlaces).toEqual(['https://ejemplo.org']);
  });

  it('sin encabezados: un documento de N palabras', () => {
    const d = analizarMarkdown('- [ ] Pan\n- [x] Leche\n\n| a | b |\n|---|---|\n| 1 | 2 |\n');
    expect(indiceDe(d)).toEqual([]);
    expect(d.tareas).toEqual({ hechas: 1, total: 2 });
    expect(frase(d)).toMatch(/^Documento de \d+ palabras\.$/);
  });

  it('dos títulos de primer nivel: los dos son secciones', () => {
    const d = analizarMarkdown('# Uno\n\ntexto\n\n# Dos\n\ntexto\n');
    expect(d.conTitulo).toBe(false);
    expect(indiceDe(d).map((s) => s.titulo)).toEqual(['Uno', 'Dos']);
  });

  it('una tarea: «1 hecha»', () => {
    expect(frase(analizarMarkdown('# T\n\n## A\n\n- [x] uno\n- [ ] dos\n'))).toBe(
      'Documento con 1 sección y 2 tareas (1 hecha).',
    );
  });
});

describe('detección', () => {
  it('documentos sí; notas, ideas y textos no', () => {
    expect(confianzaMarkdown(leer('plan-cliente-http.md'))).toBe(0.75);
    expect(confianzaMarkdown(leer('setext.md'))).toBe(0.75);
    expect(confianzaMarkdown('Hoy he revisado el despliegue y todo ha ido bien.')).toBe(0);
    expect(confianzaMarkdown('#build roto otra vez\n#testing flaky')).toBe(0);
    expect(confianzaMarkdown('- leche\n- pan')).toBe(0);
  });

  it('un CLAUDE.md y un prompt con variables siguen siendo prompts', () => {
    for (const f of ['claude-md.md', 'reglas-de-proyecto.md', 'revisor-adr.txt']) {
      const texto = readFileSync(join(process.cwd(), 'fixtures/prompts', f), 'utf8');
      expect(detectar({ texto }, REGISTRO).lector, f).toBe('prompt');
    }
  });

  it('lineal: un encabezado con muchos espacios y un texto enorme', () => {
    const inicio = performance.now();
    confianzaMarkdown(`# a${' '.repeat(50_000)}b\n${'- x\n'.repeat(50_000)}`);
    expect(performance.now() - inicio).toBeLessThan(500);
  });
});

describe('lector', () => {
  it('título, resumen provisional y resumen legible', async () => {
    const b = await lectorMarkdown.leer({ texto: leer('plan-cliente-http.md') });
    expect(b.titulo).toBe('Plan: cliente HTTP del gateway');
    expect(b.resumen?.palabras).toBe(palabrasAprox(leer('plan-cliente-http.md')));
    expect(tituloDeDocumento('- primera línea\notra')).toBe('primera línea');
    const d = analizarMarkdown(leer('plan-cliente-http.md'));
    expect(lectorMarkdown.resumen(d)).toEqual({
      secciones: 5,
      palabras: d.palabras,
      tareas_hechas: 6,
      tareas_total: 14,
    });
    expect(lectorMarkdown.resumenLegible?.(lectorMarkdown.resumen(d), 'es')).toBe(
      `5 secciones · ${d.palabras} palabras · 6/14 tareas`,
    );
  });

  it('deriva con el análisis cargado aparte; sin original, falla', async () => {
    const d = await lectorMarkdown.derivar(elementoFalso(1, leer('setext.md'), 'markdown'));
    expect(d.secciones).toHaveLength(3);
    await expect(lectorMarkdown.derivar({ ...elementoFalso(1), original: null })).rejects.toThrow(
      'markdown.sinOriginal',
    );
  });
});
