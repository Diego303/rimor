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
  /** Las filas del resultado entero, si se pidieron menos (`maxFilas`). */
  total?: number;
}

export interface OpcionesConsulta {
  /** Solo se convierten las primeras: un `SELECT *` de un millón de filas no se convierte entero. */
  maxFilas?: number;
}

/** Una conexión: sus vistas y tablas temporales y sus ajustes de sesión no se ven desde las demás. */
export interface SesionSql {
  consultar(sql: string, opciones?: OpcionesConsulta): Promise<ResultadoSql>;
  cerrar(): Promise<void>;
}

export interface MotorSql {
  /** Registra un archivo con ese nombre, para leerlo con `read_csv_auto('nombre')`. Copia los bytes: no se los queda. */
  registrar(nombre: string, datos: Uint8Array): Promise<void>;
  /** En la conexión de siempre (la del perfil). */
  consultar(sql: string, opciones?: OpcionesConsulta): Promise<ResultadoSql>;
  /** Una conexión aparte (la consulta del usuario: lo que haga en ella no toca al resto). */
  sesion(): Promise<SesionSql>;
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

/** La versión de DuckDB de `@duckdb/duckdb-wasm`: nombra la carpeta de sus extensiones (`public/duckdb/v…`). */
export const VERSION_DUCKDB = 'v1.5.4';

/**
 * El ajuste de cada conexión: las extensiones que DuckDB carga sola (Parquet) salen de esta dirección del propio
 * sitio, nunca de extensions.duckdb.org (nada sale del navegador y funciona sin red).
 */
export const ajusteExtensiones = (repositorio: string) =>
  `SET custom_extension_repository = '${repositorio.replace(/'/g, "''")}'`;

/** Los identificadores de tipo de Arrow (`Type` de apache-arrow) que hay que convertir a mano. */
const TIPO = { binario: 4, decimal: 7, fecha: 8, hora: 9, marca: 10, intervalo: 11, binarioGrande: 19 } as const;

/** Lo que se usa de un campo de Arrow: su nombre y su tipo (con escala, unidad y zona si los tiene). */
export interface CampoArrow {
  name: string;
  type: { typeId: number; scale?: number; unit?: number; timezone?: string | null };
}

/** Lo que se usa de una tabla de Arrow (lo que devuelve DuckDB-WASM). */
export interface TablaArrow {
  schema: { fields: CampoArrow[] };
  numRows: number;
  getChildAt(i: number): { get(fila: number): unknown } | null;
}

const dos = (n: number) => String(n).padStart(2, '0');

/** Un entero sin escala («-150») con su escala (2) como número decimal («-1.5»): exacto si cabe, si no texto. */
export function decimal(sinEscala: string, escala: number): Valor {
  const negativo = sinEscala.startsWith('-');
  const cifras = (negativo ? sinEscala.slice(1) : sinEscala).padStart(escala + 1, '0');
  const entera = cifras.slice(0, cifras.length - escala);
  const fraccion = cifras.slice(cifras.length - escala).replace(/0+$/, '');
  const texto = `${negativo ? '-' : ''}${entera}${fraccion ? `.${fraccion}` : ''}`;
  // Hasta 15 cifras significativas, un `number` lo guarda exacto.
  return entera.replace(/^0+/, '').length + fraccion.length <= 15 ? Number(texto) : texto;
}

/** Milisegundos desde 1970 como `2026-10-17 17:40:00` (con `Z` si la marca lleva zona; sin `.000`). */
function marcaDeTiempo(ms: number, conZona: boolean): string {
  const iso = new Date(ms).toISOString().replace('.000Z', 'Z');
  return conZona ? iso : iso.replace('T', ' ').replace('Z', '');
}

/** Una hora del día en su unidad de Arrow (0 s, 1 ms, 2 µs, 3 ns) como `10:00:00.5`. */
function horaDelDia(valor: number | bigint, unidad: number): string {
  const porSegundo = [1n, 1000n, 1_000_000n, 1_000_000_000n][unidad] ?? 1n;
  const v = BigInt(valor);
  const s = Number(v / porSegundo);
  const resto = v % porSegundo;
  const fraccion = resto
    ? `.${resto
        .toString()
        .padStart(String(porSegundo).length - 1, '0')
        .replace(/0+$/, '')}`
    : '';
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor(s / 60) % 60)}:${dos(s % 60)}${fraccion}`;
}

/** Bytes como los enseña DuckDB: lo imprimible tal cual y lo demás como `\xHH` (los primeros 100). */
function bytesLegibles(b: Uint8Array): string {
  let texto = '';
  for (const x of b.subarray(0, 100))
    texto += x >= 0x20 && x < 0x7f && x !== 0x5c ? String.fromCharCode(x) : `\\x${x.toString(16).toUpperCase()}`;
  return b.length > 100 ? `${texto}…` : texto;
}

/** Un valor de Arrow (o de JavaScript) como `Valor`: `bigint` a número si cabe; lo que no es número, texto. */
export function aValor(x: unknown): Valor {
  if (x === null || x === undefined) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? x : String(x);
  if (typeof x === 'bigint')
    return x <= BigInt(Number.MAX_SAFE_INTEGER) && x >= BigInt(-Number.MAX_SAFE_INTEGER) ? Number(x) : x.toString();
  if (typeof x === 'boolean' || typeof x === 'string') return x;
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x.toISOString();
  if (x instanceof Uint8Array) return bytesLegibles(x);
  return String(x);
}

/**
 * Un valor de una columna según su tipo de Arrow: las fechas y las marcas de tiempo llegan como milisegundos, los
 * decimales sin su escala (1,5 llega como 150) y las horas en su unidad. Lo demás, con `aValor`.
 */
export function valorDeCampo(x: unknown, tipo: CampoArrow['type']): Valor {
  if (x === null || x === undefined) return null;
  switch (tipo.typeId) {
    case TIPO.decimal:
      return decimal(String(x), tipo.scale ?? 0);
    case TIPO.fecha:
      return typeof x === 'number' ? new Date(x).toISOString().slice(0, 10) : aValor(x);
    case TIPO.marca:
      return typeof x === 'number' ? marcaDeTiempo(x, Boolean(tipo.timezone)) : aValor(x);
    case TIPO.hora:
      return typeof x === 'number' || typeof x === 'bigint' ? horaDelDia(x, tipo.unit ?? 0) : aValor(x);
    case TIPO.intervalo:
      // apache-arrow no lee bien los intervalos de DuckDB (mes, día, nanosegundos): mejor nada que un valor falso.
      return null;
    case TIPO.binario:
    case TIPO.binarioGrande:
      return x instanceof Uint8Array ? bytesLegibles(x) : aValor(x);
    default:
      return aValor(x);
  }
}

/**
 * Una tabla de Arrow como `ResultadoSql`, columna a columna por su posición (dos columnas con el mismo nombre son
 * dos) y, con `maxFilas`, solo las primeras.
 */
export function deArrow(tabla: TablaArrow, { maxFilas }: OpcionesConsulta = {}): ResultadoSql {
  const campos = tabla.schema.fields;
  const n = maxFilas === undefined ? tabla.numRows : Math.min(tabla.numRows, maxFilas);
  const vectores = campos.map((_, i) => tabla.getChildAt(i));
  const filas: Valor[][] = [];
  for (let f = 0; f < n; f++) filas.push(campos.map((c, i) => valorDeCampo(vectores[i]?.get(f), c.type)));
  return {
    columnas: campos.map((c) => c.name),
    filas,
    ...(n < tabla.numRows ? { total: tabla.numRows } : {}),
  };
}
