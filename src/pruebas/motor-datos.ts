/**
 * DuckDB en Node para las pruebas (IN-044): el mismo `@duckdb/duckdb-wasm` que en el navegador (F0-5), con su API
 * síncrona de Node, detrás de la interfaz `MotorSql`. Solo para pruebas.
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { deArrow, type MotorSql, marcarMotorListo } from '../lectores/datos/motor';

export async function crearMotorNode(): Promise<MotorSql> {
  const requerir = createRequire(import.meta.url);
  const duckdb = requerir('@duckdb/duckdb-wasm/blocking') as typeof import('@duckdb/duckdb-wasm/blocking');
  const dist = dirname(requerir.resolve('@duckdb/duckdb-wasm/dist/duckdb-node-blocking.cjs'));
  const db = await duckdb.createDuckDB(
    {
      mvp: { mainModule: join(dist, 'duckdb-mvp.wasm'), mainWorker: join(dist, 'duckdb-node-mvp.worker.cjs') },
      eh: { mainModule: join(dist, 'duckdb-eh.wasm'), mainWorker: join(dist, 'duckdb-node-eh.worker.cjs') },
    },
    new duckdb.VoidLogger(),
    duckdb.NODE_RUNTIME,
  );
  await db.instantiate();
  const conexion = db.connect();
  marcarMotorListo();
  return {
    registrar: async (nombre, datos) => db.registerFileBuffer(nombre, datos),
    consultar: async (sql) => deArrow(conexion.query(sql) as never),
    quitar: async (nombre) => db.dropFile(nombre),
  };
}
