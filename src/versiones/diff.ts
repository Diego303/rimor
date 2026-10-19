/**
 * Diff por líneas entre dos versiones (CMP-02), con el algoritmo de Myers (O(ND): rápido cuando cambia poco),
 * recortando antes el principio y el final comunes. `aplicar` rehace la nueva a partir de la antigua y el diff
 * (la propiedad que se prueba). TS puro.
 */

export type OpDiff = { t: '='; texto: string } | { t: '+'; texto: string } | { t: '-'; texto: string };

/** Las líneas de un texto (`\r\n` cuenta como `\n`; un salto final no crea una línea vacía de más). */
export function lineasDe(texto: string): string[] {
  if (!texto) return [];
  const lineas = texto.replace(/\r\n?/g, '\n').split('\n');
  if (lineas.at(-1) === '') lineas.pop();
  return lineas;
}

/** El diff de `a` a `b` línea a línea: lo igual, lo quitado de `a` y lo añadido de `b`, en orden. */
export function diffLineas(a: string, b: string): OpDiff[] {
  return diffSecuencias(lineasDe(a), lineasDe(b));
}

/** Myers sobre dos listas de líneas. */
export function diffSecuencias(a: readonly string[], b: readonly string[]): OpDiff[] {
  let inicio = 0;
  while (inicio < a.length && inicio < b.length && a[inicio] === b[inicio]) inicio++;
  let finA = a.length;
  let finB = b.length;
  while (finA > inicio && finB > inicio && a[finA - 1] === b[finB - 1]) {
    finA--;
    finB--;
  }
  const ops: OpDiff[] = [];
  for (let i = 0; i < inicio; i++) ops.push({ t: '=', texto: a[i] ?? '' });
  ops.push(...medio(a.slice(inicio, finA), b.slice(inicio, finB)));
  for (let i = finA; i < a.length; i++) ops.push({ t: '=', texto: a[i] ?? '' });
  return ops;
}

/**
 * Con más cambios que esto, el tramo central va como «quitado todo y añadido todo» (correcto, aunque no el más
 * corto): el rastro de Myers ocupa del orden de D² y no debe crecer sin límite.
 */
export const MAX_CAMBIOS = 2000;

/** El camino más corto de Myers con el rastro de cada paso, y la vuelta atrás para sacar las operaciones. */
function medio(a: readonly string[], b: readonly string[]): OpDiff[] {
  const n = a.length;
  const m = b.length;
  const todoCambia = (): OpDiff[] => [
    ...a.map((texto): OpDiff => ({ t: '-', texto })),
    ...b.map((texto): OpDiff => ({ t: '+', texto })),
  ];
  if (!n || !m) return todoCambia();
  const max = Math.min(n + m, MAX_CAMBIOS);
  const o = max + 1;
  // `v[o + k]`: hasta dónde llega en `a` el camino más largo de la diagonal k con d cambios.
  let v = new Int32Array(2 * max + 3);
  // De cada paso solo se guarda la ventana de diagonales que puede usar la vuelta atrás: [−d−1, d+1].
  const rastro: Int32Array[] = [];
  let pasos = -1;
  for (let d = 0; d <= max && pasos < 0; d++) {
    rastro.push(v.slice(o - d - 1, o + d + 2));
    const nuevo = v.slice();
    for (let k = -d; k <= d; k += 2) {
      const abajo = k === -d || (k !== d && (v[o + k - 1] ?? 0) < (v[o + k + 1] ?? 0));
      let x = abajo ? (v[o + k + 1] ?? 0) : (v[o + k - 1] ?? 0) + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      nuevo[o + k] = x;
      if (x >= n && y >= m) {
        pasos = d;
        break;
      }
    }
    v = nuevo;
  }
  if (pasos < 0) return todoCambia();
  // Vuelta atrás desde (n, m): en cada paso d, la diagonal de la que se vino.
  const ops: OpDiff[] = [];
  let x = n;
  let y = m;
  for (let d = pasos; d > 0; d--) {
    const ventana = rastro[d] ?? new Int32Array(0);
    const en = (k: number) => ventana[k + d + 1] ?? 0;
    const k = x - y;
    const abajo = k === -d || (k !== d && en(k - 1) < en(k + 1));
    const kPrevio = abajo ? k + 1 : k - 1;
    const xPrevio = en(kPrevio);
    const yPrevio = xPrevio - kPrevio;
    while (x > xPrevio && y > yPrevio) {
      x--;
      y--;
      ops.push({ t: '=', texto: a[x] ?? '' });
    }
    if (abajo) {
      y--;
      ops.push({ t: '+', texto: b[y] ?? '' });
    } else {
      x--;
      ops.push({ t: '-', texto: a[x] ?? '' });
    }
  }
  while (x > 0 && y > 0) {
    x--;
    y--;
    ops.push({ t: '=', texto: a[x] ?? '' });
  }
  return ops.reverse();
}

/** Rehace la versión nueva con la antigua y el diff; lanza si el diff no es de esa versión. */
export function aplicar(antigua: readonly string[], diff: readonly OpDiff[]): string[] {
  const nueva: string[] = [];
  let i = 0;
  for (const op of diff) {
    if (op.t === '+') {
      nueva.push(op.texto);
      continue;
    }
    if (antigua[i] !== op.texto) throw new Error(`El diff no es de esta versión (línea ${i + 1})`);
    if (op.t === '=') nueva.push(op.texto);
    i++;
  }
  if (i !== antigua.length) throw new Error('El diff no cubre toda la versión antigua');
  return nueva;
}

/** Cuántas líneas se añaden y se quitan. */
export const recuentoDiff = (diff: readonly OpDiff[]) => ({
  anadidas: diff.filter((o) => o.t === '+').length,
  quitadas: diff.filter((o) => o.t === '-').length,
});

/** Un tramo para pintar: unas operaciones, o las líneas iguales plegadas («… 12 líneas iguales»). */
export type Tramo = { t: 'ops'; ops: OpDiff[] } | { t: 'plegado'; n: number };

/** Pliega las rachas de líneas iguales dejando `contexto` alrededor de cada cambio. */
export function plegar(diff: readonly OpDiff[], contexto = 3): Tramo[] {
  const tramos: Tramo[] = [];
  let i = 0;
  while (i < diff.length) {
    let j = i;
    while (j < diff.length && diff[j]?.t === '=') j++;
    const iguales = j - i;
    const alPrincipio = i === 0;
    const alFinal = j === diff.length;
    const mantener = (alPrincipio ? 0 : contexto) + (alFinal ? 0 : contexto);
    if (iguales > mantener + 1) {
      if (!alPrincipio) tramos.push({ t: 'ops', ops: diff.slice(i, i + contexto) });
      tramos.push({ t: 'plegado', n: iguales - mantener });
      if (!alFinal) tramos.push({ t: 'ops', ops: diff.slice(j - contexto, j) });
    } else if (iguales) tramos.push({ t: 'ops', ops: diff.slice(i, j) });
    let k = j;
    while (k < diff.length && diff[k]?.t !== '=') k++;
    if (k > j) tramos.push({ t: 'ops', ops: diff.slice(j, k) });
    i = k;
  }
  return tramos;
}
