/**
 * Análisis de un prompt (LEC-07, plan §8.4): variables en tres sintaxis, sustitución en una pasada, tokens
 * aproximados, secciones, destino y forma (skill, agente, `CLAUDE.md`, roles o libre). TS puro.
 *
 * Todo es lineal en el tamaño del texto: sin expresiones que retrocedan sobre tiradas largas (espacios, saltos de
 * línea) y con los tramos excluidos buscados por bisección.
 */

export type Sintaxis = 'dobles' | 'llaves' | 'angulos';

export interface Variable {
  nombre: string;
  /** Cómo se escribe en el prompt: `{{x}}`, `{x}` o `<x>`. */
  sintaxis: Sintaxis;
}

export type Forma = 'skill' | 'agente' | 'claude-md' | 'roles' | 'libre';
export const FORMAS: readonly Forma[] = ['skill', 'agente', 'claude-md', 'roles', 'libre'];

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

/** Caracteres que se miran para detectar y para decidir la forma (los mismos al detectar y al derivar). */
export const MUESTRA = 20_000;

/** Nombres de variable: letras de cualquier alfabeto (`{año}`, `{{nombre_ñ}}`), cifras, `_`, `.` y `-`. */
const IDENT = String.raw`[\p{L}_][\p{L}\p{N}_.-]*`;
/**
 * Las tres sintaxis a la vez, para encontrarlas y sustituirlas en una sola pasada. `{{{x}}}` (Handlebars sin
 * escapar) no es ninguna de ellas.
 */
const VARIABLE = new RegExp(
  String.raw`(?<!\{)\{\{[ \t]*(${IDENT})[ \t]*\}\}(?!\})|(?<!\{)\{(${IDENT})\}(?!\})|<(${IDENT})>`,
  'gu',
);

/** Elementos de HTML (y de SVG corrientes): `<div>`, `<meta>`, `<header>` no son variables. */
const ETIQUETAS = new Set(
  `a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col
  colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2
  h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta
  meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script
  search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot
  th thead time title tr track u ul var video wbr svg path g rect circle line polyline polygon ellipse text tspan
  defs use symbol`.split(/\s+/),
);

/**
 * Lo que va entre ángulos sin ser una variable: marcadores de Python y JavaScript en las trazas (`<module>`),
 * teclas (`<Enter>`) y parámetros de tipo de una letra (`<T>`, `<K>`).
 */
const NO_VARIABLES = new Set(
  'module lambda genexpr listcomp dictcomp setcomp anonymous frozen string stdin locals enter esc escape tab space backspace delete del return shift ctrl alt cmd meta up down left right home end pageup pagedown'.split(
    ' ',
  ),
);

const sintaxisDe = (m: RegExpExecArray): Sintaxis => (m[1] ? 'dobles' : m[2] ? 'llaves' : 'angulos');
const nombreDe = (m: RegExpExecArray) => m[1] ?? m[2] ?? m[3] ?? '';

interface Entorno {
  /** Tramos `[desde, hasta)` ordenados, de bloques de código y JSON: ni llaves ni ángulos son variables. */
  excluidos: [number, number][];
  /** Código en línea (`` `…` ``): tampoco `{{x}}` (se está hablando de la sintaxis, no usándola). */
  enLinea: [number, number][];
  /** Etiquetas que se cierran (`</ejemplo>`): son secciones, no variables. */
  cierres: Set<string>;
}

/** ¿Cae `pos` dentro de alguno de los tramos? Bisección: los tramos van en orden. */
function dentroDe(t: readonly [number, number][], pos: number): boolean {
  let a = 0;
  let b = t.length - 1;
  while (a <= b) {
    const m = (a + b) >> 1;
    const [desde, hasta] = t[m] as [number, number];
    if (pos < desde) b = m - 1;
    else if (pos >= hasta) a = m + 1;
    else return true;
  }
  return false;
}

/** El código en línea (`` `…` ``) de una línea, como tramos absolutos. */
function codigoEnLinea(linea: string, pos: number, tramos: [number, number][]): void {
  let i = linea.indexOf('`');
  while (i >= 0) {
    const j = linea.indexOf('`', i + 1);
    if (j < 0) return;
    tramos.push([pos + i, pos + j + 1]);
    i = linea.indexOf('`', j + 1);
  }
}

/**
 * Bloques de código (``` o ~~~; sin cerrar, hasta el final), JSON (un objeto o una lista que abre una línea hasta
 * que se cierra, o un objeto o una lista de objetos en una sola línea) y código en línea, en una pasada por líneas.
 */
function entornoDe(texto: string): Entorno {
  const excluidos: [number, number][] = [];
  const enLinea: [number, number][] = [];
  let pos = 0;
  let codigo = -1;
  let valla = '';
  let json = -1;
  let profundidad = 0;
  for (const linea of texto.split('\n')) {
    const l = linea.trim();
    const fin = pos + linea.length;
    if (codigo >= 0) {
      if (l.startsWith(valla)) {
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
    } else if (l.startsWith('```') || l.startsWith('~~~')) {
      codigo = pos;
      valla = l.slice(0, 3);
    } else if (/^[{[]$/.test(l)) {
      json = pos;
      profundidad = 1;
    } else if (/^\[?\{\s*"/.test(l) && /[}\]],?$/.test(l)) excluidos.push([pos, fin]);
    else codigoEnLinea(linea, pos, enLinea);
    pos = fin + 1;
  }
  if (codigo >= 0) excluidos.push([codigo, texto.length]);
  excluidos.sort((x, y) => x[0] - y[0]);
  const cierres = new Set([...texto.matchAll(/<\/([\p{L}_][\p{L}\p{N}_.-]*)>/gu)].map((m) => m[1] ?? ''));
  return { excluidos, enLinea, cierres };
}

/** ¿Cuenta esta coincidencia como variable? `{{x}}` cuenta siempre: es sintaxis de plantilla también en código. */
function esVariable(m: RegExpExecArray, entorno: Entorno): boolean {
  const s = sintaxisDe(m);
  if (dentroDe(entorno.enLinea, m.index)) return false;
  if (s !== 'dobles' && dentroDe(entorno.excluidos, m.index)) return false;
  if (s === 'angulos') {
    const n = nombreDe(m);
    const minusculas = n.toLowerCase();
    if (ETIQUETAS.has(minusculas) || NO_VARIABLES.has(minusculas) || entorno.cierres.has(n)) return false;
    if (/^\p{Lu}$/u.test(n)) return false;
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
    const escrita = escrituraDe({ nombre: nombreDe(m), sintaxis: sintaxisDe(m) });
    const valor = Object.hasOwn(valores, escrita) ? valores[escrita] : undefined;
    return valor ? valor : m[0];
  });
}

/**
 * Tokens aproximados: 4 caracteres por token. Es la regla de las guías de OpenAI y Anthropic para texto en inglés;
 * en español y con código sale algo por debajo de lo real. Se enseña siempre como «aprox.».
 */
export const CARACTERES_POR_TOKEN = 4;
export const tokensAprox = (texto: string) => Math.ceil(texto.length / CARACTERES_POR_TOKEN);

/**
 * El título de un encabezado ATX (`## Título ##`), o `null`. A mano y no con una expresión: `\s+(.+?)\s*#*\s*$`
 * retrocede de forma cúbica con una tirada larga de espacios.
 */
export function encabezadoDe(linea: string): { nivel: number; titulo: string } | null {
  let nivel = 0;
  while (nivel < linea.length && linea[nivel] === '#') nivel++;
  if (nivel < 1 || nivel > 6) return null;
  const tras = linea[nivel];
  if (tras !== ' ' && tras !== '\t') return null;
  let titulo = linea.slice(nivel).trim();
  // Cierre opcional: `## Título ##` (los `#` finales tras un espacio).
  let fin = titulo.length;
  while (fin > 0 && titulo[fin - 1] === '#') fin--;
  if (fin < titulo.length && (fin === 0 || titulo[fin - 1] === ' ' || titulo[fin - 1] === '\t'))
    titulo = titulo.slice(0, fin).trim();
  return titulo ? { nivel, titulo } : null;
}

const NOMBRES_DE_ROL = 'system|user|assistant|human|ai|sistema|usuario|asistente';
const ROL = new RegExp(`^[ \\t]*(${NOMBRES_DE_ROL})[ \\t]*:(.*)$`, 'i');

const palabras = (s: string) => s.split(/\s+/).filter((p) => /\p{L}/u.test(p)).length;

/** Bloques de rol con su número de palabras: «system: Eres…» frente a «Sistema: Ubuntu 22.04». */
function rolesDe(lineas: readonly string[]): { rol: string; palabras: number }[] {
  const bloques: { rol: string; palabras: number }[] = [];
  for (const l of lineas) {
    const r = ROL.exec(l);
    const ultimo = bloques.at(-1);
    if (r?.[1]) bloques.push({ rol: r[1].toLowerCase(), palabras: palabras(r[2] ?? '') });
    else if (ultimo && l.trim()) ultimo.palabras += palabras(l);
  }
  return bloques;
}

/** Encabezados Markdown, bloques de rol, etiquetas XML de sección y listas numeradas de primer nivel, en orden. */
export function seccionesDe(texto: string): string[] {
  const secciones: string[] = [];
  const entorno = entornoDe(texto);
  let pos = 0;
  for (const linea of texto.split('\n')) {
    const dentro = dentroDe(entorno.excluidos, pos);
    pos += linea.length + 1;
    if (dentro) continue;
    const h = encabezadoDe(linea);
    if (h) {
      secciones.push(h.titulo);
      continue;
    }
    const r = ROL.exec(linea);
    if (r?.[1]) {
      secciones.push(r[1].toLowerCase());
      continue;
    }
    const x = /^[ \t]*<([\p{L}_][\p{L}\p{N}_-]*)>[ \t]*$/u.exec(linea);
    if (x?.[1] && !ETIQUETAS.has(x[1].toLowerCase()) && entorno.cierres.has(x[1])) {
      secciones.push(x[1]);
      continue;
    }
    const n = /^\d{1,2}[.)][ \t]+(\S.{0,79})/.exec(linea);
    if (n?.[1]) secciones.push(n[1].trim());
  }
  return secciones;
}

/** Modelos y asistentes que se nombran: «Para Claude», «You are ChatGPT». */
const DESTINOS: [RegExp, string][] = [
  // «Claude Shannon» no es un modelo.
  [/\bclaude\b(?![ \t]+shannon)/i, 'Claude'],
  // Sin `i`: «gpt-partition-table» no es GPT.
  [/\b(?:ChatGPT|chatgpt|GPT(?:-?\d[\w.]*)?|gpt-\d[\w.]*|OpenAI|openai)\b/, 'GPT'],
  [/\bgemini\b/i, 'Gemini'],
  // «Llama» a secas es un verbo en español: solo con su versión o con Meta delante.
  [/\bllama[ -]?\d|\bmeta[ -]llama\b|\bcodellama\b/i, 'Llama'],
  [/\bmistral\b|\bmixtral\b/i, 'Mistral'],
  [/\bqwen\b/i, 'Qwen'],
  [/\bdeepseek\b/i, 'DeepSeek'],
  [/\bcopilot\b/i, 'Copilot'],
];

/** Frontmatter YAML sencillo (`clave: valor` de primer nivel), si el texto empieza por él y lo sigue un cuerpo. */
export function frontmatterDe(texto: string): Record<string, string> | null {
  if (!texto.startsWith('---')) return null;
  const cierre = texto.indexOf('\n---', 3);
  if (cierre < 0) return null;
  const campos: Record<string, string> = {};
  for (const l of texto.slice(3, cierre).split(/\r?\n/)) {
    const c = /^([A-Za-z_][\w-]*):[ \t]*(.*)$/.exec(l);
    if (c?.[1]) campos[c[1]] = (c[2] ?? '').replace(/^["']|["']$/g, '').trim();
  }
  // Un YAML de varios documentos (`---` entre documentos) no es una skill: el cuerpo tiene que ser texto.
  const cuerpo = texto.slice(cierre + 4).replace(/^-*\r?\n/, '');
  const primera = (cuerpo.split('\n').find((l) => l.trim()) ?? '').trim();
  if (/^[A-Za-z_][\w-]*:(?:[ \t]|$)/.test(primera) || primera === '---') return null;
  return campos;
}

/** Nombres de archivo de instrucciones para agentes, si llega como archivo. */
export const ARCHIVOS_DE_AGENTE =
  /^(?:CLAUDE|AGENTS|GEMINI|CLAUDE\.local)\.md$|^\.cursorrules$|^copilot-instructions\.md$/i;

/** Una regla para un agente: «nunca», «siempre», «antes de…», «no preguntes», «must», «do not»… */
const REGLA =
  /\b(?:nunca|siempre|antes de|no (?:hagas|uses|toques|preguntes|modifiques|cambies|añadas|borres)|never|always|must|do not|don't|before (?:you|any)|prefer|evita|avoid)\b/i;
const VINETA = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\S/;
const PLANTILLA_CLAUDE_CODE =
  /^This file provides guidance to (?:Claude|AI|coding agents)|^Este archivo (?:guía|orienta) a Claude/i;

/**
 * `CLAUDE.md` y familia: llega con su nombre de archivo, su primer encabezado es su nombre, empieza como la
 * plantilla de Claude Code, o es una lista de reglas para el agente (al menos 3 viñetas y el 60 % con una regla).
 * Nombrar el archivo en una frase («actualizar el CLAUDE.md») no basta.
 */
function esClaudeMd(lineas: readonly string[], nombre?: string): boolean {
  if (nombre && ARCHIVOS_DE_AGENTE.test(nombre)) return true;
  const conTexto = lineas.filter((l) => l.trim());
  const primera = conTexto[0] ?? '';
  // Encabezado ATX (`# …`) o Setext (el título subrayado con `===` o `---`).
  const titulo = encabezadoDe(primera)?.titulo ?? (/^[=-]{3,}\s*$/.test(conTexto[1] ?? '') ? primera.trim() : null);
  // `# CLAUDE.md`, o el `# Repository Guidelines` de la plantilla de AGENTS.md.
  if (titulo && /^(?:(?:CLAUDE|AGENTS|GEMINI)\.md\b|Repository Guidelines$)/i.test(titulo)) return true;
  if (conTexto.slice(0, 3).some((l) => PLANTILLA_CLAUDE_CODE.test(l.trim()))) return true;
  // Un documento cuyo título, o el párrafo que lo sigue, dice que es para un agente (no que habla de agentes).
  if (titulo && (TITULO_DE_AGENTE.test(titulo) || CABEZA_DE_AGENTE.test(conTexto.slice(1, 4).join(' ').slice(0, 600))))
    return true;
  const vinetas = conTexto.filter((l) => VINETA.test(l));
  return vinetas.length >= 3 && vinetas.filter((l) => REGLA.test(l)).length / vinetas.length >= 0.6;
}

/** Títulos de unas instrucciones para agentes: «Claude Code — Struo», «nvm Coding Agent Instructions». */
const TITULO_DE_AGENTE =
  /\b(?:CLAUDE\.md|AGENTS\.md|GEMINI\.md|Claude Code|agent instructions|instrucciones para (?:Claude|agentes?)|(?:guía )?para agentes|for (?:AI |coding )?agents)\b/i;
/** El párrafo de arranque de unas instrucciones para agentes: se dirige al agente, no habla de él. */
const CABEZA_DE_AGENTE =
  /\b(?:provides guidance (?:to|for)|guidance for (?:AI|coding) agents|for AI (?:coding )?agents (?:when|working)|para que (?:los )?agentes de IA|instrucciones para (?:Claude|agentes?)|en (?:esta|la) sesión(?: principal)? eres\b)/i;

/** «You are a code review agent», «Eres un agente que…», al arrancar (no en un ejemplo de un README). */
const SOY_AGENTE = /^[ \t]*(?:you are an? [\w -]{0,40}\bagent\b|eres un agente\b)/i;

/** La primera línea con texto que no es un encabezado ni un separador. */
const arranqueDe = (lineas: readonly string[]) =>
  lineas.find((l) => l.trim() && !encabezadoDe(l) && !/^[=-]{3,}\s*$/.test(l.trim())) ?? '';

export function formaDe(texto: string, nombreArchivo?: string): Forma {
  const t = texto.slice(0, MUESTRA);
  const fm = frontmatterDe(t);
  // Un agente de Claude Code declara sus herramientas (`tools`); una skill puede llevar `allowed-tools` o `model`.
  if (fm?.name && fm.description) return fm.tools !== undefined ? 'agente' : 'skill';
  const lineas = t.split('\n');
  if (esClaudeMd(lineas, nombreArchivo)) return 'claude-md';
  const conContenido = new Set(
    rolesDe(lineas)
      .filter((r) => r.palabras >= 4)
      .map((r) => r.rol),
  );
  if (conContenido.size >= 2) return 'roles';
  if (SOY_AGENTE.test(arranqueDe(lineas))) return 'agente';
  return 'libre';
}

export function destinoDe(texto: string, forma: Forma): string | null {
  const t = texto.slice(0, MUESTRA);
  const nombrado = DESTINOS.find(([patron]) => patron.test(t))?.[1] ?? null;
  // Solo una mención explícita («para Claude», «eres ChatGPT»), salvo las skills y los agentes de Claude Code, que
  // son para Claude. Unas instrucciones de proyecto son para Claude si lo nombran (`AGENTS.md`, para cualquiera).
  if (forma === 'skill' || (forma === 'agente' && frontmatterDe(t))) return 'Claude';
  if (forma === 'claude-md') return /\bclaude\b/i.test(t) ? 'Claude' : nombrado;
  return nombrado;
}

export function analizarPrompt(texto: string, nombreArchivo?: string): DatosPrompt {
  const forma = formaDe(texto, nombreArchivo);
  const fm = forma === 'skill' || forma === 'agente' ? frontmatterDe(texto.slice(0, MUESTRA)) : null;
  return {
    variables: variablesDe(texto),
    tokens: tokensAprox(texto),
    caracteres: texto.length,
    lineas: texto ? texto.split('\n').length : 0,
    secciones: seccionesDe(texto),
    destino: destinoDe(texto, forma),
    forma,
    nombre: fm?.name ?? null,
  };
}

/**
 * Segunda persona o imperativo dirigido a un modelo, al principio de una línea. Sin `\s*` (con la bandera `m`
 * retrocede sobre muchos saltos de línea) ni verbos que abren líneas de código (`return`, `write`…).
 */
const DIRIGIDO_A_MODELO =
  /^[ \t]*(?:[-*][ \t]+|\d+[.)][ \t]+)?(?:act[úu]a como|eres (?:un|una|el|la)\b|ser[áa]s (?:un|una)\b|vas a (?:actuar|hacer de|ser)\b|imagina que eres|te (?:paso|voy a pasar|doy)\b|quiero que\b|necesito que\b|responde\b|contesta\b|dime\b|expl[íi]ca(?:me)?\b|resume\b|res[úu]meme\b|analiza\b|revisa\b|eval[úu]a\b|genera\b|escribe\b|redacta\b|traduce\b|clasifica\b|extrae\b|devuelve\b|no (?:inventes|reescribas|incluyas|uses|añadas)\b|tu (?:tarea|objetivo|papel|rol) es\b|you are (?:a|an|the)\b|act as\b|pretend you are|you will (?:be given|receive|act)\b|i (?:want|need) you to\b|answer\b|respond\b|reply\b|explain\b|summari[sz]e\b|analy[sz]e\b|review the\b|evaluate\b|generate\b|write (?:a|an|the)\b|translate\b|classify\b|extract\b|do not (?:invent|rewrite|include)\b|your (?:task|goal|role|job) is\b)/iu;

/** Abrir dándole un papel o una tarea al modelo: «Eres un…», «Actúa como…», «You will be given…». */
const ASIGNA_PAPEL =
  /^[ \t]*(?:act[úu]a como|eres (?:un|una|el|la)\b|ser[áa]s (?:un|una)\b|vas a (?:actuar|hacer de)\b|imagina que eres|tu (?:tarea|objetivo|papel|rol) es\b|you are (?:a|an|the)\b|act as\b|pretend you are|you will be given\b|your (?:task|goal|role|job) is\b)/iu;

/** Lo que se le pasa al modelo: «el siguiente texto», «a continuación», «the following», «below». */
const ENTRADA =
  /\b(?:el siguiente|la siguiente|lo siguiente|a continuación|este (?:texto|artículo|documento|código|correo)|esta (?:conversación|tabla|lista)|the following|this (?:text|article|document|code|email)|below)\b/iu;

/** Palabras que delatan que se habla con un modelo. */
const DE_MODELO =
  /\b(?:modelo|asistente|IA|LLM|prompt|tokens?|model|assistant|AI|output|formato de salida|output format)\b/;

/** Lo que es código, una traza o un documento de marcado, aunque tenga «variables»: no es un prompt. */
const NO_ES_PROMPT =
  /^Traceback \(most recent call last\)|^[ \t]+File "|^[ \t]+at [\w$.<>]+ \(|^<\?xml|^<!DOCTYPE|\{%|^[ \t]*(?:import|from \S+ import|export|const|let|var|function|def|class|package|public|private|fn|func|#include)\b/m;
// Una línea que acaba en `}` puede ser una variable (`Analiza {texto}`): solo cuentan `;`, `{` al final y `}` al principio.
const LINEA_DE_CODIGO = /[;{]$|^[}\]]|=>|^(?:return|if|for|while|else)\b/;

/** El texto sin sus bloques de código ni su JSON. */
function sinBloques(texto: string): string {
  const { excluidos } = entornoDe(texto);
  let fuera = '';
  let desde = 0;
  for (const [a, b] of excluidos) {
    fuera += texto.slice(desde, a);
    desde = Math.max(desde, b);
  }
  return fuera + texto.slice(desde);
}

/** Mínimos de longitud: una idea corta en imperativo («Revisa el ADR») no es un prompt. */
const MINIMO_CON_ESTRUCTURA = 40;
const MINIMO_SOLO_IMPERATIVO = 120;

/** Confianza de que un texto es un prompt (o una configuración de agente). */
export function confianzaPrompt(texto: string, nombreArchivo?: string): number {
  // Basta con el principio: un prompt se reconoce por su arranque, y un log enorme no se recorre entero.
  const t = texto.slice(0, MUESTRA).trim();
  if (!t) return 0;
  const forma = formaDe(t, nombreArchivo);
  if (forma === 'skill' || forma === 'agente' || forma === 'roles') return 0.9;
  if (forma === 'claude-md') return 0.85;
  // Lo que va en bloques de código (ejemplos dentro de unas instrucciones) no dice que el texto sea código.
  const prosa = sinBloques(t);
  if (NO_ES_PROMPT.test(prosa)) return 0;
  const lineas = t.split('\n').filter((l) => l.trim());
  const deProsa = prosa.split('\n').filter((l) => l.trim());
  if (!deProsa.length || deProsa.filter((l) => LINEA_DE_CODIGO.test(l.trim())).length / deProsa.length > 0.3) return 0;
  // Por frases, no solo por líneas: «Te paso un artículo. Quiero que lo resumas…» son dos instrucciones.
  const frases = lineas.flatMap((l) => l.split(/(?<=[.!?:])[ \t]+/));
  const dirigidas = frases.filter((f) => DIRIGIDO_A_MODELO.test(f)).length;
  if (!dirigidas) return 0;
  // Estructura de prompt: variables o secciones XML. Los encabezados Markdown no cuentan (un documento también
  // los tiene).
  // En un documento con varios encabezados, una variable suelta (`<x>` en una explicación) no basta.
  const encabezados = lineas.filter((l) => encabezadoDe(l)).length;
  const variables = variablesDe(t).length;
  const estructura = variables >= (encabezados >= 3 ? 2 : 1) || seccionesDe(t).some((s) => t.includes(`</${s}>`));
  if (estructura && t.length >= MINIMO_CON_ESTRUCTURA) return 0.8;
  // El papel, en la primera línea que no es un encabezado ni un separador.
  if (ASIGNA_PAPEL.test(arranqueDe(lineas)) && t.length >= MINIMO_SOLO_IMPERATIVO / 2) return 0.8;
  if (t.length < MINIMO_SOLO_IMPERATIVO) return 0;
  // Sin papel ni variables: que hable de un modelo o de lo que se le pasa, o varias instrucciones en prosa (una
  // lista de tareas en imperativo es eso, una lista de tareas).
  const soloVinetas = lineas.every((l) => VINETA.test(l));
  // Un documento con varios encabezados y sin variables ni papel es eso, un documento (lector Markdown).
  if (encabezados >= 2) return 0;
  if (DE_MODELO.test(t) || ENTRADA.test(t) || (dirigidas >= 2 && !soloVinetas)) return 0.7;
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
