#!/usr/bin/env node
// Actualiza docs/seguimiento.md: estado de una fila del tablero, cabecera, progreso,
// registro y «Cómo retomar». Los commits de cada fila se rellenan solos desde git.
//
// Uso:
//   node scripts/seguimiento.mjs --id IN-001 --estado "en implementación" \
//     [--doc docs/features/IN-001-repositorio.md] [--ahora "IN-001 · … · fase …"] \
//     [--siguiente "IN-002 · …"] [--registro "implementación · OK"] [--retomar "texto"] \
//     [--global TERMINADO]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const RUTA = new URL('../docs/seguimiento.md', import.meta.url);
const ESTADOS = ['pendiente', 'en análisis y diseño', 'en implementación', 'en verificación', 'hecha', 'bloqueada'];

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  const clave = process.argv[i]?.replace(/^--/, '');
  if (clave) args[clave] = process.argv[i + 1] ?? '';
}

let texto = readFileSync(RUTA, 'utf8');
const lineas = texto.split('\n');

/** Commits cuyo asunto lleva el ID como ámbito, del más antiguo al más reciente. */
function commitsDe(id) {
  const salida = execFileSync('git', ['log', '--reverse', '--format=%h %s'], { encoding: 'utf8' });
  return salida
    .split('\n')
    .filter((l) => l.includes(`(${id})`))
    .map((l) => l.split(' ')[0]);
}

function celdas(linea) {
  return linea.split('|').slice(1, -1).map((c) => c.trim());
}

function fila(c) {
  return `| ${c.join(' | ')} |`;
}

if (args.id) {
  const i = lineas.findIndex((l) => l.startsWith(`| ${args.id} |`));
  if (i < 0) throw new Error(`No existe la fila ${args.id}`);
  const c = celdas(lineas[i]);
  if (args.estado) {
    if (!ESTADOS.includes(args.estado)) throw new Error(`Estado no válido: ${args.estado}`);
    c[4] = args.estado;
  }
  if (args.doc) c[6] = args.doc;
  lineas[i] = fila(c);
}

// Commits de todas las filas, desde git.
for (let i = 0; i < lineas.length; i++) {
  const m = lineas[i].match(/^\| ((?:IN|F0)-\d+) \|/);
  if (!m) continue;
  const c = celdas(lineas[i]);
  const hashes = commitsDe(m[1]);
  c[5] = hashes.length ? hashes.join(' ') : '—';
  lineas[i] = fila(c);
}

// Progreso por versión.
const cuenta = {};
for (const l of lineas) {
  if (!/^\| (?:IN|F0)-\d+ \|/.test(l)) continue;
  const c = celdas(l);
  cuenta[c[2]] ??= { hechas: 0, total: 0 };
  cuenta[c[2]].total++;
  if (c[4] === 'hecha') cuenta[c[2]].hechas++;
}
const v = (k) => `${cuenta[k]?.hechas ?? 0}/${cuenta[k]?.total ?? 0}`;
const total = Object.values(cuenta).reduce((a, x) => ({ h: a.h + x.hechas, t: a.t + x.total }), { h: 0, t: 0 });
const ahora = new Date();
const dos = (n) => String(n).padStart(2, '0');
const marca = `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())} ${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`;

const cabecera = (prefijo, valor) => {
  const i = lineas.findIndex((l) => l.startsWith(prefijo));
  if (i >= 0) lineas[i] = `${prefijo} ${valor}`;
};
cabecera('**Última actualización:**', marca);
cabecera(
  '**Progreso:**',
  `F0 ${v('F0')} · v0.1 ${v('v0.1')} · v0.2 ${v('v0.2')} · v0.3 ${v('v0.3')} · v0.4 ${v('v0.4')} · total ${total.h}/${total.t}`,
);
if (args.ahora) cabecera('**Ahora:**', args.ahora);
if (args.siguiente) cabecera('**Siguiente:**', args.siguiente);
if (args.global) cabecera('**Estado global:**', args.global);

texto = lineas.join('\n');

// Registro: la fila nueva va arriba; el commit se rellena después con el de su orden.
if (args.registro && args.id) {
  const [fase, resultado = ''] = args.registro.split(' · ');
  const nueva = `| ${marca.slice(0, 10)} | ${args.id} | ${fase} | ${resultado} | … |`;
  texto = texto.replace(/(## Registro\n\| Fecha[^\n]*\n\|[-|]+\|\n)/, `$1${nueva}\n`);
}
texto = texto.replace(/(## Registro\n\| Fecha[^\n]*\n\|[-|]+\|\n)([\s\S]*?)(\n## )/, (_, ini, cuerpo, fin) => {
  const filas = cuerpo.split('\n').filter(Boolean);
  const porId = {};
  for (let i = filas.length - 1; i >= 0; i--) {
    const c = celdas(filas[i]);
    porId[c[1]] ??= { hashes: commitsDe(c[1]), n: 0 };
    const h = porId[c[1]].hashes[porId[c[1]].n++];
    if (c[4] === '…' && h) {
      c[4] = h;
      filas[i] = fila(c);
    }
  }
  return `${ini}${filas.map((f) => `${f}\n`).join('')}${fin}`;
});

if (args.retomar !== undefined) {
  texto = texto.replace(/## Cómo retomar\n[\s\S]*$/, `## Cómo retomar\n${args.retomar.trim()}\n`);
}

writeFileSync(RUTA, texto);
