/**
 * Lenguaje de un fragmento de código (LEC-09): por extensión si llega de archivo y, si no, por densidad de
 * sintaxis entre los 12 más comunes. Se recorre por líneas con expresiones ancladas y sin cuantificadores
 * contiguos que puedan retroceder. TS puro.
 */

export type Lenguaje =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'shell'
  | 'sql';

export const LENGUAJES: readonly Lenguaje[] = [
  'typescript',
  'javascript',
  'python',
  'java',
  'csharp',
  'cpp',
  'go',
  'rust',
  'php',
  'ruby',
  'shell',
  'sql',
];

const EXTENSIONES: Record<string, Lenguaje> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  pyw: 'python',
  java: 'java',
  cs: 'csharp',
  c: 'cpp',
  h: 'cpp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  go: 'go',
  rs: 'rust',
  php: 'php',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
};

/** El lenguaje de un nombre de archivo por su extensión, o `null`. */
export function lenguajePorExtension(nombre: string | undefined): Lenguaje | null {
  const ext = /\.([A-Za-z0-9]+)$/.exec(nombre ?? '')?.[1]?.toLowerCase();
  return ext ? (EXTENSIONES[ext] ?? null) : null;
}

type Senal = readonly [RegExp, number];

/** Lo que comparten JavaScript y TypeScript. */
const JS: readonly Senal[] = [
  [/^import .+ from ['"]|^import ['"]|\brequire\(['"]/, 2],
  [/^(?:export )?(?:const|let|var) [\w$]+ ?=/, 2],
  [/^(?:export )?(?:default )?(?:async )?function\b/, 2],
  [/=>/, 1],
  [/\bconsole\.(?:log|error|warn)\(/, 2],
  [/^export (?:default|const|function|class|\{)/, 2],
];
/** Lo que solo tiene TypeScript. */
const TS: readonly Senal[] = [
  [/^(?:export )?(?:interface|type) [A-Z]\w*/, 3],
  [/: ?(?:string|number|boolean|void|unknown|any|never|Promise<)\b/, 3],
  [/\bas const\b|\bas [A-Z]\w*\b/, 2],
  // Miembros con tipo: con visibilidad (`private x: string`) o acabados en `;` (`x?: number;`). Sin eso, también
  // casarían los campos anotados de Python (`x: int = 0`).
  [/^(?:(?:public|private|protected) (?:readonly )?|readonly )[\w$]+\??: \S|^[\w$]+\??: [\w$<>[\]| ]+;$/, 2],
];

const SENALES: Record<Exclude<Lenguaje, 'typescript' | 'javascript'>, readonly Senal[]> = {
  python: [
    [/^def \w+\([^)]*\)(?: -> [^:]+)?:$/, 3],
    [/^class \w+(?:\([^)]*\))?:$/, 3],
    [/^(?:from [\w.]+ )?import [\w.]+(?:, [\w.]+)*(?: as \w+)?$/, 2],
    [/^(?:if|elif|for|while|with|try|except|else)\b.*:$/, 2],
    [/\bself\./, 2],
    [/^print\(|^return\b[^;]*$/, 1],
  ],
  java: [
    [/^(?:public|private|protected) (?:static )?(?:final )?(?:class|interface|enum|void|[A-Z]\w*(?:<[^>]*>)?) \w+/, 3],
    [/^package [\w.]+;$/, 3],
    [/^import (?:static )?[\w.]+(?:\.\*)?;$/, 3],
    [/\bSystem\.out\.print/, 3],
    [/^@(?:Override|Autowired|Test|Entity|Service)\b/, 2],
  ],
  csharp: [
    [/^using System(?:\.[\w.]+)?;$/, 4],
    [/^namespace [\w.]+/, 3],
    [/\{ get; (?:private |init; )?(?:set; )?\}/, 4],
    [/\bConsole\.Write(?:Line)?\(/, 3],
    [
      /^(?:public|private|protected|internal) (?:(?:static|readonly|async|override|virtual|sealed|abstract|partial) )*(?:class|record|struct|void|Task(?:<[^>]*>)?|string|int|bool|decimal|I[A-Z]\w*)\b/,
      3,
    ],
    [/: (?:ControllerBase|Controller|DbContext)\b|^\[(?:Http(?:Get|Post|Put|Delete)|ApiController|Route)\b/, 4],
    [/\bawait \w+(?:\.\w+)*Async\(/, 2],
  ],
  cpp: [
    [/^#include ?[<"]/, 4],
    [/\bstd::/, 3],
    [/^(?:int|void) main ?\(/, 3],
    [/\bprintf\(|\bcout ?<</, 2],
    [/^template ?</, 3],
    [/^#define \w+/, 2],
  ],
  go: [
    [/^package \w+$/, 4],
    [/^func (?:\(\w+ \*?\w+\) )?\w+\((?!.*->)/, 4],
    [/:=/, 2],
    [/^import \($|^import "/, 3],
    [/\bfmt\.(?:Print|Sprint|Errorf)/, 3],
    [/\berr != nil\b/, 3],
  ],
  rust: [
    [/^(?:pub(?:\(crate\))? )?(?:async )?fn \w+/, 4],
    [/\blet mut\b/, 3],
    [/^use [\w:]+(?:::\{[^}]*\})?;$/, 3],
    [/^impl\b/, 3],
    [/\bprintln!\(|\bvec!\[|\.unwrap\(\)|\bOk\(\(\)\)/, 3],
    [/\b(?:i8|i16|i32|i64|u8|u16|u32|u64|usize|isize|f32|f64|&str|&mut|Vec<|Option<|Result<|Box<)/, 2],
    [/\) -> [\w&<(]/, 2],
    [/\w::\w/, 1],
    [/^#\[(?:derive|test|cfg)/, 3],
  ],
  php: [
    [/^<\?php/, 6],
    [/^\$\w+ ?=/, 2],
    [/\$this->/, 3],
    [/^(?:public |private |protected )?(?:static )?function \w+\(/, 3],
    [/\$\w+->\w|\$\w+ ?\./, 1],
    [/^namespace [\w\\]+;$/, 3],
  ],
  ruby: [
    [/^def \w+[?!]?(?:\([^)]*\))?$/, 3],
    [/^end$/, 3],
    [/\bdo \|[\w, ]+\|/, 3],
    [/^require(?:_relative)? ['"]/, 3],
    [/^class \w+(?: < [\w:]+)?$/, 3],
    [/^module \w+$/, 3],
    [/^puts\b|^attr_(?:reader|accessor|writer)\b/, 2],
  ],
  shell: [
    [/^#!\/(?:usr\/)?bin\/(?:env )?(?:ba|z)?sh\b/, 6],
    [/^(?:if|while) \[\[? .+ \]\]?;? ?(?:then|do)?$/, 3],
    [/^(?:fi|done|esac|then|do)$/, 4],
    [/^for \w+ in .+?(?:; ?do)?$|^while .+; ?do$|^case .+ in$/, 3],
    [/"\$\{?\w+\}?"/, 1],
    [/\$\(\w/, 2],
    [/^export \w+=/, 2],
    [/^echo\b/, 2],
    [/\| ?(?:grep|awk|sed|xargs|sort|uniq|head|tail)\b/, 2],
    [/^(?:sudo|apt|apt-get|brew|cd|mkdir|rm|cp|mv|curl|chmod|set -e)\b/, 1],
  ],
  sql: [
    [
      /^\w+ +(?:text|integer|int|bigint|smallint|varchar|char|boolean|timestamptz|timestamp|date|real|numeric|decimal|serial|bigserial|uuid|jsonb?|bytea|double precision)\b/i,
      2,
    ],
    [
      // En mayúsculas (sin `i`): «Update the changelog» o el `from x import y` de Python no son SQL.
      /^(?:SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE (?:OR REPLACE )?(?:TABLE|INDEX|VIEW|UNIQUE|EXTENSION|FUNCTION|TRIGGER|SCHEMA|TYPE|SEQUENCE)|ALTER TABLE|DROP (?:TABLE|INDEX|VIEW)|WITH \w+ AS)\b/,
      4,
    ],
    [/^(?:FROM|WHERE|GROUP BY|ORDER BY|(?:LEFT |RIGHT |INNER |OUTER )?JOIN|HAVING|LIMIT|VALUES|AND|OR)\b/, 3],
    // En minúsculas, solo con la forma de una sentencia.
    [
      /^(?:select [\w*., ()]+ from \w|insert into \w+ ?\(|update \w+ set \w|delete from \w+(?: where|;|$)|create table (?:if not exists )?\w+ ?\()/,
      4,
    ],
  ],
};

/** Todas las señales de todos los lenguajes. */
const TODAS: readonly Senal[] = [...JS, ...TS, ...Object.values(SENALES).flat()];

/** ¿Tiene la línea (ya sin sangría) alguna construcción propia de uno de los 12 lenguajes? */
export const esLineaDeLenguaje = (linea: string) => TODAS.some(([patron]) => patron.test(linea));

/** Líneas que se miran. */
const MAX_LINEAS = 2000;
/** Puntuación mínima para dar un lenguaje, y cuánto tiene que sacar al segundo. */
const MINIMO = 4;
const VENTAJA = 1.25;

const puntuar = (lineas: readonly string[], senales: readonly Senal[]) => {
  let total = 0;
  for (const l of lineas) for (const [patron, peso] of senales) if (patron.test(l)) total += peso;
  return total;
};

/** Las líneas con contenido, sin sangría, normalizadas (CRLF) y como mucho `MAX_LINEAS`. */
export const lineasDeCodigo = (texto: string) =>
  texto
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .slice(0, MAX_LINEAS)
    .map((l) => l.trim())
    .filter(Boolean);

/** Puntuación de cada lenguaje (para depurar y para las pruebas). */
export function puntuaciones(texto: string): Record<Lenguaje, number> {
  const lineas = lineasDeCodigo(texto);
  const js = puntuar(lineas, JS);
  const ts = puntuar(lineas, TS);
  const resto = Object.fromEntries(Object.entries(SENALES).map(([l, s]) => [l, puntuar(lineas, s)])) as Record<
    Exclude<Lenguaje, 'typescript' | 'javascript'>,
    number
  >;
  // TypeScript es JavaScript con tipos: sin nada propio de TypeScript, es JavaScript.
  return { ...resto, typescript: ts ? js + ts : 0, javascript: ts ? 0 : js };
}

/** El lenguaje por densidad de sintaxis, o `null` si ninguno destaca. */
export function lenguajePorSintaxis(texto: string): Lenguaje | null {
  const p = puntuaciones(texto);
  const orden = LENGUAJES.map((l) => [l, p[l]] as const).sort((a, b) => b[1] - a[1]);
  const [primero, segundo] = orden;
  if (!primero || primero[1] < MINIMO) return null;
  if (segundo && segundo[1] > 0 && primero[1] < segundo[1] * VENTAJA) return null;
  return primero[0];
}
