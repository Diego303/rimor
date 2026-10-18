/** ULID (https://github.com/ulid/spec): 48 bits de tiempo y 80 de azar en Crockford base 32, monotónico. */

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const LARGO_TIEMPO = 10;
const LARGO_AZAR = 16;
const TIEMPO_MAX = 2 ** 48 - 1;

export type Ulid = string;

/** Fuente de azar: devuelve un entero en [0, 32). */
export type Azar = () => number;

const azarPorDefecto: Azar = () => {
  const c = (globalThis as { crypto?: { getRandomValues<T extends ArrayBufferView>(a: T): T } }).crypto;
  if (c) return (c.getRandomValues(new Uint8Array(1))[0] ?? 0) & 31;
  return Math.floor(Math.random() * 32);
};

function codificarTiempo(ms: number): string {
  let t = ms;
  let s = '';
  for (let i = 0; i < LARGO_TIEMPO; i++) {
    s = ALFABETO[t % 32] + s;
    t = Math.floor(t / 32);
  }
  return s;
}

/** Suma 1 a una cadena base 32, como un contador; `null` si desborda. */
function incrementar(azar: string): string | null {
  const c = azar.split('');
  for (let i = c.length - 1; i >= 0; i--) {
    const v = ALFABETO.indexOf(c[i] ?? '0');
    if (v < 31) {
      c[i] = ALFABETO[v + 1] ?? '0';
      return c.join('');
    }
    c[i] = '0';
  }
  return null;
}

/**
 * Crea un generador de ULID monotónico: dentro del mismo milisegundo (o si el reloj retrocede),
 * el siguiente ULID incrementa el azar del anterior, así que siempre son crecientes.
 */
export function crearGeneradorUlid(reloj: () => number = Date.now, azar: Azar = azarPorDefecto): () => Ulid {
  let ultimoTiempo = -1;
  let ultimoAzar = '';
  return () => {
    const ahora = Math.min(Math.max(0, Math.floor(reloj())), TIEMPO_MAX);
    if (ahora <= ultimoTiempo) {
      const siguiente = incrementar(ultimoAzar);
      if (siguiente) {
        ultimoAzar = siguiente;
        return codificarTiempo(ultimoTiempo) + ultimoAzar;
      }
      ultimoTiempo++;
    } else {
      ultimoTiempo = ahora;
    }
    ultimoAzar = Array.from({ length: LARGO_AZAR }, () => ALFABETO[azar() & 31]).join('');
    return codificarTiempo(ultimoTiempo) + ultimoAzar;
  };
}

/** Generador compartido de la app. */
export const ulid = crearGeneradorUlid();

export const esUlid = (x: string): boolean => /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(x);

/** Milisegundos codificados en un ULID. */
export function tiempoDeUlid(id: Ulid): number {
  let t = 0;
  for (const ch of id.slice(0, LARGO_TIEMPO)) t = t * 32 + ALFABETO.indexOf(ch);
  return t;
}
