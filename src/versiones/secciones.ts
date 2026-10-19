/**
 * Diff por secciones de un documento Markdown (CMP-02, pantalla «Documento Markdown»): qué secciones se añadieron,
 * se quitaron o cambiaron y qué tareas se marcaron entre dos versiones. Sin el parser de Markdown (que va en el
 * Worker): un divisor por líneas que reconoce encabezados ATX y Setext fuera de los bloques de código y las tareas
 * `- [ ]` / `- [x]`. TS puro.
 */
import { cuerpoDe } from '../lectores/markdown/deteccion';
import { lineasDe } from './diff';

export interface SeccionTexto {
  titulo: string;
  nivel: number;
  /** El texto de la sección (con sus subsecciones), sin espacios de más al final de cada línea. */
  texto: string;
  /** Sus tareas: el texto de cada una y si está hecha. */
  tareas: { texto: string; hecha: boolean }[];
}

// La secuencia de cierre (`## Título ##`) solo cuenta tras un espacio: `## Uso de C#` se queda con su `#`.
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const CERCA = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const TAREA = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.+?)\s*$/;

/** Los encabezados del documento con la línea en que empiezan (sin los de dentro de bloques de código). */
function encabezados(lineas: readonly string[]): { linea: number; nivel: number; titulo: string; fin: number }[] {
  const lista: { linea: number; nivel: number; titulo: string; fin: number }[] = [];
  let cerca: string | null = null;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i] ?? '';
    const c = CERCA.exec(l);
    if (c?.[1]) {
      const marca = c[1];
      if (cerca === null) cerca = marca;
      // Cierra la misma marca, al menos igual de larga y sin nada detrás (un «```js» dentro no cierra).
      else if (marca[0] === cerca[0] && marca.length >= cerca.length && !(c[2] ?? '').trim()) cerca = null;
      continue;
    }
    if (cerca !== null) continue;
    const atx = ATX.exec(l);
    if (atx?.[1]) {
      lista.push({ linea: i, nivel: atx[1].length, titulo: (atx[2] ?? '').trim(), fin: i + 1 });
      continue;
    }
    // Setext: una línea de texto subrayada con === (nivel 1) o --- (nivel 2).
    const siguiente = lineas[i + 1] ?? '';
    const s = SETEXT.exec(siguiente);
    if (s?.[1] && l.trim() && !TAREA.test(l) && !/^\s*[-*+]\s/.test(l) && !/^\s*>/.test(l)) {
      lista.push({ linea: i, nivel: s[1].startsWith('=') ? 1 : 2, titulo: l.trim(), fin: i + 2 });
      i++;
    }
  }
  return lista;
}

/**
 * Las secciones del índice: los encabezados del nivel más alto que hay (sin el título del documento, si es el
 * único de su nivel y va primero), cada una con su texto y sus subsecciones. Lo de antes de la primera, si tiene
 * algo, es una sección sin título.
 */
export function seccionesDe(texto: string): SeccionTexto[] {
  // Sin el frontmatter YAML, como la vista (`title: …` seguido de `---` no es un encabezado).
  const lineas = lineasDe(cuerpoDe(texto).cuerpo).map((l) => l.replace(/[ \t]+$/, ''));
  const todos = encabezados(lineas);
  const primero = todos[0];
  // Como el lector: el primero es el título si hay más y todos los demás son más profundos.
  const conTitulo = Boolean(primero && todos.length > 1 && todos.every((e, i) => i === 0 || e.nivel > primero.nivel));
  const resto = conTitulo ? todos.slice(1) : todos;
  const nivel = Math.min(...resto.map((e) => e.nivel));
  const delIndice = resto.filter((e) => e.nivel === nivel);
  const desde = conTitulo && primero ? primero.fin : 0;
  const cortes = [...delIndice.map((e) => ({ linea: e.linea, titulo: e.titulo, nivel: e.nivel, fin: e.fin }))];
  const secciones: SeccionTexto[] = [];
  const hacer = (titulo: string, niv: number, de: number, a: number) => {
    const cuerpo = lineas.slice(de, a);
    const tareas = cuerpo.flatMap((l) => {
      const m = TAREA.exec(l);
      return m?.[2] ? [{ texto: m[2], hecha: m[1] !== ' ' }] : [];
    });
    secciones.push({ titulo, nivel: niv, texto: cuerpo.join('\n').trim(), tareas });
  };
  const inicioPrimera = cortes[0]?.linea ?? lineas.length;
  if (lineas.slice(desde, inicioPrimera).some((l) => l.trim())) hacer('', 0, desde, inicioPrimera);
  cortes.forEach((c, i) => {
    hacer(c.titulo, c.nivel, c.fin, cortes[i + 1]?.linea ?? lineas.length);
  });
  return secciones;
}

export interface DiffSecciones {
  /** Títulos de las secciones nuevas, en el orden de la nueva. */
  anadidas: string[];
  /** Títulos de las que ya no están, en el orden de la antigua. */
  eliminadas: string[];
  /** Títulos de las que siguen y cambiaron de texto. */
  modificadas: string[];
  /** Tareas que no estaban hechas (o no estaban) y ahora lo están. */
  tareasMarcadas: string[];
}

/**
 * Clave de una sección por su título: sin mayúsculas, sin marcas de formato, sin espacios de más y sin la
 * numeración («2. Cliente»). Con ella la vista casa estas secciones con las de su índice.
 */
export const claveSeccion = (titulo: string) =>
  titulo
    // Un enlace cuenta por su texto, como en el índice del lector: `[API](url)` es «API».
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .toLocaleLowerCase()
    .replace(/^\s*\d+(?:\.\d+)*[.)]?\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** El texto con todas las tareas sin marcar. */
const sinMarcas = (texto: string) => texto.replace(/^(\s*(?:[-*+]|\d+[.)])\s+)\[[xX]\]/gm, '$1[ ]');

export function diffSecciones(antigua: string, nueva: string): DiffSecciones {
  const a = seccionesDe(antigua);
  const b = seccionesDe(nueva);
  const porClave = (lista: SeccionTexto[]) => new Map(lista.map((s) => [claveSeccion(s.titulo), s] as const));
  const ma = porClave(a);
  const mb = porClave(b);
  const anadidas = b.filter((s) => !ma.has(claveSeccion(s.titulo))).map((s) => s.titulo);
  const eliminadas = a.filter((s) => !mb.has(claveSeccion(s.titulo))).map((s) => s.titulo);
  // Marcar una tarea no es modificar su sección: eso se cuenta aparte.
  const modificadas = b
    .filter((s) => {
      const antes = ma.get(claveSeccion(s.titulo));
      return antes !== undefined && sinMarcas(antes.texto) !== sinMarcas(s.texto);
    })
    .map((s) => s.titulo);
  const pendientesAntes = new Set(a.flatMap((s) => s.tareas.filter((t) => !t.hecha).map((t) => t.texto)));
  const tareasMarcadas = [
    ...new Set(b.flatMap((s) => s.tareas.filter((t) => t.hecha && pendientesAntes.has(t.texto)).map((t) => t.texto))),
  ];
  return { anadidas, eliminadas, modificadas, tareasMarcadas };
}
