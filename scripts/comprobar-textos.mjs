#!/usr/bin/env node
// Rechaza textos visibles escritos a mano en los componentes: todo texto de interfaz va por i18n (APP-07).
// Uso: node scripts/comprobar-textos.mjs [carpeta]   (por defecto, src/)
// Quedan fuera las pruebas y la página de muestras (solo en desarrollo).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Atributos cuyo valor acaba en pantalla o en el lector de pantalla. */
const ATRIBUTOS = new Set([
  'aria-label',
  'aria-description',
  'aria-placeholder',
  'aria-roledescription',
  'aria-valuetext',
  'title',
  'placeholder',
  'alt',
  'label',
  'etiqueta',
  'texto',
  'titulo',
  'resumen',
  'frase',
  'explicacion',
]);
const LETRA = /\p{L}/u;
const EXCLUIDAS = [['ui', 'muestras'].join(sep)];

/**
 * Busca textos visibles literales en el código de un componente.
 * @param {string} codigo
 * @param {string} [nombre]
 * @returns {{ linea: number, texto: string }[]}
 */
export function buscarTextos(codigo, nombre = 'x.tsx') {
  const fuente = ts.createSourceFile(nombre, codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hallados = [];
  const anotar = (nodo, texto) =>
    hallados.push({ linea: fuente.getLineAndCharacterOfPosition(nodo.getStart(fuente)).line + 1, texto: texto.trim() });
  const literal = (e) => {
    if (!e) return null;
    if ((ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && LETRA.test(e.text)) return e.text;
    if (ts.isTemplateExpression(e)) {
      const fijo = [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join(' ');
      if (LETRA.test(fijo)) return fijo;
    }
    return null;
  };

  const visitar = (nodo) => {
    if (ts.isJsxText(nodo) && LETRA.test(nodo.text)) anotar(nodo, nodo.text);
    if (ts.isJsxAttribute(nodo) && ATRIBUTOS.has(nodo.name.getText(fuente)) && nodo.initializer) {
      const ini = nodo.initializer;
      const texto = ts.isStringLiteral(ini) ? literal(ini) : ts.isJsxExpression(ini) ? literal(ini.expression) : null;
      if (texto) anotar(nodo, texto);
    }
    if (ts.isJsxExpression(nodo) && nodo.parent && (ts.isJsxElement(nodo.parent) || ts.isJsxFragment(nodo.parent))) {
      const texto = literal(nodo.expression);
      if (texto) anotar(nodo, texto);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallados;
}

function* recorrer(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) yield* recorrer(ruta);
    else if (e.name.endsWith('.tsx') && !e.name.endsWith('.test.tsx')) yield ruta;
  }
}

/** @param {string} carpeta */
export function comprobarCarpeta(carpeta) {
  const hallados = [];
  for (const ruta of recorrer(carpeta)) {
    const rel = relative(carpeta, ruta);
    if (EXCLUIDAS.some((x) => rel.startsWith(x))) continue;
    for (const h of buscarTextos(readFileSync(ruta, 'utf8'), rel)) hallados.push({ archivo: rel, ...h });
  }
  return hallados;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const carpeta = process.argv[2] ?? fileURLToPath(new URL('../src', import.meta.url));
  const hallados = comprobarCarpeta(carpeta);
  for (const h of hallados) console.error(`${h.archivo}:${h.linea}  texto literal «${h.texto}»: usa una clave de i18n`);
  if (hallados.length) {
    console.error(`\n${hallados.length} texto(s) sin traducir.`);
    process.exit(1);
  }
  console.log('Textos: todos por i18n.');
}
