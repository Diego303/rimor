/**
 * Diffs y parches (LEC-09b, IN-042): de `git diff`, `git format-patch`, un diff unificado o Subversion (`Index:`).
 * Archivos con su estado, sus trozos con las líneas numeradas antes y después, y lo añadido y quitado. Los trozos se
 * leen por sus cuentas (`@@ -a,b +c,d @@`): lo que viene detrás (la firma `-- ` de un format-patch) no se cuenta.
 * TS puro.
 */

export type EstadoArchivo = 'modificado' | 'nuevo' | 'borrado' | 'renombrado' | 'binario';

export interface LineaDiff {
  t: 'igual' | 'anadida' | 'quitada';
  v: string;
  /** Número de línea antes (en las iguales y las quitadas). */
  a?: number;
  /** Número de línea después (en las iguales y las añadidas). */
  b?: number;
}

export interface TrozoDiff {
  /** `@@ -12,7 +12,9 @@`. */
  cabecera: string;
  /** Lo que git pone detrás (la función o la sección), si lo hay. */
  contexto?: string;
  lineas: LineaDiff[];
}

export interface ArchivoDiff {
  ruta: string;
  /** La ruta de antes, si se renombró. */
  antes?: string;
  estado: EstadoArchivo;
  anadidas: number;
  quitadas: number;
  trozos: TrozoDiff[];
  /** Si cambió el modo (`100644` → `100755`). */
  modo?: { antes: string; despues: string };
}

export interface DatosDiff {
  archivos: ArchivoDiff[];
  anadidas: number;
  quitadas: number;
  /** El asunto de un `git format-patch` (`Subject: [PATCH] …`), sin el `[PATCH]` y descodificado. */
  asunto?: string;
  /** Los parches de una serie de `format-patch` (uno por `From <hash>`); 1 si no lo es. */
  parches: number;
}

const CABECERA_TROZO = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
/**
 * Cómo empieza un diff (su primera línea con contenido): `git diff`, `diff -ruN`, `git format-patch`, `git show` o
 * `git log -p`, Mercurial, Subversion, un diff unificado o solo trozos.
 */
const PRIMERA_LINEA =
  /^(?:diff --git |diff -[a-zA-Z]+ |From [0-9a-f]{40} |commit [0-9a-f]{7,40}\b|# HG changeset patch|Index: |--- \S|@@ -\d)/;
/** Líneas que un diff puede tener fuera de los trozos (cabeceras de git, de los formatos unificados y de los commits). */
const CABECERA =
  /^(?:diff --git |diff -[a-zA-Z]+ |index [0-9a-f]|--- |\+\+\+ |new file mode|deleted file mode|old mode|new mode|similarity index|dissimilarity index|rename from |rename to |copy from |copy to |Binary files |GIT binary patch|Index: |={10,}|@@ |commit [0-9a-f]{7,40}|Author: |Date: |Merge: |Only in |# )/;
/** Lo que git dice de un archivo sin trozos: un renombrado, un cambio de modo, un archivo vacío o binario. */
const SIN_TROZOS = /^(?:Binary files |GIT binary patch|rename from |old mode |new file mode |deleted file mode )/;

/** El texto sin la valla ```diff que lo envuelva entero (al copiarlo de GitHub o de un chat). */
export function sinValla(texto: string): string {
  const t = texto.replace(/\r\n?/g, '\n');
  const m = /^```(?:diff|patch)?[ \t]*\n([\s\S]*?)\n```\s*$/.exec(t.trim());
  return m?.[1] ?? t;
}

const ESCAPES: Record<string, number> = { n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11, '"': 34, '\\': 92 };

/** Una ruta que git entrecomilla (`"a/a\303\261o.md"`, con `core.quotePath`): sus escapes de C y octales, en UTF-8. */
export function desentrecomillar(x: string): string {
  if (!(x.length > 1 && x.startsWith('"') && x.endsWith('"'))) return x;
  const codificador = new TextEncoder();
  const bytes: number[] = [];
  const s = x.slice(1, -1);
  for (let i = 0; i < s.length; i++) {
    const c = s[i] ?? '';
    if (c !== '\\') {
      bytes.push(...codificador.encode(c));
      continue;
    }
    const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1))?.[0];
    if (oct) {
      bytes.push(Number.parseInt(oct, 8));
      i += oct.length;
    } else {
      const sig = s[i + 1] ?? '';
      bytes.push(ESCAPES[sig] ?? sig.charCodeAt(0));
      i++;
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

/**
 * La ruta de una línea `---`/`+++`: sin la fecha que algunos `diff -u` ponen tras un tabulador, desentrecomillada y
 * sin `a/` ni `b/`. `/dev/null` y los «(nonexistent)» o «(revision 0)» de Subversion, nada.
 */
function rutaDe(x: string): string | undefined {
  const [ruta = '', resto = ''] = x.split('\t');
  const limpia = ruta.trim();
  if (!limpia || limpia === '/dev/null' || /\((?:nonexistent|revision 0)\)/.test(resto)) return undefined;
  return desentrecomillar(limpia).replace(/^[ab]\//, '');
}

/**
 * Las dos rutas de `diff --git a/x b/y`: entrecomilladas, con espacios (se parte por « b/») o sin prefijos
 * (`diff.noprefix`: la línea es la misma ruta dos veces). Las de `---`/`+++`, si vienen, mandan.
 */
function rutasDeGit(linea: string): [string, string] {
  const resto = linea.slice('diff --git '.length);
  const comillas = /^("(?:[^"\\]|\\.)*"|\S+) ("(?:[^"\\]|\\.)*"|\S+)$/.exec(resto);
  if (comillas && (comillas[1]?.startsWith('"') || comillas[2]?.startsWith('"'))) {
    const quitar = (r: string) => desentrecomillar(r).replace(/^[ab]\//, '');
    return [quitar(comillas[1] ?? ''), quitar(comillas[2] ?? '')];
  }
  const corte = resto.lastIndexOf(' b/');
  if (corte >= 0 && resto.startsWith('a/')) return [resto.slice(2, corte), resto.slice(corte + 3)];
  const mitad = (resto.length - 1) / 2;
  if (Number.isInteger(mitad) && resto[mitad] === ' ' && resto.slice(0, mitad) === resto.slice(mitad + 1))
    return [resto.slice(0, mitad), resto.slice(0, mitad)];
  return [resto, resto];
}

/** Las palabras codificadas de una cabecera de correo (RFC 2047: `=?UTF-8?q?A=C3=B1ade?=`), en texto. */
export function descodificarCabecera(s: string): string {
  return s.replace(
    /=\?([^?\s]+)\?([qQbB])\?([^?\s]*)\?=(?:\s+(?==\?))?/g,
    (entera, juego: string, cod: string, datos: string) => {
      try {
        let bytes: number[];
        if (cod.toLowerCase() === 'b') bytes = [...atob(datos)].map((c) => c.charCodeAt(0));
        else {
          const t = datos.replace(/_/g, ' ');
          bytes = [];
          for (let i = 0; i < t.length; i++) {
            const hex = t.slice(i + 1, i + 3);
            if (t[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(hex)) {
              bytes.push(Number.parseInt(hex, 16));
              i += 2;
            } else bytes.push(t.charCodeAt(i));
          }
        }
        return new TextDecoder(juego).decode(new Uint8Array(bytes));
      } catch {
        return entera;
      }
    },
  );
}

/**
 * Confianza de que el texto sea un diff: empieza como uno, tiene algún trozo (o es un parche binario de git) y la
 * mayoría de las líneas desde la primera cabecera son de diff.
 */
export function puntuarDiff(texto: string): number {
  const lineas = sinValla(texto).split('\n');
  const primera = lineas.findIndex((l) => l.trim());
  if (primera < 0 || !PRIMERA_LINEA.test(lineas[primera] ?? '')) return 0;
  const conGit = lineas.some((l) => l.startsWith('diff --git '));
  const conTrozos = lineas.some((l) => CABECERA_TROZO.test(l));
  const conCabeceras =
    lineas.some((l) => /^diff -[a-zA-Z]+ /.test(l)) ||
    (lineas.some((l) => l.startsWith('--- ')) && lineas.some((l) => l.startsWith('+++ ')));
  if (!conTrozos && !(conGit && lineas.some((l) => SIN_TROZOS.test(l)))) return 0;
  const desde = lineas.findIndex((l) => /^(?:diff |--- |@@ |Index: )/.test(l));
  // Las líneas en base85 de un `GIT binary patch` (hasta la línea en blanco) no cuentan.
  const cuerpo: string[] = [];
  let binario = false;
  for (const l of lineas.slice(Math.max(desde, primera))) {
    if (l.startsWith('GIT binary patch')) binario = true;
    else if (binario && !l.trim()) binario = false;
    else if (!binario && l.length) cuerpo.push(l);
  }
  const deDiff = cuerpo.filter((l) => CABECERA.test(l) || /^[ +\-\\]/.test(l)).length;
  if (!cuerpo.length || deDiff / cuerpo.length < 0.6) return 0;
  return conGit || conCabeceras ? 0.95 : 0.8;
}

/** El asunto de un format-patch (puede seguir en las líneas siguientes, sangradas). */
function asuntoDe(lineas: string[]): string | undefined {
  const i = lineas.findIndex((l) => l.startsWith('Subject: '));
  if (i < 0) return undefined;
  let asunto = (lineas[i] ?? '').slice('Subject: '.length);
  for (let j = i + 1; j < lineas.length && /^[ \t]\S/.test(lineas[j] ?? ''); j++) asunto += ` ${lineas[j]?.trim()}`;
  return (
    descodificarCabecera(asunto)
      .replace(/^\[PATCH[^\]]*\]\s*/, '')
      .trim() || undefined
  );
}

export function analizarDiff(texto: string): DatosDiff {
  const lineas = sinValla(texto).split('\n');
  const archivos: ArchivoDiff[] = [];
  let actual: ArchivoDiff | undefined;
  /** El archivo de `diff --git` aún no ha tenido su `---`/`+++`. */
  let deGit = false;
  const nuevo = (ruta: string, antes?: string) => {
    actual = {
      ruta,
      ...(antes && antes !== ruta ? { antes } : {}),
      estado: 'modificado',
      anadidas: 0,
      quitadas: 0,
      trozos: [],
    };
    archivos.push(actual);
  };

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i] ?? '';
    if (l.startsWith('diff --git ')) {
      const [antes, despues] = rutasDeGit(l);
      nuevo(despues, antes);
      deGit = true;
      continue;
    }
    if (l.startsWith('Index: ')) {
      nuevo(l.slice('Index: '.length).trim());
      deGit = true;
      continue;
    }
    if (l.startsWith('--- ') && (lineas[i + 1] ?? '').startsWith('+++ ')) {
      const antes = rutaDe(l.slice(4));
      const despues = rutaDe((lineas[i + 1] ?? '').slice(4));
      if (!actual || !deGit) nuevo(despues ?? antes ?? '', antes);
      const a = actual as ArchivoDiff;
      if (!antes) a.estado = 'nuevo';
      else if (!despues) {
        a.estado = 'borrado';
        a.ruta = antes;
      } else {
        // Las rutas de `---`/`+++` son más fiables que las de `diff --git` (entrecomilladas, sin prefijo…).
        a.ruta = despues;
        if (antes !== despues) a.antes = antes;
        else delete a.antes;
      }
      deGit = false;
      i++;
      continue;
    }
    const trozo = CABECERA_TROZO.exec(l);
    if (trozo) {
      if (!actual) nuevo('');
      const a = actual as ArchivoDiff;
      let viejas = trozo[2] === undefined ? 1 : Number(trozo[2]);
      let nuevas = trozo[4] === undefined ? 1 : Number(trozo[4]);
      let na = Number(trozo[1]);
      let nb = Number(trozo[3]);
      const t: TrozoDiff = { cabecera: l.slice(0, l.indexOf('@@', 2) + 2), lineas: [] };
      if (trozo[5]?.trim()) t.contexto = trozo[5].trim();
      a.trozos.push(t);
      // Las líneas del trozo, hasta agotar sus cuentas (una línea vacía es una igual sin el espacio).
      while ((viejas > 0 || nuevas > 0) && i + 1 < lineas.length) {
        const s = lineas[i + 1] ?? '';
        if (s.startsWith('\\')) {
          i++;
          continue;
        }
        const marca = s[0] ?? ' ';
        if (marca === '+' && nuevas > 0) {
          t.lineas.push({ t: 'anadida', v: s.slice(1), b: nb++ });
          a.anadidas++;
          nuevas--;
        } else if (marca === '-' && viejas > 0) {
          t.lineas.push({ t: 'quitada', v: s.slice(1), a: na++ });
          a.quitadas++;
          viejas--;
        } else if ((marca === ' ' || s === '') && viejas > 0 && nuevas > 0) {
          t.lineas.push({ t: 'igual', v: s.slice(1), a: na++, b: nb++ });
          viejas--;
          nuevas--;
        } else break;
        i++;
      }
      // Lo que queda (`\ No newline…` de la última línea), fuera.
      while ((lineas[i + 1] ?? '').startsWith('\\')) i++;
      continue;
    }
    if (!actual) continue;
    if (l.startsWith('old mode ')) actual.modo = { antes: l.slice('old mode '.length).trim(), despues: '' };
    else if (l.startsWith('new mode ') && actual.modo) actual.modo.despues = l.slice('new mode '.length).trim();
    else if (l.startsWith('new file mode')) actual.estado = 'nuevo';
    else if (l.startsWith('deleted file mode')) actual.estado = 'borrado';
    else if (l.startsWith('rename from ')) {
      actual.antes = l.slice('rename from '.length);
      actual.estado = 'renombrado';
    } else if (l.startsWith('rename to ')) {
      actual.ruta = l.slice('rename to '.length);
      actual.estado = 'renombrado';
    } else if (l.startsWith('Binary files ') || l.startsWith('GIT binary patch')) actual.estado = 'binario';
  }

  const unicos = juntarPorRuta(archivos.filter((a) => a.ruta || a.trozos.length));
  const asunto = asuntoDe(lineas);
  return {
    archivos: unicos,
    anadidas: unicos.reduce((s, a) => s + a.anadidas, 0),
    quitadas: unicos.reduce((s, a) => s + a.quitadas, 0),
    ...(asunto ? { asunto } : {}),
    parches: Math.max(1, lineas.filter((l) => /^From [0-9a-f]{40} /.test(l)).length),
  };
}

/**
 * Un archivo que aparece varias veces (en los parches de una serie) cuenta una vez: sus trozos y sus líneas se
 * suman, con la ruta de antes del primero y el estado del último.
 */
function juntarPorRuta(archivos: ArchivoDiff[]): ArchivoDiff[] {
  const porRuta = new Map<string, ArchivoDiff>();
  for (const a of archivos) {
    const ya = porRuta.get(a.ruta);
    if (!ya) porRuta.set(a.ruta, { ...a, trozos: [...a.trozos] });
    else {
      ya.anadidas += a.anadidas;
      ya.quitadas += a.quitadas;
      ya.trozos.push(...a.trozos);
      ya.estado = a.estado;
      if (a.modo) ya.modo = a.modo;
    }
  }
  return [...porRuta.values()];
}

/** Una fila de la vista lado a lado: lo de antes a la izquierda y lo de después a la derecha. */
export interface FilaLadoALado {
  izquierda?: LineaDiff;
  derecha?: LineaDiff;
}

/**
 * Las filas lado a lado de un trozo: las iguales en las dos columnas; cada tanda de quitadas junto a la de añadidas
 * que la sigue, emparejadas por orden (lo que sobra de una, con la otra columna vacía).
 */
export function filasLadoALado(trozo: TrozoDiff): FilaLadoALado[] {
  const filas: FilaLadoALado[] = [];
  const lineas = trozo.lineas;
  for (let i = 0; i < lineas.length; ) {
    const l = lineas[i] as LineaDiff;
    if (l.t === 'igual') {
      filas.push({ izquierda: l, derecha: l });
      i++;
      continue;
    }
    const quitadas: LineaDiff[] = [];
    const anadidas: LineaDiff[] = [];
    while (lineas[i]?.t === 'quitada') quitadas.push(lineas[i++] as LineaDiff);
    while (lineas[i]?.t === 'anadida') anadidas.push(lineas[i++] as LineaDiff);
    for (let k = 0; k < Math.max(quitadas.length, anadidas.length); k++) {
      const izquierda = quitadas[k];
      const derecha = anadidas[k];
      filas.push({ ...(izquierda ? { izquierda } : {}), ...(derecha ? { derecha } : {}) });
    }
  }
  return filas;
}
