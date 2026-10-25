/**
 * DuckDB-WASM en el navegador (IN-044, F0-5): variante `eh` (excepciones WASM) y `mvp` de respaldo, elegida con
 * `selectBundle`; en un solo hilo (GitHub Pages no da COOP/COEP) y en su propio Worker. Se carga con `import()`:
 * nada de esto está en la carga inicial. La extensión de Parquet va con el sitio (`public/duckdb/`).
 */
import * as duckdb from '@duckdb/duckdb-wasm';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import mvpWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import mvpWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import { ajusteExtensiones, deArrow, type MotorSql, marcarMotorListo, type TablaArrow } from './motor';

/** Dónde están las extensiones: `<base del sitio>/duckdb` (DuckDB añade `/v1.5.4/wasm_eh/parquet…`). */
const repositorioExtensiones = () =>
  new URL(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/duckdb`, location.href).href;

export async function crearMotorNavegador(): Promise<MotorSql> {
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: mvpWasm, mainWorker: mvpWorker },
    eh: { mainModule: ehWasm, mainWorker: ehWorker },
  });
  if (!bundle.mainWorker) throw new Error('datos.sinWorker');
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(bundle.mainWorker));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const conectar = async () => {
    const c = await db.connect();
    await c.query(ajusteExtensiones(repositorioExtensiones()));
    return c;
  };
  const conexion = await conectar();
  marcarMotorListo();
  return {
    // `registerFileBuffer` se lleva el búfer al Worker (lo deja vacío aquí): va una copia.
    registrar: (nombre, datos) => db.registerFileBuffer(nombre, datos.slice()),
    consultar: async (sql, o) => deArrow((await conexion.query(sql)) as unknown as TablaArrow, o),
    async sesion() {
      const c = await conectar();
      return {
        consultar: async (sql, o) => deArrow((await c.query(sql)) as unknown as TablaArrow, o),
        cerrar: () => c.close(),
      };
    },
    quitar: async (nombre) => {
      await db.dropFile(nombre);
    },
  };
}
