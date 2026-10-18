#!/usr/bin/env node
// Rechaza textos visibles escritos a mano en los componentes: todo texto de interfaz va por i18n (APP-07).
// Uso: node scripts/comprobar-textos.mjs [carpeta]   (por defecto, src/)
// Quedan fuera las pruebas y la página de muestras (solo en desarrollo).
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

/** Atributos y propiedades cuyo valor acaba en pantalla o en el lector de pantalla. */
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
  'accion',
]);
/** Funciones cuyo argumento de texto se muestra (avisos efímeros). */
const LLAMADAS = new Set(['avisar']);
const LETRA = /\p{L}/u;
const ENTIDAD = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi;
const EXCLUIDAS = [['ui', 'muestras'].join(sep)];

/** Textos con letras que una expresión puede producir: literales, ternarias, `??`, `&&`, listas y objetos. */
function textosDe(e, nombrePropiedad) {
  if (!e) return [];
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return LETRA.test(e.text) ? [e.text] : [];
  if (ts.isTemplateExpression(e)) {
    const fijo = [e.head.text, ...e.templateSpans.map((x) => x.literal.text)].join(' ').trim();
    return LETRA.test(fijo) ? [fijo] : [];
  }
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e))
    return textosDe(e.expression);
  if (ts.isConditionalExpression(e)) return [...textosDe(e.whenTrue), ...textosDe(e.whenFalse)];
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    // `cond && 'texto'`: solo se ve la derecha; `a ?? 'b'` y `a || 'b'`: cualquiera; las comparaciones no se ven.
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return textosDe(e.right);
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken)
      return [...textosDe(e.left), ...textosDe(e.right)];
    return [];
  }
  if (ts.isArrayLiteralExpression(e)) return e.elements.flatMap((x) => textosDe(x, nombrePropiedad));
  if (ts.isObjectLiteralExpression(e)) {
    return e.properties.flatMap((p) =>
      ts.isPropertyAssignment(p) && ATRIBUTOS.has(p.name.getText().replace(/['"]/g, '')) ? textosDe(p.initializer) : [],
    );
  }
  return [];
}

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

  const visitar = (nodo) => {
    if (ts.isJsxText(nodo) && LETRA.test(nodo.text.replace(ENTIDAD, ''))) anotar(nodo, nodo.text);
    if (ts.isJsxAttribute(nodo) && nodo.initializer) {
      const nombreAtributo = nodo.name.getText(fuente);
      const ini = nodo.initializer;
      const expresion = ts.isJsxExpression(ini) ? ini.expression : ini;
      // En props de objetos y listas (opciones, columnas) se miran sus propiedades visibles.
      const visible = ATRIBUTOS.has(nombreAtributo) || (nombreAtributo === 'value' && esBoton(nodo));
      const textos = visible
        ? textosDe(expresion)
        : expresion && (ts.isArrayLiteralExpression(expresion) || ts.isObjectLiteralExpression(expresion))
          ? textosDe(expresion)
          : [];
      for (const texto of textos) anotar(nodo, texto);
    }
    if (ts.isJsxExpression(nodo) && nodo.parent && (ts.isJsxElement(nodo.parent) || ts.isJsxFragment(nodo.parent))) {
      for (const texto of textosDe(nodo.expression)) anotar(nodo, texto);
    }
    if (ts.isCallExpression(nodo) && LLAMADAS.has(nodo.expression.getText(fuente).split('.').pop() ?? '')) {
      for (const texto of textosDe(nodo.arguments[0])) anotar(nodo, texto);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(fuente);
  return hallados;
}

/** `<input type="submit|button|reset">`: su `value` es el texto del botón. */
function esBoton(atributo) {
  const elemento = atributo.parent?.parent;
  if (!elemento || !(ts.isJsxSelfClosingElement(elemento) || ts.isJsxOpeningElement(elemento))) return false;
  if (elemento.tagName.getText() !== 'input') return false;
  const tipo = elemento.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === 'type');
  const valor = tipo?.initializer && ts.isStringLiteral(tipo.initializer) ? tipo.initializer.text : '';
  return ['submit', 'button', 'reset'].includes(valor);
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
