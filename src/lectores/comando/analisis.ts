/**
 * Comandos de terminal (LEC-10, IN-043): hasta tres comandos (una línea, o varias unidas con `\`) que empiezan por
 * `$ ` o por un programa conocido, y sus huecos `{{nombre}}` (los `${VAR}` y `$VAR` son del shell y `<x>` es una
 * redirección: no son huecos). TS puro.
 */

/** Programas que, sin `$ ` delante, bastan para reconocer un comando. Lista corta a propósito. */
export const PROGRAMAS: ReadonlySet<string> = new Set([
  'git',
  'gh',
  'cargo',
  'rustc',
  'rustup',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'node',
  'deno',
  'bun',
  'python',
  'python3',
  'pip',
  'pip3',
  'uv',
  'poetry',
  'go',
  'java',
  'mvn',
  'gradle',
  'dotnet',
  'make',
  'cmake',
  'docker',
  'podman',
  'kubectl',
  'helm',
  'terraform',
  'ansible',
  'aws',
  'gcloud',
  'az',
  'ssh',
  'scp',
  'rsync',
  'curl',
  'wget',
  'ls',
  'cd',
  'cat',
  'grep',
  'rg',
  'find',
  'sed',
  'awk',
  'jq',
  'tar',
  'unzip',
  'chmod',
  'chown',
  'sudo',
  'systemctl',
  'journalctl',
  'ps',
  'kill',
  'tail',
  'head',
  'brew',
  'apt',
  'apt-get',
  'dnf',
  'pacman',
  'psql',
  'mysql',
  'sqlite3',
  'redis-cli',
  'duckdb',
  'ffmpeg',
  'hyperfine',
  'perf',
  'strace',
  'openssl',
  'export',
  'echo',
]);

/** Como mucho tantos comandos: más ya es un script. */
export const MAX_COMANDOS = 3;

const HUECO = /\{\{\s*([A-Za-z_][\w.-]*)\s*\}\}/g;
/**
 * Marcas de prompt delante del comando: `$ `, `% `, `❯ `, `usuario@máquina:~$ ` y `PS C:\…> ` (PowerShell). `> ` solo
 * si le sigue un programa conocido (si no, es una cita de Markdown).
 */
const PROMPT = /^(?:\$|%|❯|[\w.-]+@[\w.-]+:\S*[$#]|PS [A-Za-z]:\\[^>]*>)\s+/;
const PROMPT_CITA = /^>\s+/;
/** Prefijos que no son el programa: `sudo` (y sus opciones), `env`, `time`, `nohup`, `xargs`, `watch`. */
const PREFIJOS = new Set(['sudo', 'env', 'time', 'nohup', 'xargs', 'watch', 'exec']);
/** Opciones de `sudo` que llevan un valor detrás (`-u postgres`). */
const OPCIONES_CON_VALOR = new Set(['-u', '-g', '-h', '-p', '-C', '-D', '-U', '-n']);
/** Palabras de una frase (en español y en inglés): con ellas y sin nada que parezca un argumento, es prosa. */
const PALABRAS_DE_FRASE = new Set(
  'the a an to and or of in on for with into over this that is are be it your my el la los las un una unos unas de del y o en con para por que es al se su lo'.split(
    ' ',
  ),
);
/** Las palabras reservadas de las plantillas de Go (`docker --format`, `gh --template`, `helm`): no son huecos. */
const RESERVADAS_GO = new Set(['end', 'else', 'break', 'continue']);

export interface DatosComando {
  /** Cada comando, sin la marca de prompt y con sus continuaciones unidas. */
  comandos: string[];
  /** El programa del primero (`cargo`), o `null`. */
  programa: string | null;
  /** Los huecos como se escriben (`{{baseline}}`), en su orden y sin repetir. */
  huecos: string[];
}

interface Comando {
  cuerpo: string;
  conPrompt: boolean;
}

function sinPrompt(linea: string): Comando {
  if (PROMPT.test(linea)) return { cuerpo: linea.replace(PROMPT, ''), conPrompt: true };
  if (PROMPT_CITA.test(linea)) {
    const cuerpo = linea.replace(PROMPT_CITA, '');
    if (PROGRAMAS.has(programaDe(cuerpo) ?? '')) return { cuerpo, conPrompt: true };
  }
  return { cuerpo: linea, conPrompt: false };
}

/** La comilla que queda abierta al final de un texto de shell (`'` o `"`), o `null`. */
function comillaAbierta(s: string, desde: "'" | '"' | null = null): "'" | '"' | null {
  let abierta = desde;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (abierta === "'") {
      if (c === "'") abierta = null;
    } else if (c === '\\') i++;
    else if (abierta === '"') {
      if (c === '"') abierta = null;
    } else if (c === "'" || c === '"') abierta = c;
  }
  return abierta;
}

/**
 * Los comandos de un texto: las líneas que acaban en `\`, las comillas abiertas y los heredocs (`<<EOF`) siguen en la
 * línea siguiente. En una sesión pegada (la primera línea con prompt), las líneas sin prompt son la salida: no
 * cuentan.
 */
function leerComandos(texto: string): Comando[] {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const sesion = sinPrompt((lineas.find((l) => l.trim()) ?? '').trim()).conPrompt;
  const comandos: Comando[] = [];
  let actual: Comando | null = null;
  let comilla: "'" | '"' | null = null;
  let heredoc: string | null = null;
  let barra = false;
  const cerrar = () => {
    if (actual?.cuerpo.trim()) comandos.push({ ...actual, cuerpo: actual.cuerpo.trim() });
    actual = null;
  };
  for (const linea of lineas) {
    if (actual && (heredoc || comilla || barra)) {
      const a: Comando = actual;
      if (heredoc) {
        a.cuerpo += `\n${linea}`;
        if (linea.trim() === heredoc) heredoc = null;
      } else if (comilla) {
        a.cuerpo += `\n${linea}`;
        comilla = comillaAbierta(linea, comilla);
      } else {
        const l = linea.trim();
        barra = l.endsWith('\\');
        a.cuerpo += ` ${barra ? l.slice(0, -1).trimEnd() : l}`;
        comilla = comillaAbierta(l);
      }
      if (!heredoc && !comilla && !barra) cerrar();
      continue;
    }
    const l = linea.trim();
    if (!l) continue;
    const c = sinPrompt(l);
    if (sesion && !c.conPrompt) continue;
    barra = c.cuerpo.endsWith('\\');
    actual = { conPrompt: c.conPrompt, cuerpo: barra ? c.cuerpo.slice(0, -1).trimEnd() : c.cuerpo };
    heredoc = /<<-?\s*['"]?(\w+)['"]?/.exec(c.cuerpo)?.[1] ?? null;
    comilla = heredoc ? null : comillaAbierta(c.cuerpo);
    if (!heredoc && !comilla && !barra) cerrar();
  }
  cerrar();
  return comandos;
}

/** Los comandos de un texto, sin la marca de prompt. */
export const comandosDe = (texto: string): string[] => leerComandos(texto).map((c) => c.cuerpo);

/**
 * El programa de un comando: sin prompt, sin los prefijos (`sudo -u postgres`, `env`, `time`…), sin variables de
 * entorno (`RUST_LOG=debug`, `http_proxy=…`) y sin ruta (`./x`, `/usr/bin/x`).
 */
export function programaDe(comando: string): string | null {
  const palabras = comando.replace(PROMPT, '').split(/\s+/).filter(Boolean);
  let i = 0;
  let trasPrefijo = false;
  while (i < palabras.length) {
    const p = palabras[i] ?? '';
    if (PREFIJOS.has(p)) {
      trasPrefijo = true;
      i++;
    } else if (/^[A-Za-z_]\w*=/.test(p)) i++;
    else if (trasPrefijo && p.startsWith('-')) i += OPCIONES_CON_VALOR.has(p) ? 2 : 1;
    else break;
  }
  const primera = palabras[i];
  if (!primera) return null;
  return primera.split('/').pop() || null;
}

/** Algo que solo lleva un comando: una opción, una ruta, un operador, una variable, un número, un `.`… */
const pareceArgumento = (t: string) =>
  /^-/.test(t) || /[/=@|&;<>$(){}[\]*~\\]/.test(t) || /\.\w/.test(t) || /^\.+$/.test(t) || /^\d/.test(t);

/** Prosa: sin las comillas ni los huecos, tres palabras o más, alguna de frase y nada con forma de argumento. */
function pareceProsa(cuerpo: string): boolean {
  const limpio = cuerpo.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, ' ').replace(HUECO, ' ');
  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.some(pareceArgumento)) return false;
  const deFrase = palabras.map((p) => p.replace(/[:,.;!?…]+$/, '').toLowerCase());
  return deFrase.filter((p) => /^\p{L}+$/u.test(p)).length >= 3 && deFrase.some((p) => PALABRAS_DE_FRASE.has(p));
}

/** Los huecos de un texto, como se escriben y sin repetir (sin las palabras reservadas de una plantilla de Go). */
export function huecosDe(texto: string): string[] {
  const go = /\{\{\s*(?:\.|range\b|if\b|with\b|template\b|define\b|block\b)/.test(texto);
  return [
    ...new Set(
      [...texto.matchAll(HUECO)]
        .map((m) => m[1] ?? '')
        .filter((n) => !(go && RESERVADAS_GO.has(n)))
        .map((n) => `{{${n}}}`),
    ),
  ];
}

/** El texto con los valores puestos; un hueco sin valor (o vacío) se deja. */
export function rellenar(texto: string, valores: Readonly<Record<string, string>>): string {
  return texto.replace(HUECO, (entero, nombre: string) => valores[`{{${nombre}}}`] || entero);
}

/**
 * Confianza de que sea un comando: hasta tres, cada uno con prompt (0,9) o un programa conocido (0,85), con forma de
 * comando (no prosa: «make sure to…», «go to the store…»; con prompt, la primera palabra parece un programa, no
 * «20 al mes»). Con huecos, algo más.
 */
export function puntuarComando(texto: string): number {
  if (!texto.trim() || texto.length > 2000) return 0;
  const comandos = leerComandos(texto);
  if (!comandos.length || comandos.length > MAX_COMANDOS) return 0;
  for (const { cuerpo, conPrompt } of comandos) {
    const programa = programaDe(cuerpo);
    if (!programa) return 0;
    if (conPrompt ? !/^[a-z0-9_.~-]+$/.test(programa) || /^\d+(?:[.,]\d+)?$/.test(programa) : !PROGRAMAS.has(programa))
      return 0;
    if (programa === 'export' && !/^export\s+[A-Za-z_]\w*=/.test(cuerpo)) return 0;
    if (pareceProsa(cuerpo) || cuerpo.split(/\s+/).length > 40) return 0;
  }
  const base = comandos.every((c) => c.conPrompt) ? 0.9 : 0.85;
  return huecosDe(texto).length ? base + 0.05 : base;
}

export function analizarComando(texto: string): DatosComando {
  const comandos = comandosDe(texto);
  return { comandos, programa: comandos[0] ? programaDe(comandos[0]) : null, huecos: huecosDe(texto) };
}

/** Un trozo del comando: texto tal cual o un hueco (para resaltarlo). */
export type TrozoComando = { t: 'texto' | 'hueco'; v: string };

/** Los trozos de un comando; solo son huecos los de `huecos` (no los `{{end}}` de una plantilla de Go). */
export function trozosComando(comando: string, huecos: readonly string[] = huecosDe(comando)): TrozoComando[] {
  const trozos: TrozoComando[] = [];
  let desde = 0;
  for (const m of comando.matchAll(HUECO)) {
    if (!huecos.includes(`{{${m[1]}}}`)) continue;
    const i = m.index ?? 0;
    if (i > desde) trozos.push({ t: 'texto', v: comando.slice(desde, i) });
    trozos.push({ t: 'hueco', v: m[0] });
    desde = i + m[0].length;
  }
  if (desde < comando.length) trozos.push({ t: 'texto', v: comando.slice(desde) });
  return trozos;
}
