/**
 * DuckDB-WASM en el navegador (IN-044, F0-5): variante `eh` (excepciones WASM) y `mvp` de respaldo, elegida con
 * `selectBundle`; en un solo hilo (GitHub Pages no da COOP/COEP) y en su propio Worker. Se carga con `import()`:
 * nada de esto está en la carga inicial.
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import { deArrow, type MotorSql, marcarMotorListo } from './motor';

export async function crearMotorNavegador(): Promise<MotorSql> {
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
    eh: { mainModule: ehWasm, mainWorker: ehWorker },
  });
  if (!bundle.mainWorker) throw new Error('datos.sinWorker');
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(bundle.mainWorker));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conexion = await db.connect();
  marcarMotorListo();
  return {
    registrar: (nombre, datos) => db.registerFileBuffer(nombre, datos),
    consultar: async (sql) => deArrow(await conexion.query(sql)),
    quitar: async (nombre) => {
      await db.dropFile(nombre);
    },
  };
}
