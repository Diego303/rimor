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
/** Marcas de prompt del terminal delante del comando. */
const PROMPT = /^(?:\$|%|>|❯)\s+/;

export interface DatosComando {
  /** Cada comando, sin la marca de prompt y con sus continuaciones unidas. */
  comandos: string[];
  /** El programa del primero (`cargo`), o `null`. */
  programa: string | null;
  /** Los huecos como se escriben (`{{baseline}}`), en su orden y sin repetir. */
  huecos: string[];
}

/** Los comandos de un texto: las líneas que acaban en `\` se unen a la siguiente. */
export function comandosDe(texto: string): string[] {
  const comandos: string[] = [];
  let actual = '';
  for (const linea of texto.replace(/\r\n?/g, '\n').split('\n')) {
    const l = linea.trim();
    if (!actual && !l) continue;
    const sinBarra = l.endsWith('\\') ? l.slice(0, -1).trimEnd() : l;
    actual = actual ? `${actual} ${sinBarra}` : sinBarra;
    if (!l.endsWith('\\')) {
      comandos.push(actual.trim());
      actual = '';
    }
  }
  if (actual.trim()) comandos.push(actual.trim());
  return comandos.filter(Boolean);
}

/** El programa de un comando: sin prompt, `sudo`, variables de entorno (`RUST_LOG=debug`) ni ruta (`./x`, `/usr/bin/x`). */
export function programaDe(comando: string): string | null {
  const palabras = comando.replace(PROMPT, '').split(/\s+/).filter(Boolean);
  let i = 0;
  while (palabras[i] === 'sudo' || /^[A-Z_][A-Z0-9_]*=/.test(palabras[i] ?? '')) i++;
  const primera = palabras[i];
  if (!primera) return null;
  return primera.split('/').pop() || null;
}

/** Los huecos de un texto, como se escriben y sin repetir. */
export function huecosDe(texto: string): string[] {
  return [...new Set([...texto.matchAll(HUECO)].map((m) => `{{${m[1]}}}`))];
}

/** El texto con los valores puestos; un hueco sin valor (o vacío) se deja. */
export function rellenar(texto: string, valores: Readonly<Record<string, string>>): string {
  return texto.replace(HUECO, (entero, nombre: string) => valores[`{{${nombre}}}`] || entero);
}

/**
 * Confianza de que sea un comando: hasta tres, cada uno con `$ ` (0,9) o un programa conocido (0,85), y con forma
 * de comando (una frase que empieza por «make» y acaba en punto, no). Con huecos, algo más.
 */
export function puntuarComando(texto: string): number {
  if (!texto.trim() || texto.length > 2000) return 0;
  const comandos = comandosDe(texto);
  if (!comandos.length || comandos.length > MAX_COMANDOS) return 0;
  let todosConPrompt = true;
  for (const c of comandos) {
    const conPrompt = PROMPT.test(c);
    todosConPrompt &&= conPrompt;
    const programa = programaDe(c);
    if (!conPrompt && !(programa && PROGRAMAS.has(programa))) return 0;
    const cuerpo = c.replace(PROMPT, '');
    // Prosa: acaba como una frase y no lleva opciones, tuberías ni rutas.
    if (/[.!?…]$/.test(cuerpo) && !/(?:^|\s)-{1,2}\w|[|&;>]|\/|=/.test(cuerpo)) return 0;
    if (cuerpo.split(/\s+/).length > 40) return 0;
  }
  const base = todosConPrompt ? 0.9 : 0.85;
  return huecosDe(texto).length ? base + 0.05 : base;
}

export function analizarComando(texto: string): DatosComando {
  const comandos = comandosDe(texto).map((c) => c.replace(PROMPT, ''));
  return { comandos, programa: comandos[0] ? programaDe(comandos[0]) : null, huecos: huecosDe(texto) };
}

/** Un trozo del comando: texto tal cual o un hueco (para resaltarlo). */
export type TrozoComando = { t: 'texto' | 'hueco'; v: string };

export function trozosComando(comando: string): TrozoComando[] {
  const trozos: TrozoComando[] = [];
  let desde = 0;
  for (const m of comando.matchAll(HUECO)) {
    const i = m.index ?? 0;
    if (i > desde) trozos.push({ t: 'texto', v: comando.slice(desde, i) });
    trozos.push({ t: 'hueco', v: m[0] });
    desde = i + m[0].length;
  }
  if (desde < comando.length) trozos.push({ t: 'texto', v: comando.slice(desde) });
  return trozos;
}
