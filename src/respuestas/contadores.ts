/**
 * Contadores locales (IN-016, MET-06): lo que Rimor ha ahorrado, por día, en `.rimor/contadores.json`. Nunca
 * salen del equipo; viajan con el espacio en el ZIP (IN-035) porque viven en `.rimor/`.
 *
 * Cada recuento lee el archivo, suma y escribe, en orden: así dos pestañas (una que acaba de pasar a escribir,
 * otra que contó antes) nunca se pisan. Lo que cuenta una pestaña que solo lee espera en memoria hasta que pueda.
 */
import { isoConZona } from '@rimor/formato';
import { type Almacen, escribirTexto, leerTexto } from '../almacen/contrato';

export const RUTA_CONTADORES = '.rimor/contadores.json';

export const CLAVES_CONTADOR = [
  'erroresReconocidos',
  'duplicadosEvitados',
  'copiasConValores',
  'busquedasConResultado',
  'correccionesDeTipo',
  'respuestasDescartadas',
] as const;
export type ClaveContador = (typeof CLAVES_CONTADOR)[number];

type Dia = Partial<Record<ClaveContador, number>>;
export interface DatosContadores {
  esquema: 1;
  /** Por día (`AAAA-MM-DD`, en la zona del usuario). */
  dias: Record<string, Dia>;
}

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Lee el archivo; `null` si existe pero no se entiende (no se sobrescribe: se perdería la historia). */
export function leerContadores(texto: string | null): DatosContadores | null {
  const datos: DatosContadores = { esquema: 1, dias: {} };
  if (!texto) return datos;
  let d: { dias?: Record<string, Record<string, unknown>> };
  try {
    d = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof d !== 'object' || d === null) return null;
  for (const [dia, valores] of Object.entries(d.dias ?? {})) {
    if (!DIA.test(dia) || typeof valores !== 'object' || valores === null) continue;
    const limpio: Dia = {};
    for (const clave of CLAVES_CONTADOR) {
      const n = valores[clave];
      if (Number.isInteger(n) && (n as number) > 0) limpio[clave] = n as number;
    }
    datos.dias[dia] = limpio;
  }
  return datos;
}

export interface Contadores {
  contar(clave: ClaveContador, n?: number): Promise<void>;
  /** Total de una clave desde un día (incluido), o de siempre (lo escrito más lo que espera). */
  total(clave: ClaveContador, desde?: string): number;
  datos(): DatosContadores;
  /** Vuelve a leer el archivo y escribe lo que esperaba (al pasar a escribir). */
  recargar(): Promise<void>;
  /** Espera a que se escriba lo pedido (al cerrar). */
  esperar(): Promise<void>;
}

const sumar = (a: DatosContadores, b: Record<string, Dia>) => {
  for (const [dia, valores] of Object.entries(b)) {
    const d = a.dias[dia] ?? {};
    for (const [clave, n] of Object.entries(valores) as [ClaveContador, number][]) d[clave] = (d[clave] ?? 0) + n;
    a.dias[dia] = d;
  }
};

/** Contadores sobre el almacén del espacio; solo escribe si `escribe()` (la pestaña con el cerrojo, al día). */
export async function abrirContadores(
  almacen: Almacen,
  escribe: () => boolean,
  reloj: () => Date = () => new Date(),
): Promise<Contadores> {
  const leer = async () => {
    try {
      return leerContadores(await leerTexto(almacen, RUTA_CONTADORES));
    } catch {
      return null; // Una lectura que falla no rompe la apertura: se reintenta en el siguiente recuento.
    }
  };
  let escritos: DatosContadores = (await leer()) ?? { esquema: 1, dias: {} };
  /** Lo contado que aún no está en el archivo. */
  let pendientes: Record<string, Dia> = {};
  let cola = Promise.resolve();

  /** Lee el archivo, le suma lo pendiente y lo escribe. Si no se puede escribir o leer, lo pendiente espera. */
  const volcar = async () => {
    if (!escribe() || !Object.keys(pendientes).length) return;
    const actual = await leer();
    if (!actual) return;
    const aEscribir = pendientes;
    sumar(actual, aEscribir);
    await escribirTexto(almacen, RUTA_CONTADORES, `${JSON.stringify(actual, null, 2)}\n`);
    escritos = actual;
    if (pendientes === aEscribir) pendientes = {};
  };
  const enCola = (fn: () => Promise<void>) => {
    cola = cola.then(fn).catch(() => undefined);
    return cola;
  };

  return {
    contar(clave, n = 1) {
      const dia = isoConZona(reloj()).slice(0, 10);
      const d = pendientes[dia] ?? {};
      d[clave] = (d[clave] ?? 0) + n;
      pendientes[dia] = d;
      return enCola(volcar);
    },
    total(clave, desde) {
      const todo: DatosContadores = { esquema: 1, dias: structuredClone(escritos.dias) };
      sumar(todo, pendientes);
      let suma = 0;
      for (const [dia, valores] of Object.entries(todo.dias)) if (!desde || dia >= desde) suma += valores[clave] ?? 0;
      return suma;
    },
    datos: () => {
      const todo: DatosContadores = { esquema: 1, dias: structuredClone(escritos.dias) };
      sumar(todo, pendientes);
      return todo;
    },
    recargar: () =>
      enCola(async () => {
        escritos = (await leer()) ?? escritos;
        await volcar();
      }),
    esperar: () => cola,
  };
}
