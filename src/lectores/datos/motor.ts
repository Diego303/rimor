/**
 * El motor SQL de los datos tabulares (IN-044): DuckDB-WASM, cargado la primera vez que se necesita (un trozo aparte,
 * con sus `.wasm` y su Worker como recursos del sitio) y uno por contexto (el hilo principal para la consulta de la
 * vista, el Worker de derivados para el perfil). En las pruebas, el mismo DuckDB en Node (`usarMotor`).
 */

/** Un valor de una celda tal como se enseña o se compara: los enteros grandes que no caben, como texto. */
export type Valor = string | number | boolean | null;

export interface ResultadoSql {
  columnas: string[];
  filas: Valor[][];
}

export interface MotorSql {
  /** Registra un archivo (sus bytes) con ese nombre, para leerlo con `read_csv_auto('nombre')`. */
  registrar(nombre: string, datos: Uint8Array): Promise<void>;
  consultar(sql: string): Promise<ResultadoSql>;
  quitar(nombre: string): Promise<void>;
}

let fabrica: () => Promise<MotorSql> = () => import('./motorNavegador').then((m) => m.crearMotorNavegador());
let motor: Promise<MotorSql> | null = null;

/** El motor de este contexto; la primera vez se instancia (2–4 s, F0-5). Si falla, la siguiente lo vuelve a intentar. */
export function obtenerMotor(): Promise<MotorSql> {
  motor ??= fabrica().catch((e) => {
    motor = null;
    throw e;
  });
  return motor;
}

/** Si el motor de este contexto ya está listo (para decir «DuckDB, solo la primera vez» solo la primera vez). */
let listo = false;
export const motorListo = () => listo;
export function marcarMotorListo(): void {
  listo = true;
}

/** Para las pruebas: otro motor (DuckDB en Node). */
export function usarMotor(f: () => Promise<MotorSql>): void {
  fabrica = f;
  motor = null;
}

/** Un valor de Arrow (o de JavaScript) como `Valor`: `bigint` a número si cabe; fechas a ISO; lo demás, texto. */
export function aValor(x: unknown): Valor {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : String(x);
  if (typeof x === 'bigint')
    return x <= BigInt(Number.MAX_SAFE_INTEGER) && x >= BigInt(-Number.MAX_SAFE_INTEGER) ? Number(x) : x.toString();
  if (typeof x === 'boolean' || typeof x === 'string') return x;
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x.toISOString();
  return String(x);
}

/** Una tabla de Arrow (lo que devuelve DuckDB-WASM) como `ResultadoSql`. */
export function deArrow(tabla: {
  schema: { fields: { name: string }[] };
  toArray(): { toJSON?(): Record<string, unknown> }[];
}): ResultadoSql {
  const columnas = tabla.schema.fields.map((f) => f.name);
  const filas = tabla.toArray().map((fila) => {
    const obj = (fila.toJSON?.() ?? fila) as Record<string, unknown>;
    return columnas.map((c) => aValor(obj[c]));
  });
  return { columnas, filas };
}
