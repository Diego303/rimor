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

/** Casos de la revisión independiente: retroceso, falsos positivos y prompts que no se reconocían. */
describe('revisión: coste lineal', () => {
  it('un encabezado con una tirada larga de espacios no retrocede', () => {
    const inicio = performance.now();
    seccionesDe(`# a${' '.repeat(20_000)}b`);
    confianzaPrompt(`Resume este texto en tres puntos:\n\n# Informe${' '.repeat(10_000)}pág. 3\n`);
    tituloDePrompt(`# a${' '.repeat(20_000)}b`);
    expect(performance.now() - inicio).toBeLessThan(500);
  });

  it('muchas exclusiones (JSON en una línea) y muchos saltos de línea', () => {
    const jsonEnLinea = Array.from({ length: 20_000 }, (_, i) => `{"a": "{b${i}}"}`).join('\n');
    const saltos = `Write a summary${'\n'.repeat(19_000)}x`;
    const inicio = performance.now();
    variablesDe(jsonEnLinea);
    confianzaPrompt(saltos);
    expect(performance.now() - inicio).toBeLessThan(1500);
  });
});

describe('revisión: lo que no son prompts (con el detector real)', () => {
  const casos: Record<string, string> = {
    'README con Build y Testing':
      '# Mi proyecto\n\nUna librería para leer CSV.\n\n## Build\n\npnpm build\n\n## Testing\n\npnpm test\n',
    'documento con Arquitectura y Convenciones':
      '# Diseño\n\n## Arquitectura\n\nTres capas.\n\n## Convenciones\n\nCamelCase en todo.\n',
    'idea que nombra CLAUDE.md': 'Actualizar el CLAUDE.md con la regla de commits',
    'idea que nombra AGENTS.md': 'mirar AGENTS.md del repo de Pedro',
    hashtags: '#build roto otra vez en main\n#testing hay que arreglar los flaky',
    'datos de un servidor': 'Servidor de pruebas\nSistema: Ubuntu 22.04\nUsuario: root\nIP: 10.0.0.3',
    'informe de fallo': 'El botón no responde.\nSystem: macOS 14.2\nUser: diego\nBrowser: Firefox',
    'README con `<paquete>`':
      '# Herramienta\n\nInstala con `pnpm add <paquete>` y luego:\n\nEscribe el nombre del archivo y pulsa Enter para empezar a trabajar con él en tu equipo.',
    TypeScript:
      '// Return the user list\nexport async function usuarios(): Promise<User[]> {\n  return api.get<User>("/u");\n}\n',
    Python: 'def saludo(nombre):\n    # Return a greeting\n    return f"Hola {nombre}, tienes {n} mensajes"\n',
    Jinja:
      '<ul>\n{% for item in items %}\n  <li>{{ item.name }}</li>\n{% endfor %}\n</ul>\nNever edit this file by hand, it is generated from the template.',
    receta:
      'Receta de lentejas\n1. Pon las lentejas en remojo.\n2. Escribe la lista de la compra.\n3. Nunca añadas sal al principio porque se endurecen y tardan más en cocer bien.',
    correo:
      'Hola Ana,\n\nRevisa el documento que te envío antes del viernes, por favor. Siempre que puedas, responde con tus comentarios en el mismo hilo para no perder nada de la respuesta.\n\nUn saludo,\nDiego',
    'lista de tareas':
      '- Revisa el PR de Luis\n- Escribe el changelog\n- Nunca hagas push a main sin revisar los tests primero, que luego pasa lo que pasa en producción.',
    HTML: '<html>\n<body>\n<header>\n<nav>Menú</nav>\n</header>\n<form>\n<button>Enviar</button>\n</form>\n<footer>Pie</footer>\n</body>\n</html>\nAlways keep this file valid.',
    'YAML de varios documentos': '---\nname: api\ndescription: servicio\n---\nname: web\ndescription: front\n',
  };
  for (const [nombre, texto] of Object.entries(casos))
    it(nombre, () => {
      expect(confianzaPrompt(texto), nombre).toBe(0);
      expect(detectar({ texto }, REGISTRO).lector).not.toBe('prompt');
    });

  it('las trazas de Python no ofrecen la duda con Prompt', () => {
    for (const f of ['python/04.txt', 'python/05.txt', 'variantes/py-chain.txt', 'variantes/py-win-stdlib.txt']) {
      const texto = readFileSync(join(process.cwd(), 'fixtures/trazas', f), 'utf8');
      expect(confianzaPrompt(texto), f).toBe(0);
      expect(variablesDe(texto).map(escrituraDe), f).not.toContain('<module>');
    }
  });
});

describe('revisión: prompts que no se reconocían', () => {
  it('papeles y encargos en la primera línea', () => {
    for (const texto of [
      "You are a helpful assistant that answers questions about the user's calendar. Be concise and friendly. If you do not know the answer, say so.",
      'You will be given a customer email. Classify its sentiment as positive, negative or neutral and explain your reasoning briefly in one sentence.',
      'Vas a actuar como un tutor de matemáticas para estudiantes de secundaria. Explica cada paso con ejemplos sencillos y pregunta si lo han entendido.',
      'Te paso un artículo. Quiero que lo resumas en cinco puntos clave, en español neutro, sin opiniones propias y citando las cifras exactas del texto.',
    ])
      expect(detectar({ texto }, REGISTRO).lector, texto).toBe('prompt');
  });

  it('«You are a … agent» es un agente; un CLAUDE.md soltado se reconoce por su nombre', () => {
    const agente =
      'You are a code review agent. Your job is to find bugs in the diff.\n\nRules:\n- Only report real bugs.\n- Be concise.';
    expect(analizarPrompt(agente).forma).toBe('agente');
    expect(confianzaPrompt('# Proyecto\n\nNotas sueltas del proyecto.', 'CLAUDE.md')).toBe(0.85);
    expect(analizarPrompt('# Proyecto\n\nNotas.', 'AGENTS.md').forma).toBe('claude-md');
  });

  it('variables con letras de cualquier alfabeto; Handlebars sin escapar no es una variable', () => {
    expect(variablesDe('{año} {{nombre_ñ}} <tú>').map(escrituraDe)).toEqual(['{año}', '{{nombre_ñ}}', '<tú>']);
    expect(variablesDe('{{{html}}}')).toEqual([]);
  });

  it('no son variables: genéricos, teclas, etiquetas vacías, código en línea y `~~~`', () => {
    expect(variablesDe('Pulsa <Enter> o <Esc>; usa <meta> y <link>; Map<K, V> y List<T>')).toEqual([]);
    expect(variablesDe('Usa `format!("{name}")` y `{{x}}` como ejemplo')).toEqual([]);
    expect(variablesDe('~~~\n{x}\n~~~\nY {y}').map(escrituraDe)).toEqual(['{y}']);
    expect(variablesDe('```\n{x} sin cerrar')).toEqual([]);
  });

  it('destino: ni Claude Shannon ni gpt-partition-table; una skill con `model` sigue siendo skill', () => {
    expect(destinoDe('El algoritmo de Claude Shannon', 'libre')).toBeNull();
    expect(destinoDe('Usa gpt-partition-table', 'libre')).toBeNull();
    expect(destinoDe('Usa GPT-4o', 'libre')).toBe('GPT');
    expect(analizarPrompt('---\nname: x\ndescription: y\nmodel: sonnet\n---\n\nHaz esto.').forma).toBe('skill');
  });

  it('secciones: también las listas numeradas de primer nivel', () => {
    expect(seccionesDe('1. Lo que está bien\n2. Lo que falta\n   1. anidada')).toEqual([
      'Lo que está bien',
      'Lo que falta',
    ]);
  });

  it('una forma desconocida en el YAML se lee como prompt libre', () => {
    expect(lectorPrompt.resumenLegible?.({ forma: 'rara', variables: [] }, 'es')).toBe('Prompt · 0 variables');
  });
});
