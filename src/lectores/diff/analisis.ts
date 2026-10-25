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
}

export interface DatosDiff {
  archivos: ArchivoDiff[];
  anadidas: number;
  quitadas: number;
  /** El asunto de un `git format-patch` (`Subject: [PATCH] …`), sin el `[PATCH]`. */
  asunto?: string;
}

const CABECERA_TROZO = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@ ?(.*)$/;
/** Cómo empieza un diff: su primera línea con contenido. */
const PRIMERA_LINEA = /^(?:diff --git |From [0-9a-f]{40} |Index: |--- \S|@@ -\d)/;
/** Líneas que un diff puede tener fuera de los trozos (cabeceras de git y de los formatos unificados). */
const CABECERA =
  /^(?:diff --git |index [0-9a-f]|--- |\+\+\+ |new file mode|deleted file mode|old mode|new mode|similarity index|dissimilarity index|rename from |rename to |copy from |copy to |Binary files |GIT binary patch|Index: |={10,}|@@ )/;

/** Sin `a/` y `b/` ni la fecha que algunos `diff -u` ponen tras un tabulador; `/dev/null`, nada. */
function rutaDe(x: string): string | undefined {
  const sinFecha = x.split('\t')[0]?.trim() ?? '';
  if (!sinFecha || sinFecha === '/dev/null') return undefined;
  return sinFecha.replace(/^[ab]\//, '');
}

/** Las dos rutas de `diff --git a/x b/y` (con espacios en los nombres, se parte por « b/»). */
function rutasDeGit(linea: string): [string, string] {
  const resto = linea.slice('diff --git '.length);
  const corte = resto.lastIndexOf(' b/');
  if (corte < 0) return [resto, resto];
  return [resto.slice(0, corte).replace(/^a\//, ''), resto.slice(corte + 3)];
}

/**
 * Confianza de que el texto sea un diff: empieza como uno, tiene algún trozo (o es un parche binario de git) y la
 * mayoría de las líneas desde la primera cabecera son de diff.
 */
export function puntuarDiff(texto: string): number {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  const primera = lineas.findIndex((l) => l.trim());
  if (primera < 0 || !PRIMERA_LINEA.test(lineas[primera] ?? '')) return 0;
  const conGit = lineas.some((l) => l.startsWith('diff --git '));
  const conTrozos = lineas.some((l) => CABECERA_TROZO.test(l));
  const conCabeceras = lineas.some((l) => l.startsWith('--- ')) && lineas.some((l) => l.startsWith('+++ '));
  if (!conTrozos && !(conGit && lineas.some((l) => l.startsWith('Binary files ')))) return 0;
  const desde = lineas.findIndex((l) => l.startsWith('diff --git ') || l.startsWith('--- ') || l.startsWith('@@ '));
  const cuerpo = lineas.slice(Math.max(desde, primera)).filter((l) => l.length);
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
  return asunto.replace(/^\[PATCH[^\]]*\]\s*/, '').trim() || undefined;
}

export function analizarDiff(texto: string): DatosDiff {
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
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
    if (l.startsWith('new file mode')) actual.estado = 'nuevo';
    else if (l.startsWith('deleted file mode')) actual.estado = 'borrado';
    else if (l.startsWith('rename from ')) {
      actual.antes = l.slice('rename from '.length);
      actual.estado = 'renombrado';
    } else if (l.startsWith('rename to ')) {
      actual.ruta = l.slice('rename to '.length);
      actual.estado = 'renombrado';
    } else if (l.startsWith('Binary files ') || l.startsWith('GIT binary patch')) actual.estado = 'binario';
  }

  const conContenido = archivos.filter((a) => a.ruta || a.trozos.length);
  const asunto = asuntoDe(lineas);
  return {
    archivos: conContenido,
    anadidas: conContenido.reduce((s, a) => s + a.anadidas, 0),
    quitadas: conContenido.reduce((s, a) => s + a.quitadas, 0),
    ...(asunto ? { asunto } : {}),
  };
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
