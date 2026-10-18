/**
 * Contadores locales (IN-016, MET-06): lo que Rimor ha ahorrado, por día, en `.rimor/contadores.json`. Nunca
 * salen del equipo; viajan con el espacio en el ZIP (IN-035) porque viven en `.rimor/`.
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

/** Lee el archivo; lo que no sea válido se ignora (nunca rompe la apertura). */
export function leerContadores(texto: string | null): DatosContadores {
  const datos: DatosContadores = { esquema: 1, dias: {} };
  if (!texto) return datos;
  try {
    const d = JSON.parse(texto) as { dias?: Record<string, Record<string, unknown>> };
    for (const [dia, valores] of Object.entries(d.dias ?? {})) {
      if (!DIA.test(dia) || typeof valores !== 'object' || valores === null) continue;
      const limpio: Dia = {};
      for (const clave of CLAVES_CONTADOR) {
        const n = valores[clave];
        if (Number.isInteger(n) && (n as number) > 0) limpio[clave] = n as number;
      }
      datos.dias[dia] = limpio;
    }
  } catch {
    // Archivo ilegible: se empieza de cero sin sobrescribirlo hasta el siguiente recuento.
  }
  return datos;
}

export interface Contadores {
  contar(clave: ClaveContador, n?: number): Promise<void>;
  /** Total de una clave desde un día (incluido), o de siempre. */
  total(clave: ClaveContador, desde?: string): number;
  datos(): DatosContadores;
  /** Vuelve a leer el archivo (al pasar a escribir: la otra pestaña pudo contar entre tanto). */
  recargar(): Promise<void>;
}

/** Contadores sobre el almacén del espacio; solo escribe si `escribe()` (la pestaña con el cerrojo). */
export async function abrirContadores(
  almacen: Almacen,
  escribe: () => boolean,
  reloj: () => Date = () => new Date(),
): Promise<Contadores> {
  let datos = leerContadores(await leerTexto(almacen, RUTA_CONTADORES));
  let pendiente = Promise.resolve();
  return {
    contar(clave, n = 1) {
      const dia = isoConZona(reloj()).slice(0, 10);
      const d = datos.dias[dia] ?? {};
      datos.dias[dia] = d;
      d[clave] = (d[clave] ?? 0) + n;
      const texto = `${JSON.stringify(datos, null, 2)}\n`;
      // En orden; un fallo de escritura no rompe nada (el recuento sigue en memoria).
      pendiente = pendiente
        .catch(() => undefined)
        .then(() => (escribe() ? escribirTexto(almacen, RUTA_CONTADORES, texto) : undefined));
      return pendiente.catch(() => undefined);
    },
    total(clave, desde) {
      let suma = 0;
      for (const [dia, valores] of Object.entries(datos.dias)) if (!desde || dia >= desde) suma += valores[clave] ?? 0;
      return suma;
    },
    datos: () => datos,
    async recargar() {
      datos = leerContadores(await leerTexto(almacen, RUTA_CONTADORES));
    },
  };
}
