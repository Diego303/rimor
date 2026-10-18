/**
 * Análisis de un prompt (LEC-07, plan §8.4): variables en tres sintaxis, sustitución en una pasada, tokens
 * aproximados, secciones, destino y forma (skill, agente, `CLAUDE.md`, roles o libre). TS puro.
 */

export type Sintaxis = 'dobles' | 'llaves' | 'angulos';

export interface Variable {
  nombre: string;
  /** Cómo se escribe en el prompt: `{{x}}`, `{x}` o `<x>`. */
  sintaxis: Sintaxis;
}

export type Forma = 'skill' | 'agente' | 'claude-md' | 'roles' | 'libre';

export interface DatosPrompt {
  variables: Variable[];
  /** Aproximados: 4 caracteres por token (ver `tokensAprox`). */
  tokens: number;
  caracteres: number;
  lineas: number;
  secciones: string[];
  destino: string | null;
  forma: Forma;
  /** El `name` del frontmatter de una skill o un agente. */
  nombre: string | null;
}

const IDENT = String.raw`[A-Za-z_][\w.-]*`;
/** Las tres sintaxis a la vez, para encontrarlas y sustituirlas en una sola pasada. */
const VARIABLE = new RegExp(String.raw`\{\{\s*(${IDENT})\s*\}\}|(?<!\{)\{(${IDENT})\}(?!\})|<(${IDENT})>`, 'g');

/** Etiquetas de HTML y XML corrientes: `<div>` no es una variable. */
const ETIQUETAS = new Set(
  'a abbr b body br code dd details div dl dt em h1 h2 h3 h4 h5 h6 head hr html i img input kbd label li main nav ol option p pre q s script section select small span strong style sub summary sup table tbody td textarea tfoot th thead title tr u ul video svg path g rect circle'.split(
    ' ',
  ),
);

const sintaxisDe = (m: RegExpExecArray): Sintaxis => (m[1] ? 'dobles' : m[2] ? 'llaves' : 'angulos');
const nombreDe = (m: RegExpExecArray) => m[1] ?? m[2] ?? m[3] ?? '';

interface Entorno {
  /** Tramos `[desde, hasta)` donde las llaves y los ángulos no son variables: código y JSON. */
  excluidos: [number, number][];
  /** Etiquetas que se cierran (`</ejemplo>`): son secciones, no variables. */
  cierres: Set<string>;
}

/**
 * Bloques de código (```) y JSON (un objeto o una lista que abre una línea, hasta que se cierra, o un objeto en
 * una sola línea), en una sola pasada por líneas: un log de JSON por línea no lo vuelve cuadrático.
 */
function entornoDe(texto: string): Entorno {
  const excluidos: [number, number][] = [];
  let pos = 0;
  let codigo = -1;
  let json = -1;
  let profundidad = 0;
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    const fin = pos + linea.length;
    if (codigo >= 0) {
      if (l.startsWith('```')) {
        excluidos.push([codigo, fin]);
        codigo = -1;
      }
    } else if (json >= 0) {
      if (/[{[]$/.test(l)) profundidad++;
      if (/^[}\]]/.test(l)) profundidad--;
      if (profundidad <= 0) {
        excluidos.push([json, fin]);
        json = -1;
      }
    } else if (l.startsWith('```')) codigo = pos;
    else if (/^[{[]$/.test(l)) {
      json = pos;
      profundidad = 1;
    } else if (/^\{\s*".*\}\s*,?$/.test(l)) excluidos.push([pos, fin]);
    pos = fin + 1;
  }
  const cierres = new Set([...texto.matchAll(/<\/([A-Za-z_][\w.-]*)>/g)].map((m) => m[1] ?? ''));
  return { excluidos, cierres };
}

/** ¿Cuenta esta coincidencia como variable? */
function esVariable(m: RegExpExecArray, entorno: Entorno): boolean {
  const s = sintaxisDe(m);
  if (s !== 'dobles' && entorno.excluidos.some(([a, b]) => m.index >= a && m.index < b)) return false;
  if (s === 'angulos') {
    const n = nombreDe(m);
    return !ETIQUETAS.has(n.toLowerCase()) && !entorno.cierres.has(n);
  }
  return true;
}

/** Variables en orden de aparición, sin repetir (una variable es su nombre y su sintaxis). */
export function variablesDe(texto: string): Variable[] {
  const entorno = entornoDe(texto);
  const vistas = new Map<string, Variable>();
  for (const m of texto.matchAll(VARIABLE)) {
    if (!esVariable(m, entorno)) continue;
    const v = { nombre: nombreDe(m), sintaxis: sintaxisDe(m) };
    const clave = `${v.sintaxis}:${v.nombre}`;
    if (!vistas.has(clave)) vistas.set(clave, v);
  }
  return [...vistas.values()];
}

/** Cómo se escribe una variable en el prompt. */
export const escrituraDe = (v: Variable): string =>
  v.sintaxis === 'dobles' ? `{{${v.nombre}}}` : v.sintaxis === 'llaves' ? `{${v.nombre}}` : `<${v.nombre}>`;

/**
 * Sustituye las variables por sus valores (clave: la escritura de la variable, `{{x}}`) en una sola pasada: un
 * valor con llaves o ángulos se inserta tal cual y no se vuelve a sustituir. Sin valor (o vacío), se deja.
 */
export function sustituir(texto: string, valores: Readonly<Record<string, string>>): string {
  const entorno = entornoDe(texto);
  return texto.replace(VARIABLE, (...args) => {
    const m = Object.assign([...args.slice(0, 4)], { index: args[4] as number, input: texto }) as RegExpExecArray;
    if (!esVariable(m, entorno)) return m[0];
    const valor = valores[escrituraDe({ nombre: nombreDe(m), sintaxis: sintaxisDe(m) })];
    return valor ? valor : m[0];
  });
}

/**
 * Tokens aproximados: 4 caracteres por token. Es la regla de las guías de OpenAI y Anthropic para texto en inglés;
 * en español y con código sale algo por debajo de lo real. Se enseña siempre como «aprox.».
 */
export const CARACTERES_POR_TOKEN = 4;
export const tokensAprox = (texto: string) => Math.ceil(texto.length / CARACTERES_POR_TOKEN);

const ROL = /^\s*(?:system|user|assistant|human|ai|sistema|usuario|asistente)\s*:/i;

/** Encabezados Markdown, bloques de rol y etiquetas XML de sección, en orden. */
export function seccionesDe(texto: string): string[] {
  const secciones: string[] = [];
  const { excluidos, cierres } = entornoDe(texto);
  let pos = 0;
  for (const linea of texto.split('\n')) {
    const dentro = excluidos.some(([a, b]) => pos >= a && pos < b);
    pos += linea.length + 1;
    if (dentro) continue;
    const h = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(linea);
    if (h?.[1]) secciones.push(h[1]);
    else if (ROL.test(linea)) secciones.push((linea.split(':')[0] ?? '').trim().toLowerCase());
    else {
      const x = /^\s*<([A-Za-z_][\w-]*)>\s*$/.exec(linea);
      if (x?.[1] && !ETIQUETAS.has(x[1].toLowerCase()) && cierres.has(x[1])) secciones.push(x[1]);
    }
  }
  return secciones;
}

/** Modelos y asistentes que se nombran: «Para Claude», «You are ChatGPT». */
const DESTINOS: [RegExp, string][] = [
  [/\bclaude\b/i, 'Claude'],
  [/\b(?:chat)?gpt(?:-?\d[\w.-]*)?\b|\bopenai\b/i, 'GPT'],
  [/\bgemini\b/i, 'Gemini'],
  // «Llama» a secas es un verbo en español: solo con su versión o con Meta delante.
  [/\bllama[ -]?\d|\bmeta[ -]llama\b|\bcodellama\b/i, 'Llama'],
  [/\bmistral\b|\bmixtral\b/i, 'Mistral'],
  [/\bqwen\b/i, 'Qwen'],
  [/\bdeepseek\b/i, 'DeepSeek'],
  [/\bcopilot\b/i, 'Copilot'],
];

/** Frontmatter YAML sencillo (`clave: valor` de primer nivel), si el texto empieza por él. */
export function frontmatterDe(texto: string): Record<string, string> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(texto);
  if (!m?.[1]) return null;
  const campos: Record<string, string> = {};
  for (const l of m[1].split(/\r?\n/)) {
    const c = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(l);
    if (c?.[1]) campos[c[1]] = (c[2] ?? '').replace(/^["']|["']$/g, '').trim();
  }
  return campos;
}

/** Encabezados típicos de `CLAUDE.md` y `AGENTS.md`. */
const CLAUDE_MD =
  /^#{1,3}\s*(?:CLAUDE\.md|AGENTS\.md|Commands?|Comandos|Build|Testing|Code style|Estilo|Conventions?|Convenciones|Architecture|Arquitectura|Project overview|Repository guidelines|Instrucciones del proyecto)\b/im;

export function formaDe(texto: string): Forma {
  const fm = frontmatterDe(texto);
  if (fm?.name && fm.description) return fm.tools !== undefined || fm.model !== undefined ? 'agente' : 'skill';
  if (
    /\bCLAUDE\.md\b|\bAGENTS\.md\b/.test(texto.slice(0, 400)) ||
    (texto.match(new RegExp(CLAUDE_MD, 'gim')) ?? []).length >= 2
  )
    return 'claude-md';
  if (texto.split('\n').filter((l) => ROL.test(l)).length >= 2) return 'roles';
  return 'libre';
}

export function destinoDe(texto: string, forma: Forma): string | null {
  if (forma === 'claude-md' || forma === 'skill' || forma === 'agente') {
    if (/\bAGENTS\.md\b/.test(texto) && !/\bCLAUDE\.md\b/.test(texto)) return null;
    return 'Claude';
  }
  // Solo una mención explícita: «para Claude», «eres ChatGPT», «You are Gemini».
  for (const [patron, nombre] of DESTINOS) if (patron.test(texto)) return nombre;
  return null;
}

export function analizarPrompt(texto: string): DatosPrompt {
  const forma = formaDe(texto);
  return {
    variables: variablesDe(texto),
    tokens: tokensAprox(texto),
    caracteres: texto.length,
    lineas: texto ? texto.split('\n').length : 0,
    secciones: seccionesDe(texto),
    destino: destinoDe(texto, forma),
    forma,
    nombre: forma === 'skill' || forma === 'agente' ? (frontmatterDe(texto)?.name ?? null) : null,
  };
}

/** Segunda persona o imperativo dirigido a un modelo, al principio de una línea. */
const DIRIGIDO_A_MODELO =
  /^\s*(?:[-*]\s+|\d+[.)]\s+)?(?:act[úu]a como|eres (?:un|una|el|la)\b|ser[áa]s (?:un|una)\b|you are (?:a|an|the)\b|act as\b|imagina que eres|pretend you are|responde\b|contesta\b|dime\b|explica(?:me)?\b|resume\b|analiza\b|revisa\b|eval[úu]a\b|genera\b|escribe\b|redacta\b|traduce\b|clasifica\b|extrae\b|devuelve\b|no (?:inventes|reescribas|incluyas|uses)\b|answer\b|respond\b|reply\b|explain\b|summari[sz]e\b|analy[sz]e\b|review\b|evaluate\b|generate\b|write\b|translate\b|classify\b|extract\b|return\b|do not\b|don't\b|never\b|always\b|siempre\b|nunca\b|tu (?:tarea|objetivo|papel|rol) es\b|your (?:task|goal|role|job) is\b)/im;

/** Palabras que delatan que se habla con un modelo. */
const DE_MODELO =
  /\b(?:modelo|asistente|IA|LLM|prompt|respuesta|responde|tokens?|model|assistant|AI|response|output|formato de salida|output format)\b/;

/** Caracteres que se miran para detectar. */
const MUESTRA_DETECCION = 20_000;

/** Mínimos de longitud: una idea corta en imperativo («Revisa el ADR») no es un prompt. */
const MINIMO_CON_ESTRUCTURA = 60;
const MINIMO_SOLO_IMPERATIVO = 120;

/** Confianza de que un texto es un prompt (o una configuración de agente). */
export function confianzaPrompt(texto: string): number {
  // Basta con el principio: un prompt se reconoce por su arranque, y un log enorme no se recorre entero.
  const t = texto.slice(0, MUESTRA_DETECCION).trim();
  if (!t) return 0;
  const forma = formaDe(t);
  if (forma === 'skill' || forma === 'agente' || forma === 'roles') return 0.9;
  if (forma === 'claude-md') return 0.85;
  if (!DIRIGIDO_A_MODELO.test(t)) return 0;
  // Estructura de prompt: variables o secciones XML. Los encabezados Markdown no cuentan (un documento también
  // los tiene).
  const estructura = variablesDe(t).length > 0 || seccionesDe(t).some((s) => t.includes(`</${s}>`));
  if (estructura && t.length >= MINIMO_CON_ESTRUCTURA) return 0.8;
  if (t.length >= MINIMO_SOLO_IMPERATIVO && (DE_MODELO.test(t) || /^\s*\d+[.)]\s/m.test(t))) return 0.7;
  return 0;
}

export type Trozo = { t: 'texto'; v: string } | { t: 'variable'; v: string; variable: Variable };

/** El texto partido en trozos de texto y variables, para resaltarlas sin pintar HTML. */
export function trozosDe(texto: string): Trozo[] {
  const entorno = entornoDe(texto);
  const trozos: Trozo[] = [];
  let desde = 0;
  for (const m of texto.matchAll(VARIABLE)) {
    if (!esVariable(m, entorno)) continue;
    if (m.index > desde) trozos.push({ t: 'texto', v: texto.slice(desde, m.index) });
    trozos.push({ t: 'variable', v: m[0], variable: { nombre: nombreDe(m), sintaxis: sintaxisDe(m) } });
    desde = m.index + m[0].length;
  }
  if (desde < texto.length) trozos.push({ t: 'texto', v: texto.slice(desde) });
  return trozos;
}
