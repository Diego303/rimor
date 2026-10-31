/**
 * Agrupación de plantillas tipo Drain (LEC-04 v0.2, IN-048; He et al., 2017, con los parámetros de Drain3): junta las
 * plantillas que solo se distinguen en campos variables sin forma conocida (un usuario, un host, una ruta) y pone
 * `<*>` donde varían. Un árbol de prefijos: la raíz por nivel y número de palabras, después la primera palabra que no
 * es el nivel (si lleva un marcador o un dígito, por el comodín) y, en la hoja, los grupos; una plantilla entra en el
 * grupo de su hoja que más se le parece si se parece lo bastante. El nivel (`INFO`, `[ERROR]`) no cuenta para
 * parecerse: lo comparten todas las de la raíz. TS puro.
 */

/** El campo variable que pone Drain. */
export const COMODIN = '<*>';

/**
 * Cuántas palabras iniciales (sin contar el nivel) hacen de nodos del árbol. Con una, un campo variable en la segunda
 * palabra («user ana logged in») se encuentra; con dos, como Drain3, nunca.
 */
export const PALABRAS_PREFIJO = 1;
/**
 * Fracción de palabras iguales (sin el nivel) a partir de la que una plantilla entra en un grupo: «user ana logged
 * in» y «user luis logged in» (3 de 4) sí; «failed to open file» y «failed to parse json» (2 de 4) no.
 */
export const UMBRAL_PARECIDO = 0.6;

/** Una palabra que es el nivel (`INFO`, `[ERROR]`, `warn:`): no distingue ni cuenta para parecerse. */
const NIVEL = /^[[(]?(?:TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)[\])]?:?$/i;
/** Hijos por nodo como mucho; los demás van por el comodín. */
export const MAX_HIJOS = 100;

/** Una palabra que puede variar: un marcador (`<N>`, `<ID>`…, `<*>`) o algo con dígitos. */
const VARIABLE = /^<[A-Z*]+>$|\d/;

interface Grupo {
  palabras: string[];
  /** Cuántos comodines tiene (para desempatar). */
  comodines: number;
}

interface Nodo {
  hijos: Map<string, Nodo>;
  grupos: Grupo[];
}

const nodo = (): Nodo => ({ hijos: new Map(), grupos: [] });

/**
 * Una ruta (`/api/items`, `"/index.html`): en un log de peticiones es lo que distingue una plantilla de otra, así que
 * tiene que coincidir (sus partes variables ya llegan normalizadas: `/api/items/<N>`).
 */
const RUTA = /^["'(]?\//;

/**
 * Palabras iguales entre las que cuentan (sin el nivel; los comodines del grupo no cuentan como iguales), entre cuántas
 * cuentan. Con una ruta distinta, 0: no se juntan.
 */
function parecido(grupo: Grupo, palabras: readonly string[], cuentan: readonly number[]): number {
  let iguales = 0;
  for (const i of cuentan) {
    const g = grupo.palabras[i];
    const p = palabras[i] ?? '';
    if (g !== COMODIN && g === p) iguales++;
    else if (g !== COMODIN && (RUTA.test(p) || RUTA.test(g ?? ''))) return 0;
  }
  return cuentan.length ? iguales / cuentan.length : 1;
}

export interface Agrupacion {
  /** El grupo de cada plantilla de entrada (en su orden). */
  grupoDe: number[];
  /** La plantilla de cada grupo, con `<*>` donde varía. */
  plantillas: string[];
}

/**
 * Agrupa `plantillas` (las normalizadas, en el orden en que aparecen en el log), separadas por su `clase` (el nivel:
 * un ERROR y un INFO no se juntan). Determinista: el mismo orden da los mismos grupos.
 */
export function agrupar(plantillas: readonly string[], clase: (i: number) => string = () => ''): Agrupacion {
  const raices = new Map<string, Nodo>();
  const grupos: Grupo[] = [];
  const indice = new Map<Grupo, number>();
  const grupoDe: number[] = [];
  for (const [i, plantilla] of plantillas.entries()) {
    const palabras = plantilla.split(' ').filter(Boolean);
    const clave = `${clase(i)}\u0000${palabras.length}`;
    let actual: Nodo = raices.get(clave) ?? nodo();
    raices.set(clave, actual);
    const cuentan = palabras.flatMap((p, k) => (NIVEL.test(p) ? [] : [k]));
    // Las primeras palabras sin el nivel, como nodos: las variables (y lo que no cabe), por el comodín.
    for (const palabra of cuentan.slice(0, PALABRAS_PREFIJO).map((k) => palabras[k] ?? '')) {
      const k = VARIABLE.test(palabra) ? COMODIN : palabra;
      let siguiente: Nodo | undefined = actual.hijos.get(k);
      if (!siguiente) {
        const lleno = actual.hijos.size >= MAX_HIJOS;
        siguiente = lleno ? (actual.hijos.get(COMODIN) ?? nodo()) : nodo();
        actual.hijos.set(lleno ? COMODIN : k, siguiente);
      }
      actual = siguiente;
    }
    // El grupo más parecido de la hoja (con empate, el de más comodines).
    let mejor: Grupo | null = null;
    let maximo = -1;
    for (const g of actual.grupos) {
      const p = parecido(g, palabras, cuentan);
      if (p > maximo || (p === maximo && mejor && g.comodines > mejor.comodines)) {
        maximo = p;
        mejor = g;
      }
    }
    if (mejor && maximo >= UMBRAL_PARECIDO) {
      // Lo que difiere pasa a ser variable.
      for (let k = 0; k < palabras.length; k++)
        if (mejor.palabras[k] !== palabras[k] && mejor.palabras[k] !== COMODIN) {
          mejor.palabras[k] = COMODIN;
          mejor.comodines++;
        }
    } else {
      mejor = { palabras: [...palabras], comodines: palabras.filter((p) => p === COMODIN).length };
      actual.grupos.push(mejor);
      indice.set(mejor, grupos.length);
      grupos.push(mejor);
    }
    grupoDe.push(indice.get(mejor) ?? 0);
  }
  return { grupoDe, plantillas: grupos.map((g) => g.palabras.join(' ')) };
}
