import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerYaml, separar } from '@rimor/formato';
import { describe, expect, it } from 'vitest';
import { detectar } from '../../captura/detector';
import { comprobarEstilo, textoDe } from '../../respuestas/reglas';
import type { Respuesta } from '../../respuestas/tipos';
import type { Contexto } from '../contrato';
import { elementoFalso } from '../pruebas/falsos';
import { REGISTRO } from '../registro';
import {
  analizarPrompt,
  confianzaPrompt,
  destinoDe,
  escrituraDe,
  seccionesDe,
  sustituir,
  tokensAprox,
  trozosDe,
  variablesDe,
} from './analisis';
import { lectorPrompt, tituloDePrompt } from './lector';
import { archivoResultado, baseResultado, conResultado, estrellas, resultadosDe, valoracionMedia } from './resultados';

const raiz = join(process.cwd(), 'fixtures/prompts');
const leer = (archivo: string) => readFileSync(join(raiz, archivo), 'utf8');
const esperado = JSON.parse(leer('esperado.json')) as Record<
  string,
  { forma: string; variables: string[]; destino: string | null }
>;
const ctx = (idioma: 'es' | 'en' = 'es'): Contexto => ({
  idioma,
  mismaHuella: [],
  versiones: [],
  notas: [],
  colecciones: [],
});
const frase = (r: Respuesta) => r.texto.map(textoDe).join('');

describe('los prompts de fixtures/prompts', () => {
  for (const [archivo, e] of Object.entries(esperado))
    it(archivo, () => {
      const texto = leer(archivo);
      const d = analizarPrompt(texto);
      expect({ forma: d.forma, variables: d.variables.map(escrituraDe), destino: d.destino }).toEqual(e);
      expect(confianzaPrompt(texto)).toBeGreaterThanOrEqual(0.8);
      expect(detectar({ texto }, REGISTRO).lector).toBe('prompt');
    });
});

describe('variables', () => {
  it('las tres sintaxis, en orden y sin repetir', () => {
    expect(variablesDe('{{a}} {b} <c> {{a}} {{ d }}').map(escrituraDe)).toEqual(['{{a}}', '{b}', '<c>', '{{d}}']);
  });

  it('ni etiquetas HTML, ni secciones que se cierran, ni llaves de JSON o de código', () => {
    expect(variablesDe('Usa <div> y <br> en <ejemplo>x</ejemplo>')).toEqual([]);
    expect(variablesDe('Responde con:\n{\n  "a": "{b}"\n}\n')).toEqual([]);
    expect(variablesDe('```js\nconst f = () => {x};\n```\nY {{y}}').map(escrituraDe)).toEqual(['{{y}}']);
  });
});

describe('rendimiento', () => {
  it('lineal: un log de JSON por línea o muchas etiquetas no lo vuelven cuadrático', () => {
    const jsonl = Array.from({ length: 20_000 }, (_, i) => `{"nivel": "info", "msg": "paso {x}", "i": ${i}`).join('\n');
    const angulos = Array.from({ length: 20_000 }, (_, i) => `<v${i}> y </c${i}>`).join('\n');
    const inicio = performance.now();
    variablesDe(`{\n${jsonl}`);
    variablesDe(angulos);
    confianzaPrompt(`Write a summary\n${jsonl}`);
    expect(performance.now() - inicio).toBeLessThan(1500);
  });
});

describe('sustituir', () => {
  it('valores que contienen llaves o ángulos se insertan tal cual, sin sustituir dos veces', () => {
    const valores = { '{{a}}': '{{b}}', '{b}': '{a} y {{a}}', '<c>': '<b>' };
    expect(sustituir('{{a}} | {b} | <c> | {{a}}', valores)).toBe('{{b}} | {a} y {{a}} | <b> | {{b}}');
  });

  it('sin valor (o vacío) se deja; dentro de código solo cuenta {{x}}', () => {
    expect(sustituir('Hola {{nombre}} y {otro}', { '{{nombre}}': 'Ana', '{otro}': '' })).toBe('Hola Ana y {otro}');
    expect(sustituir('```\n{x} {{x}}\n```', { '{x}': 'no', '{{x}}': 'sí' })).toBe('```\n{x} sí\n```');
  });

  it('valores con `$&` o `$1` no se interpretan', () => {
    expect(sustituir('Precio: {p}', { '{p}': '$& y $1' })).toBe('Precio: $& y $1');
  });

  it('los trozos para resaltar reconstruyen el texto', () => {
    const texto = leer('revisor-adr.txt');
    expect(
      trozosDe(texto)
        .map((t) => t.v)
        .join(''),
    ).toBe(texto);
    expect(trozosDe(texto).filter((t) => t.t === 'variable')).toHaveLength(3);
  });
});

describe('derivados', () => {
  it('tokens aproximados: 4 caracteres por token', () => {
    expect(tokensAprox('')).toBe(0);
    expect(tokensAprox('abcd')).toBe(1);
    expect(tokensAprox('abcde')).toBe(2);
  });

  it('secciones: encabezados, roles y etiquetas XML', () => {
    expect(seccionesDe('# Uno\nsystem: x\nuser: y\n<contexto>\nz\n</contexto>\n## Dos')).toEqual([
      'Uno',
      'system',
      'user',
      'contexto',
      'Dos',
    ]);
  });

  it('destino solo si se nombra un modelo («llama a la función» no es Llama)', () => {
    expect(destinoDe('Para Claude: resume esto', 'libre')).toBe('Claude');
    expect(destinoDe('You are ChatGPT', 'libre')).toBe('GPT');
    expect(destinoDe('Usa Llama 3.1 8B', 'libre')).toBe('Llama');
    expect(destinoDe('El código llama a la función y mueve el cursor', 'libre')).toBeNull();
  });
});

describe('detección', () => {
  it('no son prompts: una idea corta, una receta, un README, una nota', () => {
    for (const texto of [
      'Revisa el ADR mañana',
      'Corta la cebolla en juliana y sofríela diez minutos a fuego lento con un poco de aceite y sal.',
      '# Proyecto\n\n## Uso\n\nEscribe `pnpm dev` para arrancar el servidor de desarrollo y abre el navegador.',
      'Hoy hemos revisado el despliegue y todo ha ido bien, salvo un aviso de memoria que vigilaremos.',
    ]) {
      expect(confianzaPrompt(texto), texto).toBe(0);
      expect(detectar({ texto }, REGISTRO).lector, texto).not.toBe('prompt');
    }
  });

  it('skill, agente y roles 0,9; CLAUDE.md 0,85; imperativo con variables 0,8', () => {
    expect(confianzaPrompt(leer('skill.md'))).toBe(0.9);
    expect(confianzaPrompt(leer('agente.md'))).toBe(0.9);
    expect(confianzaPrompt(leer('roles.txt'))).toBe(0.9);
    expect(confianzaPrompt(leer('claude-md.md'))).toBe(0.85);
    expect(confianzaPrompt(leer('revisor-adr.txt'))).toBe(0.8);
  });
});

describe('lector', () => {
  it('respuesta de la ficha, en es y en, con las reglas de estilo', () => {
    const d = analizarPrompt(leer('revisor-adr.txt'));
    const es = lectorPrompt.respuesta(elementoFalso(1), d, ctx());
    expect(frase(es)).toBe('Prompt con 3 variables. Lo puedes copiar con valores.');
    expect(comprobarEstilo(es)).toEqual([]);
    const en = lectorPrompt.respuesta(elementoFalso(1), d, ctx('en'));
    expect(frase(en)).toBe('Prompt with 3 variables. You can copy it with values.');
    expect(comprobarEstilo(en)).toEqual([]);
  });

  it('skill, agente, CLAUDE.md y sin variables', () => {
    const r = (archivo: string) =>
      frase(lectorPrompt.respuesta(elementoFalso(1), analizarPrompt(leer(archivo)), ctx()));
    expect(r('skill.md')).toBe('Skill «revisar-changelog» con 1 variable. Lo puedes copiar con valores.');
    expect(r('agente.md')).toBe('Agente «revisor-seguridad» con 1 variable. Lo puedes copiar con valores.');
    expect(r('claude-md.md')).toMatch(/^Instrucciones de proyecto \(CLAUDE\.md\) de unos \d+ tokens\.$/);
    const libre = analizarPrompt('Actúa como revisor. Responde en tres partes y no inventes nada de lo que no sepas.');
    expect(frase(lectorPrompt.respuesta(elementoFalso(1), libre, ctx()))).toMatch(/^Prompt de unos \d+ tokens\.$/);
  });

  it('título: el name, el primer encabezado o la primera frase', () => {
    expect(tituloDePrompt(leer('skill.md'))).toBe('revisar-changelog');
    expect(tituloDePrompt(leer('claude-md.md'))).toBe('CLAUDE.md');
    expect(tituloDePrompt(leer('revisor-adr.txt'))).toBe('Actúa como revisor de decisiones de arquitectura');
  });

  it('resumen como el Anexo B y resumen legible', async () => {
    const b = await lectorPrompt.leer({ texto: leer('revisor-adr.txt') });
    expect(b.resumen).toEqual({
      variables: ['adr', 'contexto', 'criterios'],
      tokens_aprox: expect.any(Number),
      forma: 'libre',
    });
    expect(lectorPrompt.resumenLegible?.({ variables: ['a'], forma: 'skill', destino: 'Claude' }, 'es')).toBe(
      'Skill · 1 variable · Para Claude',
    );
  });

  it('cifras y sin original', async () => {
    const d = analizarPrompt(leer('revisor-adr.txt'));
    expect(lectorPrompt.cifras?.variables?.(d)).toEqual({ texto: '3', valor: 3 });
    expect(lectorPrompt.cifras?.tokens?.(d).unidad).toBe('tokens');
    await expect(lectorPrompt.derivar({ ...elementoFalso(1), original: null })).rejects.toThrow('prompt.sinOriginal');
  });
});

describe('resultados', () => {
  it('se leen del frontmatter los que se entienden; media; estrellas', () => {
    const fm = {
      resultados: [
        { fecha: '2026-10-17', valoracion: 4, nota: 'Bien', archivo: 'historial/PRM-0012/resultado-2026-10-17.md' },
        { fecha: '2026-10-18', valoracion: 9 },
        { fecha: 'ayer', valoracion: 3 },
        { fecha: '2026-10-18', valoracion: 5 },
      ],
    };
    const r = resultadosDe(fm);
    expect(r.map((x) => x.valoracion)).toEqual([4, 5]);
    expect(valoracionMedia(r)).toBe(4.5);
    expect(valoracionMedia([])).toBeNull();
    expect(estrellas(4)).toBe('★★★★☆');
  });

  it('el archivo del resultado y su entrada en el frontmatter', () => {
    const md = archivoResultado({
      ref: 'PRM-0012',
      fecha: '2026-10-18',
      valoracion: 4,
      nota: 'Útil',
      respuesta: 'Hola',
    });
    const partes = separar(md);
    expect(partes.ok && partes.valor.cuerpo).toBe('Hola\n');
    const yaml = partes.ok ? leerYaml(partes.valor.yaml) : null;
    expect(yaml?.ok && yaml.valor).toEqual({ ref: 'PRM-0012', fecha: '2026-10-18', valoracion: 4, nota: 'Útil' });
    expect(baseResultado('PRM-0012', '2026-10-18')).toBe('historial/PRM-0012/resultado-2026-10-18');
    const fm = conResultado(
      { titulo: 'x', resultados: [{ fecha: '2026-10-17', valoracion: 3 }] },
      {
        fecha: '2026-10-18',
        valoracion: 4,
        nota: '',
        archivo: 'a.md',
      },
    );
    expect(fm.resultados).toHaveLength(2);
  });
});
