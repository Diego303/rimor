/**
 * Agrupación de plantillas tipo Drain (LEC-04 v0.2, IN-048; idea de He et al., 2017): junta las plantillas que solo se
 * distinguen en campos variables sin forma conocida (un usuario, un host, una cola) y pone `<*>` donde varían. Como
 * Drain, separa por nivel y número de palabras y no generaliza la primera palabra del mensaje si es una palabra
 * corriente; a diferencia de Drain, no junta por parecido (dos mensajes con muchas palabras en común no son el mismo: «cache hit» y «cache miss», «Job
 * <N> started» y «Job <N> finished»), sino en dos pasadas deterministas:
 *
 * 1. **Identificadores**: las palabras con dígitos o `@` (`ana_92`, `worker7`, `ana@x.es`) son variables; las plantillas
 *    que coinciden en todo lo demás se juntan.
 * 2. **Huecos**: una posición en la que las plantillas coinciden en todo lo demás pasa a `<*>` si toma al menos
 *    {@link MIN_VALORES} valores distintos (`Invalid user admin/oracle/test/guest/pi from <IP>`), o si alguna ya la tiene
 *    variable. Nunca la primera palabra del mensaje, el nivel, una ruta ni las claves de un log estructurado; y nunca si
 *    quedaran fijas menos de la mitad de las palabras.
 *
 * El resultado depende solo de qué plantillas hay, no de su orden; y el coste es lineal en las plantillas distintas
 * (por cada palabra de cada una). TS puro.
 */

/** El campo variable que pone Drain. */
export const COMODIN = '<*>';

/** Valores distintos a partir de los que un hueco de palabras corrientes es un campo variable. */
export const MIN_VALORES = 5;
/** Fracción de palabras (sin el nivel) que tienen que quedar fijas al generalizar un hueco. */
export const MIN_FIJAS = 0.5;
/** Las plantillas más largas no pasan por los huecos (cada posición cuesta lo que la plantilla entera). */
export const MAX_PALABRAS_HUECOS = 40;

/** La palabra del nivel (`INFO`, `[ERROR]`, `warn:`): la primera que lo parece no cuenta ni se generaliza. */
const NIVEL = /^[[(]?(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)[\])]?:?$/i;
/** Un marcador de la normalización (`<N>`, `<ID>`…) o el comodín. */
const MARCADOR = /^<[A-Z*]+>$/;
/**
 * Una ruta (`/api/items`, `"/index.html`): en un log de peticiones es lo que distingue una plantilla de otra, así que
 * se compara entera (sus partes variables ya llegan normalizadas: `/api/items/<N>`).
 */
const RUTA = /^["'(]?\//;
/** Las claves de un log estructurado (`{path,status}`): dicen qué es, tienen que coincidir. */
const CLAVES = /^\{[^}]*\}$/;

/** Qué es cada palabra para la agrupación. */
const LIBRE = 0;
const IDENTIFICADOR = 1;
/** El nivel, una ruta o las claves: no se generaliza nunca. */
const FIJA = 2;
const MARCA = 3;

function tipoDe(palabra: string): number {
  if (palabra === COMODIN) return IDENTIFICADOR;
  if (MARCADOR.test(palabra)) return MARCA;
  if (RUTA.test(palabra) || CLAVES.test(palabra)) return FIJA;
  return /[\d@]/.test(palabra) ? IDENTIFICADOR : LIBRE;
}

/** ¿Un identificador (un campo variable seguro)? El comodín, o una palabra con dígitos o `@` (no un marcador). */
export const pareceVariable = (palabra: string): boolean => tipoDe(palabra) === IDENTIFICADOR;

/** Una plantilla partida en palabras, con qué es cada una. */
interface Forma {
  clase: string;
  palabras: string[];
  tipos: number[];
  /** Índice de la palabra del nivel (−1 si no hay). */
  nivel: number;
  /** Índice de la primera palabra del mensaje (−1 si no hay). */
  primera: number;
  /** ¿Tiene algún identificador? (Si no, la pasada 1 no tiene nada que hacer con ella.) */
  conIdentificador: boolean;
  /** Sus palabras con un espacio entre cada dos (mientras no tenga identificadores, que pueden pasar a `<*>`). */
  texto: string;
}

function formaDe(plantilla: string, clase: string): Forma {
  const limpia = !/^ | $| {2}/.test(plantilla);
  const palabras = limpia ? plantilla.split(' ') : plantilla.split(' ').filter(Boolean);
  const tipos: number[] = new Array(palabras.length).fill(LIBRE);
  let nivel = -1;
  let conIdentificador = false;
  for (let k = 0; k < palabras.length; k++) {
    const p = palabras[k] ?? '';
    if (nivel < 0 && NIVEL.test(p)) {
      nivel = k;
      tipos[k] = FIJA;
    } else {
      const t = tipoDe(p);
      tipos[k] = t;
      if (t === IDENTIFICADOR) conIdentificador = true;
    }
  }
  const primera = nivel === 0 ? (palabras.length > 1 ? 1 : -1) : palabras.length ? 0 : -1;
  return { clase, palabras, tipos, nivel, primera, conIdentificador, texto: limpia ? plantilla : palabras.join(' ') };
}

const copia = (f: Forma): Forma => ({ ...f, palabras: [...f.palabras], tipos: [...f.tipos] });

/** La posición `k` pasa a `<*>`. */
function generalizar(f: Forma, k: number): void {
  f.palabras[k] = COMODIN;
  f.tipos[k] = IDENTIFICADOR;
  // Ya tiene uno (y `texto` deja de valer: se vuelve a juntar).
  f.conIdentificador = true;
}

/** Pasada 1: las que coinciden salvo en identificadores, juntas; `<*>` donde difieren. */
function porIdentificadores(formas: readonly Forma[]): { grupoDe: number[]; grupos: Forma[] } {
  const indice = new Map<string, number>();
  const grupos: Forma[] = [];
  const grupoDe = formas.map((f) => {
    const sin = f.conIdentificador
      ? f.palabras.map((p, k) => (f.tipos[k] === IDENTIFICADOR ? COMODIN : p)).join(' ')
      : f.texto;
    const clave = `${f.clase}\u0000${sin}`;
    let g = indice.get(clave);
    const grupo = g === undefined ? undefined : grupos[g];
    if (g === undefined || !grupo) {
      g = grupos.length;
      indice.set(clave, g);
      grupos.push(copia(f));
    } else for (const [k, p] of f.palabras.entries()) if (grupo.palabras[k] !== p) generalizar(grupo, k);
    return g;
  });
  return { grupoDe, grupos };
}

/** Fracción de palabras (sin el nivel) que siguen fijas si la posición `k` pasa a `<*>`. */
function fijasSin(f: Forma, k: number): number {
  let cuentan = 0;
  let fijas = 0;
  for (const [i, p] of f.palabras.entries()) {
    if (i === f.nivel) continue;
    cuentan++;
    if (i !== k && f.tipos[i] !== MARCA && p !== COMODIN) fijas++;
  }
  return cuentan ? fijas / cuentan : 1;
}

/** Mezcla de un hash de 32 bits con un entero (con la multiplicación de Murmur). */
const mezcla = (h: number, x: number) => Math.imul(h ^ x, 0x5bd1e995) ^ (h >>> 15);

/** Una forma en la pasada 2: sus palabras como enteros y el hash de cada prefijo y de cada sufijo. */
interface EnHuecos {
  f: Forma;
  ids: number[];
  prefijo: number[];
  sufijo: number[];
}

/** ¿Puede ser un hueco la posición `k`? Ni la primera palabra, ni el nivel, una ruta, unas claves o un marcador. */
const hueco = (f: Forma, k: number) => k !== f.primera && (f.tipos[k] === LIBRE || f.tipos[k] === IDENTIFICADOR);

/**
 * Pasada 2: los huecos con muchos valores (o ya variables), a `<*>`, hasta que no cambia nada. Modifica `grupos`. Para
 * cada posición `k`, las que coinciden en todo salvo en `k` van al mismo cubo por el hash de lo que hay antes y después
 * de `k` (y se comprueba que de verdad coinciden): lineal en las palabras, no en su cuadrado.
 */
function porHuecos(grupos: Forma[]): void {
  const enteros = new Map<string, number>();
  const entero = (p: string) => {
    let v = enteros.get(p);
    if (v === undefined) {
      v = enteros.size + 1;
      enteros.set(p, v);
    }
    return v;
  };
  const comodin = entero(COMODIN);
  const rehacer = (e: EnHuecos) => {
    const n = e.ids.length;
    if (e.prefijo.length !== n + 1) {
      e.prefijo = new Array(n + 1).fill(0);
      e.sufijo = new Array(n + 1).fill(0);
    }
    e.prefijo[0] = mezcla(entero(e.f.clase), n);
    for (let i = 0; i < n; i++) e.prefijo[i + 1] = mezcla(e.prefijo[i] ?? 0, e.ids[i] ?? 0);
    e.sufijo[n] = mezcla(0x2545f491, n);
    for (let i = n - 1; i >= 0; i--) e.sufijo[i] = mezcla(e.sufijo[i + 1] ?? 0, e.ids[i] ?? 0);
  };
  // Dos solo caen en el mismo cubo si coinciden en todo lo que no puede ser un hueco (su esqueleto: la primera
  // palabra, el nivel, las rutas, las claves y los marcadores): las que no comparten esqueleto con ninguna, fuera. En
  // un log de accesos, con una ruta por plantilla, son todas.
  const posibles: Forma[] = [];
  const suyo: string[] = [];
  const esqueletos = new Map<string, number>();
  for (const f of grupos) {
    if (f.palabras.length > MAX_PALABRAS_HUECOS) continue;
    let clave = `${f.clase}\u0000${f.palabras.length}\u0000`;
    let huecos = 0;
    for (let k = 0; k < f.palabras.length; k++)
      if (hueco(f, k)) huecos++;
      else clave += `${k} ${f.palabras[k]}\u0001`;
    if (!huecos) continue;
    posibles.push(f);
    suyo.push(clave);
    esqueletos.set(clave, (esqueletos.get(clave) ?? 0) + 1);
  }
  const estados: EnHuecos[] = [];
  for (const [i, f] of posibles.entries()) {
    if ((esqueletos.get(suyo[i] ?? '') ?? 0) < 2) continue;
    // Arrays normales: crear cientos de miles de typed arrays pequeños cuesta más que todo lo demás.
    const e: EnHuecos = { f, ids: f.palabras.map(entero), prefijo: [], sufijo: [] };
    rehacer(e);
    estados.push(e);
  }
  /** ¿Coinciden en todo salvo en `k`? (Mismo hash no basta.) */
  const igualesSalvo = (a: EnHuecos, b: EnHuecos, k: number) => {
    if (a.ids.length !== b.ids.length || a.f.clase !== b.f.clase) return false;
    for (let i = 0; i < a.ids.length; i++) if (i !== k && a.ids[i] !== b.ids[i]) return false;
    return true;
  };
  // Con `reduce`: `Math.max(...)` desborda la pila con decenas de miles de plantillas.
  const largo = estados.reduce((m, e) => Math.max(m, e.ids.length), 0);
  const hashes: number[] = new Array(estados.length).fill(-1);
  for (let cambio = true; cambio; ) {
    cambio = false;
    for (let k = 0; k < largo; k++) {
      // Primero cuántas caen en cada hash; los cubos, solo para los que se repiten (casi nunca, si son todas distintas).
      const veces = new Map<number, number>();
      for (let i = 0; i < estados.length; i++) {
        const e = estados[i] as EnHuecos;
        if (k >= e.ids.length || !hueco(e.f, k)) {
          hashes[i] = -1;
          continue;
        }
        // De 30 bits: un entero pequeño es mucho más rápido como clave de un `Map`.
        const h = ((e.prefijo[k] ?? 0) ^ Math.imul(e.sufijo[k + 1] ?? 0, 0x27d4eb2d)) & 0x3fffffff;
        hashes[i] = h;
        veces.set(h, (veces.get(h) ?? 0) + 1);
      }
      const cubos = new Map<number, EnHuecos[][]>();
      for (let i = 0; i < estados.length; i++) {
        const e = estados[i] as EnHuecos;
        const h = hashes[i] ?? -1;
        if (h < 0 || (veces.get(h) ?? 0) < 2) continue;
        const cubo = cubos.get(h);
        const mismo = cubo?.find((c) => igualesSalvo(c[0] as EnHuecos, e, k));
        if (mismo) mismo.push(e);
        else if (cubo) cubo.push([e]);
        else cubos.set(h, [[e]]);
      }
      for (const cubo of cubos.values())
        for (const juntas of cubo) {
          if (juntas.length < 2) continue;
          const valores = new Set(juntas.map((e) => e.ids[k]));
          if (valores.size < 2 || (!valores.has(comodin) && valores.size < MIN_VALORES)) continue;
          if (fijasSin((juntas[0] as EnHuecos).f, k) < MIN_FIJAS) continue;
          for (const e of juntas) {
            if (e.ids[k] === comodin) continue;
            e.ids[k] = comodin;
            generalizar(e.f, k);
            rehacer(e);
          }
          cambio = true;
        }
    }
  }
}

export interface Agrupacion {
  /** El grupo de cada plantilla de entrada (en su orden). */
  grupoDe: number[];
  /** La plantilla de cada grupo, con `<*>` donde varía, en el orden de su primera plantilla en la entrada. */
  plantillas: string[];
}

/**
 * Agrupa `plantillas` (las normalizadas), separadas por su `clase` (el nivel: un ERROR y un INFO no se juntan). Dos
 * grupos de clases distintas que acaban con el mismo texto son uno (como ya lo eran dos plantillas iguales).
 */
export function agrupar(plantillas: readonly string[], clase: (i: number) => string = () => ''): Agrupacion {
  // Las distintas (por clase y texto), partidas en palabras.
  const unicas = new Map<string, Map<string, number>>();
  const distintas: Forma[] = [];
  const deEntrada = plantillas.map((p, i) => {
    const c = clase(i);
    let deClase = unicas.get(c);
    if (!deClase) {
      deClase = new Map();
      unicas.set(c, deClase);
    }
    let k = deClase.get(p);
    if (k === undefined) {
      k = distintas.length;
      deClase.set(p, k);
      distintas.push(formaDe(p, c));
    }
    return k;
  });
  const uno = porIdentificadores(distintas);
  porHuecos(uno.grupos);
  const textos = uno.grupos.map((f) => (f.conIdentificador ? f.palabras.join(' ') : f.texto));
  const indice = new Map<string, number>();
  const salida: string[] = [];
  const grupoDe = deEntrada.map((d) => {
    const texto = textos[uno.grupoDe[d] ?? 0] ?? '';
    let k = indice.get(texto);
    if (k === undefined) {
      k = salida.length;
      indice.set(texto, k);
      salida.push(texto);
    }
    return k;
  });
  return { grupoDe, plantillas: salida };
}

/** Una plantilla con su recuento y su nivel (la de `DatosLog`). */
export interface ConRecuento<N extends string> {
  plantilla: string;
  n: number;
  nivel: N;
}

/**
 * Las plantillas (agrupadas ya por su texto normalizado) pasadas por Drain: cada grupo con la suma de sus líneas, el
 * nivel de su primera plantilla y `<*>` donde varía; y el grupo de cada plantilla de entrada.
 */
export function juntarPlantillas<N extends string>(
  plantillas: readonly ConRecuento<N>[],
): { grupoDe: number[]; plantillas: ConRecuento<N>[] } {
  const { grupoDe, plantillas: textos } = agrupar(
    plantillas.map((p) => p.plantilla),
    (i) => plantillas[i]?.nivel ?? '',
  );
  const grupos: (ConRecuento<N> | undefined)[] = textos.map(() => undefined);
  for (const [i, p] of plantillas.entries()) {
    const g = grupoDe[i] ?? 0;
    const grupo = grupos[g];
    if (grupo) grupo.n += p.n;
    else grupos[g] = { plantilla: textos[g] ?? '', n: p.n, nivel: p.nivel };
  }
  return { grupoDe, plantillas: grupos.filter((g): g is ConRecuento<N> => !!g) };
}
