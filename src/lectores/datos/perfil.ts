/**
 * El perfil de unos datos tabulares con DuckDB (IN-044): por columna, su tipo, nulos, únicos (aproximados), mínimo,
 * máximo y media; en las numéricas, un histograma de 20 cubetas, los atípicos (fuera de Q1 − 1,5·IQR y
 * Q3 + 1,5·IQR) y cuántas filas están en el máximo; en las de texto, los 3 valores más repetidos. Y las 5 primeras
 * filas. Por encima de 50 MB, un CSV se perfila por sus primeros 50 MB (F0-5). TS puro sobre un `MotorSql`.
 */
import type { MotorSql, ResultadoSql, Valor } from './motor';

export type FormatoDatos = 'csv' | 'tsv' | 'parquet';
export type ClaseColumna = 'numero' | 'texto' | 'fecha' | 'logico' | 'otro';

export interface PerfilColumna {
  nombre: string;
  /** El tipo de DuckDB (`BIGINT`, `VARCHAR`, `TIMESTAMP WITH TIME ZONE`…). */
  tipo: string;
  clase: ClaseColumna;
  nulos: number;
  /** Aproximados (HyperLogLog). */
  unicos: number;
  min?: Valor;
  max?: Valor;
  media?: number;
  /** 20 cubetas de mínimo a máximo (numéricas). */
  histograma?: number[];
  atipicos?: number;
  /** Filas en el máximo (numéricas). */
  enMaximo?: number;
  /** Si el máximo es atípico (está por encima de Q3 + 1,5·IQR). */
  maximoAtipico?: boolean;
  /** Los 3 valores más repetidos con su recuento (texto). */
  frecuentes?: [string, number][];
}

export interface DatosTabla {
  formato: FormatoDatos;
  filas: number;
  columnas: PerfilColumna[];
  vistaPrevia: ResultadoSql;
  /** Si el perfil es de una muestra: sus filas y las del archivo entero (aproximadas). */
  muestra?: { filas: number; aproximadas: number };
}

/** Por encima de esto, un CSV se perfila por su principio (F0-5: cargar y perfilar 50 MB, 4,3 s). */
export const LIMITE_PERFIL = 50 * 1024 * 1024;
/** Cubetas del histograma. */
export const CUBETAS = 20;
/** Las columnas que se perfilan como mucho (las demás salen con su tipo y nada más). */
export const MAX_COLUMNAS_PERFIL = 100;
/** Filas de la vista previa. */
export const FILAS_VISTA_PREVIA = 5;

const NUMERICOS =
  /^(?:TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|UTINYINT|USMALLINT|UINTEGER|UBIGINT|UHUGEINT|FLOAT|DOUBLE|REAL|DECIMAL)/;

export function claseDe(tipo: string): ClaseColumna {
  const t = tipo.toUpperCase();
  if (NUMERICOS.test(t)) return 'numero';
  if (t === 'VARCHAR' || t.startsWith('VARCHAR')) return 'texto';
  if (/^(?:DATE|TIME|TIMESTAMP)/.test(t)) return 'fecha';
  if (t === 'BOOLEAN') return 'logico';
  return 'otro';
}

/** Un identificador de SQL entre comillas dobles (las de dentro, dobladas). */
export const identificador = (nombre: string) => `"${nombre.replace(/"/g, '""')}"`;
/** Un texto de SQL entre comillas simples. */
export const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Los primeros `limite` bytes, cortados tras el último salto de línea (para no partir una fila). */
export function principio(bytes: Uint8Array, limite: number): Uint8Array {
  if (bytes.length <= limite) return bytes;
  const corte = bytes.lastIndexOf(0x0a, limite - 1);
  return bytes.subarray(0, corte > 0 ? corte + 1 : limite);
}

/** La expresión que lee un archivo registrado. */
export function lecturaDe(nombre: string, formato: FormatoDatos): string {
  if (formato === 'parquet') return `read_parquet(${literal(nombre)})`;
  return formato === 'tsv' ? `read_csv_auto(${literal(nombre)}, delim = '\t')` : `read_csv_auto(${literal(nombre)})`;
}

const numero = (x: Valor | undefined): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;

let secuencia = 0;

export async function perfilar(motor: MotorSql, bytes: Uint8Array, formato: FormatoDatos): Promise<DatosTabla> {
  const id = `rimor_${Date.now().toString(36)}_${secuencia++}`;
  const archivo = `${id}.${formato === 'parquet' ? 'parquet' : 'csv'}`;
  const datos = formato === 'parquet' ? bytes : principio(bytes, LIMITE_PERFIL);
  await motor.registrar(archivo, datos);
  const tabla = identificador(id);
  try {
    await motor.consultar(`CREATE OR REPLACE TEMP TABLE ${tabla} AS SELECT * FROM ${lecturaDe(archivo, formato)}`);
    const filas = numero((await motor.consultar(`SELECT count(*) FROM ${tabla}`)).filas[0]?.[0]) ?? 0;
    const descripcion = await motor.consultar(`DESCRIBE ${tabla}`);
    const iNombre = descripcion.columnas.indexOf('column_name');
    const iTipo = descripcion.columnas.indexOf('column_type');
    const columnas: PerfilColumna[] = [];
    for (const [k, fila] of descripcion.filas.entries()) {
      const nombre = String(fila[iNombre] ?? '');
      const tipo = String(fila[iTipo] ?? '');
      const clase = claseDe(tipo);
      columnas.push(
        k < MAX_COLUMNAS_PERFIL
          ? await perfilColumna(motor, tabla, nombre, tipo, clase)
          : { nombre, tipo, clase, nulos: 0, unicos: 0 },
      );
    }
    const vistaPrevia = await motor.consultar(`SELECT * FROM ${tabla} LIMIT ${FILAS_VISTA_PREVIA}`);
    return {
      formato,
      filas,
      columnas,
      vistaPrevia,
      ...(datos.length < bytes.length
        ? { muestra: { filas, aproximadas: Math.round((filas * bytes.length) / datos.length) } }
        : {}),
    };
  } finally {
    await motor.consultar(`DROP TABLE IF EXISTS ${tabla}`).catch(() => undefined);
    await motor.quitar(archivo).catch(() => undefined);
  }
}

async function perfilColumna(
  motor: MotorSql,
  tabla: string,
  nombre: string,
  tipo: string,
  clase: ClaseColumna,
): Promise<PerfilColumna> {
  const c = identificador(nombre);
  if (clase === 'numero') {
    const v = `${c}::DOUBLE`;
    const r =
      (
        await motor.consultar(
          `SELECT count(*) - count(${c}), approx_count_distinct(${c}), min(${v}), max(${v}), avg(${v}), quantile_cont(${v}, 0.25), quantile_cont(${v}, 0.75), count(${c}) FROM ${tabla}`,
        )
      ).filas[0] ?? [];
    const [nulos, unicos, min, max, media, q1, q3, conValor] = r.map((x) => numero(x));
    const perfil: PerfilColumna = { nombre, tipo, clase, nulos: nulos ?? 0, unicos: unicos ?? 0 };
    if (min === undefined || max === undefined) return perfil;
    Object.assign(perfil, { min, max, ...(media !== undefined ? { media } : {}) });
    // Histograma: `width_bucket` no existe en esta versión (F0-5).
    const histograma = new Array<number>(CUBETAS).fill(0);
    if (max > min) {
      const ancho = (max - min) / CUBETAS;
      const cubetas = await motor.consultar(
        // Por posición (`GROUP BY 1`): un alias como `b` chocaría con una columna que se llame así.
        `SELECT least(floor((${v} - ${min}) / ${ancho})::BIGINT, ${CUBETAS - 1}), count(*) FROM ${tabla} WHERE ${c} IS NOT NULL GROUP BY 1`,
      );
      for (const [b, n] of cubetas.filas) {
        const i = numero(b);
        if (i !== undefined && i >= 0 && i < CUBETAS) histograma[i] = numero(n) ?? 0;
      }
    } else histograma[0] = conValor ?? 0;
    perfil.histograma = histograma;
    if (q1 !== undefined && q3 !== undefined) {
      const iqr = q3 - q1;
      const bajo = q1 - 1.5 * iqr;
      const alto = q3 + 1.5 * iqr;
      const f = (
        await motor.consultar(
          `SELECT count(*) FILTER (WHERE ${v} < ${bajo} OR ${v} > ${alto}), count(*) FILTER (WHERE ${v} = ${max}) FROM ${tabla}`,
        )
      ).filas[0];
      perfil.atipicos = numero(f?.[0]) ?? 0;
      perfil.enMaximo = numero(f?.[1]) ?? 0;
      perfil.maximoAtipico = max > alto;
    }
    return perfil;
  }
  const r =
    (
      await motor.consultar(
        `SELECT count(*) - count(${c}), approx_count_distinct(${c}), min(${c})::VARCHAR, max(${c})::VARCHAR FROM ${tabla}`,
      )
    ).filas[0] ?? [];
  const perfil: PerfilColumna = {
    nombre,
    tipo,
    clase,
    nulos: numero(r[0]) ?? 0,
    unicos: numero(r[1]) ?? 0,
    ...(r[2] !== null && r[2] !== undefined ? { min: r[2] } : {}),
    ...(r[3] !== null && r[3] !== undefined ? { max: r[3] } : {}),
  };
  if (clase === 'texto' || clase === 'logico') {
    const top = await motor.consultar(
      `SELECT ${c}::VARCHAR, count(*) FROM ${tabla} WHERE ${c} IS NOT NULL GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 3`,
    );
    perfil.frecuentes = top.filas.map(([v, n]) => [String(v), numero(n) ?? 0]);
  }
  return perfil;
}
