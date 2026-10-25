/**
 * El perfil de unos datos tabulares con DuckDB (IN-044): por columna, su tipo, nulos, únicos (aproximados), mínimo,
 * máximo y media; en las numéricas, un histograma de 20 cubetas, los atípicos (fuera de Q1 − 1,5·IQR y
 * Q3 + 1,5·IQR) y cuántas filas están en el máximo; en las de texto, los 3 valores más repetidos. Y las 5 primeras
 * filas. Por encima de 50 MB, un CSV se perfila por sus primeros 50 MB y un Parquet por sus primeras filas (F0-5).
 * Pocas consultas para todas las columnas a la vez (no tres por columna). TS puro sobre un `MotorSql`.
 */
import { codificacionDe } from '../../captura/firmas';
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
  /** Las filas perfiladas (las de la muestra, si la hay). */
  filas: number;
  columnas: PerfilColumna[];
  vistaPrevia: ResultadoSql;
  /**
   * Si el perfil es de una muestra: sus filas y las del archivo entero (exactas en un Parquet, que las dice en sus
   * metadatos; aproximadas en un CSV, por la proporción de bytes leídos). Los recuentos (nulos, atípicos…) son de
   * la muestra.
   */
  muestra?: { filas: number; total: number; exacto: boolean };
}

/** Por encima de esto, unos datos se perfilan por su principio (F0-5: cargar y perfilar 50 MB, 4,3 s). */
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

const recodificar = (bytes: Uint8Array, desde: string) =>
  new TextEncoder().encode(new TextDecoder(desde).decode(bytes));

/**
 * Lo que DuckDB lee de un CSV: hasta `limite` bytes en UTF-8 (solo lee UTF-8; un CSV de Excel en Windows-1252 o en
 * UTF-16 se convierte) y qué parte del archivo es (1 si entero).
 */
export function muestraCsv(bytes: Uint8Array, limite = LIMITE_PERFIL): { datos: Uint8Array; parte: number } {
  // En UTF-16 un salto de línea es de dos bytes: primero se convierte y luego se corta.
  const inicial = codificacionDe(bytes.subarray(0, 4096), true);
  if (inicial === 'utf-16le' || inicial === 'utf-16be') {
    const utf8 = recodificar(bytes, inicial);
    const datos = principio(utf8, limite);
    return { datos, parte: datos.length / Math.max(utf8.length, 1) };
  }
  const corte = principio(bytes, limite);
  const codificacion = codificacionDe(corte);
  return {
    datos: codificacion === 'windows-1252' ? recodificar(corte, codificacion) : corte,
    parte: corte.length / Math.max(bytes.length, 1),
  };
}

/** La expresión que lee un archivo registrado. */
export function lecturaDe(nombre: string, formato: FormatoDatos): string {
  if (formato === 'parquet') return `read_parquet(${literal(nombre)})`;
  return formato === 'tsv' ? `read_csv_auto(${literal(nombre)}, delim = '\t')` : `read_csv_auto(${literal(nombre)})`;
}

/** Un número finito, o nada (un `Infinity` o un `NaN` no puede ir dentro de una consulta). */
const numero = (x: Valor | undefined): number | undefined =>
  typeof x === 'number' && Number.isFinite(x) ? x : undefined;

/** `{0=12, 3=4}` (un `histogram()` como texto) como cubetas. */
export function cubetasDe(texto: Valor | undefined): number[] {
  const cubetas = new Array<number>(CUBETAS).fill(0);
  for (const [, b, n] of String(texto ?? '').matchAll(/(-?\d+)=(\d+)/g)) {
    const i = Number(b);
    if (i >= 0 && i < CUBETAS) cubetas[i] = Number(n);
  }
  return cubetas;
}

let secuencia = 0;

/** El perfil de unos datos; `limite` es el de la muestra (otro solo en las pruebas). */
export async function perfilar(
  motor: MotorSql,
  bytes: Uint8Array,
  formato: FormatoDatos,
  limite = LIMITE_PERFIL,
): Promise<DatosTabla> {
  const id = `rimor_${Date.now().toString(36)}_${secuencia++}`;
  const archivo = `${id}.${formato === 'parquet' ? 'parquet' : 'csv'}`;
  const { datos, parte } = formato === 'parquet' ? { datos: bytes, parte: 1 } : muestraCsv(bytes, limite);
  // Las cuentas con los bytes, antes de registrarlos (registrar puede llevárselos a otro hilo).
  const tamano = bytes.length;
  await motor.registrar(archivo, datos);
  const tabla = identificador(id);
  try {
    let recorte = '';
    let muestra: DatosTabla['muestra'];
    if (formato === 'parquet' && tamano > limite) {
      // Un Parquet dice cuántas filas tiene sin leerlas; se perfilan las primeras, en proporción a 50 MB.
      const total = numero(
        (await motor.consultar(`SELECT count(*) FROM ${lecturaDe(archivo, formato)}`)).filas[0]?.[0],
      );
      if (total !== undefined) {
        const n = Math.max(1, Math.floor((total * limite) / tamano));
        recorte = ` LIMIT ${n}`;
        muestra = { filas: Math.min(n, total), total, exacto: true };
      }
    }
    await motor.consultar(
      `CREATE OR REPLACE TEMP TABLE ${tabla} AS SELECT * FROM ${lecturaDe(archivo, formato)}${recorte}`,
    );
    const descripcion = await motor.consultar(`DESCRIBE ${tabla}`);
    const iNombre = descripcion.columnas.indexOf('column_name');
    const iTipo = descripcion.columnas.indexOf('column_type');
    const columnas: PerfilColumna[] = descripcion.filas.map((fila) => {
      const tipo = String(fila[iTipo] ?? '');
      return { nombre: String(fila[iNombre] ?? ''), tipo, clase: claseDe(tipo), nulos: 0, unicos: 0 };
    });
    const filas = await perfilarColumnas(motor, tabla, columnas.slice(0, MAX_COLUMNAS_PERFIL));
    if (parte < 1) muestra = { filas, total: Math.round(filas / parte), exacto: false };
    return {
      formato,
      filas,
      columnas,
      vistaPrevia: await vistaPrevia(motor, tabla, columnas),
      ...(muestra ? { muestra } : {}),
    };
  } finally {
    await motor.consultar(`DROP TABLE IF EXISTS ${tabla}`).catch(() => undefined);
    await motor.quitar(archivo).catch(() => undefined);
  }
}

/** Las primeras filas; lo que no es número ni sí o no, como lo escribe DuckDB (fechas, listas, intervalos…). */
function vistaPrevia(motor: MotorSql, tabla: string, columnas: PerfilColumna[]): Promise<ResultadoSql> {
  const lista = columnas.map((c) => {
    const id = identificador(c.nombre);
    return c.clase === 'numero' || c.clase === 'logico' ? id : `${id}::VARCHAR AS ${id}`;
  });
  return motor.consultar(`SELECT ${lista.join(', ') || '*'} FROM ${tabla} LIMIT ${FILAS_VISTA_PREVIA}`);
}

/**
 * Completa el perfil de las columnas (en su sitio) y devuelve las filas de la tabla: una consulta con las medidas
 * de todas, otra con los histogramas y los atípicos de las numéricas, y otra con los más repetidos de las de texto.
 */
async function perfilarColumnas(motor: MotorSql, tabla: string, columnas: PerfilColumna[]): Promise<number> {
  // 1. Nulos, únicos, mínimo y máximo de todas; media y cuartiles de las numéricas. Cada una, en sus posiciones.
  const medidas = ['count(*)'];
  const desde: number[] = [];
  for (const col of columnas) {
    const c = identificador(col.nombre);
    desde.push(medidas.length);
    medidas.push(`count(*) - count(${c})`, `approx_count_distinct(${c})`);
    if (col.clase === 'numero') {
      const v = `${c}::DOUBLE`;
      medidas.push(`min(${v})`, `max(${v})`, `avg(${v})`, `quantile_cont(${v}, 0.25)`, `quantile_cont(${v}, 0.75)`);
    } else medidas.push(`min(${c})::VARCHAR`, `max(${c})::VARCHAR`);
  }
  const fila = (await motor.consultar(`SELECT ${medidas.join(', ')} FROM ${tabla}`)).filas[0] ?? [];
  const filas = numero(fila[0]) ?? 0;
  const cuartiles = new Map<PerfilColumna, [number, number]>();
  for (const [k, col] of columnas.entries()) {
    const i = desde[k] ?? 0;
    col.nulos = numero(fila[i]) ?? 0;
    col.unicos = numero(fila[i + 1]) ?? 0;
    if (col.clase === 'numero') {
      const [min, max, media, q1, q3] = fila.slice(i + 2, i + 7).map(numero);
      if (min === undefined || max === undefined) continue;
      Object.assign(col, { min, max, ...(media !== undefined ? { media } : {}) });
      if (q1 !== undefined && q3 !== undefined) cuartiles.set(col, [q1, q3]);
    } else {
      const [min, max] = [fila[i + 2], fila[i + 3]];
      if (min !== null && min !== undefined) col.min = min;
      if (max !== null && max !== undefined) col.max = max;
    }
  }

  // 2. Histograma (`histogram()` de la cubeta: `width_bucket` no existe en esta versión, F0-5), atípicos y filas en
  // el máximo de las numéricas, en un solo recorrido.
  const numericas = columnas.filter((c) => typeof c.min === 'number' && typeof c.max === 'number');
  const partes: string[] = [];
  const usadas: { col: PerfilColumna; ancho: number; limites?: [number, number] }[] = [];
  for (const col of numericas) {
    const [min, max] = [col.min as number, col.max as number];
    const c = identificador(col.nombre);
    const v = `${c}::DOUBLE`;
    const ancho = (max - min) / CUBETAS;
    const q = cuartiles.get(col);
    const iqr = q ? q[1] - q[0] : undefined;
    const limites: [number, number] | undefined =
      q && iqr !== undefined ? [q[0] - 1.5 * iqr, q[1] + 1.5 * iqr] : undefined;
    const histograma =
      ancho > 0 && Number.isFinite(ancho)
        ? `histogram(least(floor((${v} - ${min}) / ${ancho})::BIGINT, ${CUBETAS - 1}))::VARCHAR`
        : 'NULL';
    const fuera =
      limites && limites.every(Number.isFinite)
        ? `count(*) FILTER (WHERE ${v} < ${limites[0]} OR ${v} > ${limites[1]})`
        : 'NULL';
    partes.push(histograma, fuera, `count(*) FILTER (WHERE ${v} = ${max})`);
    usadas.push({ col, ancho, ...(limites && limites.every(Number.isFinite) ? { limites } : {}) });
  }
  if (partes.length) {
    const r = (await motor.consultar(`SELECT ${partes.join(', ')} FROM ${tabla}`)).filas[0] ?? [];
    for (const [k, { col, ancho, limites }] of usadas.entries()) {
      const enMaximo = numero(r[k * 3 + 2]) ?? 0;
      if (ancho > 0 && Number.isFinite(ancho)) col.histograma = cubetasDe(r[k * 3]);
      else col.histograma = Object.assign(new Array<number>(CUBETAS).fill(0), { 0: filas - col.nulos });
      if (limites) {
        col.atipicos = numero(r[k * 3 + 1]) ?? 0;
        col.enMaximo = enMaximo;
        col.maximoAtipico = (col.max as number) > limites[1];
      }
    }
  }

  // 3. Los 3 más repetidos de cada columna de texto o de sí o no: una consulta con una parte por columna.
  const conFrecuentes = columnas.filter((c) => c.clase === 'texto' || c.clase === 'logico');
  if (conFrecuentes.length) {
    const sql = conFrecuentes
      .map((col, k) => {
        const c = identificador(col.nombre);
        return `(SELECT ${k}, ${c}::VARCHAR, count(*) FROM ${tabla} WHERE ${c} IS NOT NULL GROUP BY 2 ORDER BY 3 DESC, 2 LIMIT 3)`;
      })
      .join(' UNION ALL ');
    for (const col of conFrecuentes) col.frecuentes = [];
    for (const [k, v, n] of (await motor.consultar(sql)).filas)
      conFrecuentes[numero(k) ?? -1]?.frecuentes?.push([String(v), numero(n) ?? 0]);
    // `UNION ALL` no promete el orden de sus partes (DuckDB las lee en paralelo).
    for (const col of conFrecuentes) col.frecuentes?.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  }
  return filas;
}
