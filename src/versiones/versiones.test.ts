import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aplicar, diffLineas, diffSecuencias, lineasDe, plegar, recuentoDiff } from './diff';
import { parecido, shingles, tituloComparable, UMBRAL_PARECIDO } from './parecido';
import { diffSecciones, seccionesDe } from './secciones';

describe('diff por líneas', () => {
  it('propiedad: aplicar el diff a la versión antigua da la nueva', () => {
    // Pocas líneas distintas, para que se repitan (el caso difícil) y con vacías.
    const linea = fc.constantFrom('', 'a', 'b', 'c', 'una línea', '  sangrada', 'x = 1;');
    fc.assert(
      fc.property(fc.array(linea, { maxLength: 40 }), fc.array(linea, { maxLength: 40 }), (a, b) => {
        expect(aplicar(a, diffSecuencias(a, b))).toEqual(b);
      }),
      { numRuns: 500 },
    );
  });

  it('es mínimo en los casos sencillos', () => {
    expect(recuentoDiff(diffLineas('a\nb\nc', 'a\nb\nc'))).toEqual({ anadidas: 0, quitadas: 0 });
    expect(recuentoDiff(diffLineas('a\nb\nc', 'a\nx\nc'))).toEqual({ anadidas: 1, quitadas: 1 });
    expect(diffLineas('a\nc', 'a\nb\nc')).toEqual([
      { t: '=', texto: 'a' },
      { t: '+', texto: 'b' },
      { t: '=', texto: 'c' },
    ]);
    expect(diffLineas('', 'a\nb').map((o) => o.t)).toEqual(['+', '+']);
    expect(diffLineas('a\nb', '').map((o) => o.t)).toEqual(['-', '-']);
    // \r\n y el salto final no cuentan como cambio.
    expect(recuentoDiff(diffLineas('a\r\nb\r\n', 'a\nb'))).toEqual({ anadidas: 0, quitadas: 0 });
  });

  it('textos grandes con pocos cambios, rápido; con muchísimos, correcto aunque no mínimo', () => {
    const a = Array.from({ length: 20_000 }, (_, i) => `línea ${i}`);
    const b = [...a];
    b[100] = 'cambiada';
    b.splice(15_000, 0, 'nueva');
    const inicio = performance.now();
    const d = diffSecuencias(a, b);
    expect(performance.now() - inicio).toBeLessThan(2000);
    expect(recuentoDiff(d)).toEqual({ anadidas: 2, quitadas: 1 });
    expect(aplicar(a, d)).toEqual(b);
    const otra = Array.from({ length: 6000 }, (_, i) => `otra ${i}`);
    expect(aplicar(a.slice(0, 6000), diffSecuencias(a.slice(0, 6000), otra))).toEqual(otra);
  });

  it('plegar deja tres líneas de contexto y dice cuántas iguales se pliegan', () => {
    const a = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n');
    const b = a.replace('l10', 'cambio');
    const tramos = plegar(diffLineas(a, b));
    expect(tramos.map((t) => (t.t === 'plegado' ? `…${t.n}` : t.ops.map((o) => o.t).join('')))).toEqual([
      '…7',
      '===',
      '-+',
      '===',
      '…6',
    ]);
    expect(lineasDe('')).toEqual([]);
  });
});

describe('diff por secciones de Markdown', () => {
  const v2 = `# Plan del gateway

## 1. Objetivo
Reenviar los fragmentos.

## 2. Cliente HTTP
- [x] Elegir cliente
- [ ] Medir 64 KB

## 4. Dependencias
- reqwest

## 6. Fallback con curl
Si todo falla.
`;
  const v3 = `# Plan del gateway

## 1. Objetivo
Reenviar los fragmentos.

## 2. Cliente HTTP
- [x] Elegir cliente
- [x] Medir 64 KB

## 3. Streaming
- [ ] Leer la respuesta como flujo

## 4. Dependencias
- reqwest
- ureq

\`\`\`
## esto no es un encabezado
\`\`\`
`;

  it('como la referencia: una añadida, una modificada, una eliminada y las tareas marcadas', () => {
    expect(diffSecciones(v2, v3)).toEqual({
      anadidas: ['3. Streaming'],
      eliminadas: ['6. Fallback con curl'],
      modificadas: ['4. Dependencias'],
      tareasMarcadas: ['Medir 64 KB'],
    });
  });

  it('secciones: sin el título del documento, con Setext, y sin encabezados el documento entero', () => {
    expect(seccionesDe(v3).map((s) => s.titulo)).toEqual([
      '1. Objetivo',
      '2. Cliente HTTP',
      '3. Streaming',
      '4. Dependencias',
    ]);
    const setext = 'Uno\n===\ntexto\n\nDos\n===\n- [ ] tarea\n';
    expect(seccionesDe(setext).map((s) => [s.titulo, s.tareas.length])).toEqual([
      ['Uno', 0],
      ['Dos', 1],
    ]);
    expect(seccionesDe('solo texto\n- [x] hecha')).toEqual([
      { titulo: '', nivel: 0, texto: 'solo texto\n- [x] hecha', tareas: [{ texto: 'hecha', hecha: true }] },
    ]);
    expect(diffSecciones('', '')).toEqual({ anadidas: [], eliminadas: [], modificadas: [], tareasMarcadas: [] });
  });
});

describe('parecido', () => {
  it('Jaccard de shingles de tres palabras, sin mayúsculas ni acentos', () => {
    const a = 'Eres un revisor de ADR. Lee el documento y señala riesgos, alternativas y consecuencias.';
    const b = 'Eres un revisor de ADR. Lee el documento y señala riesgos, alternativas, consecuencias y supuestos.';
    expect(parecido(shingles(a), shingles(b))).toBeGreaterThan(UMBRAL_PARECIDO);
    expect(parecido(shingles(a), shingles('Traduce este texto al inglés con un tono formal y breve.'))).toBeLessThan(
      0.1,
    );
    expect(parecido(shingles('ÉRES un'), shingles('eres UN'))).toBe(1);
    expect(parecido(new Set(), new Set())).toBe(0);
    expect(tituloComparable('  Revisor   de ADR ')).toBe(tituloComparable('revisor de adr'));
  });
});
