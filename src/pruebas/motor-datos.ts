/**
 * DuckDB en Node para las pruebas (IN-044): el mismo `@duckdb/duckdb-wasm` que en el navegador (F0-5), con su API
 * síncrona de Node, detrás de la interfaz `MotorSql`. Solo para pruebas. Las extensiones (Parquet) salen de la copia
 * del sitio (`public/duckdb/`), nunca de la red: en Node, DuckDB las busca primero en su caché de `~/.duckdb`.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  ajusteExtensiones,
  deArrow,
  type MotorSql,
  marcarMotorListo,
  type TablaArrow,
  VERSION_DUCKDB,
} from '../lectores/datos/motor';

/** Un repositorio que no existe: si la extensión no estuviera en la caché, la prueba falla en vez de ir a la red. */
const REPOSITORIO = 'https://rimor.invalid/duckdb';

/** La caché de Node (`~/.duckdb/extensions/<penúltima carpeta>/<versión>/<variante>/`) con la copia del sitio. */
function prepararExtensiones(): void {
  for (const variante of ['wasm_eh', 'wasm_mvp']) {
    const origen = join(process.cwd(), 'public/duckdb', VERSION_DUCKDB, variante, 'parquet.duckdb_extension.wasm');
    const carpeta = join(homedir(), '.duckdb/extensions/duckdb', VERSION_DUCKDB, variante);
    const destino = join(carpeta, 'parquet.duckdb_extension.wasm');
    if (existsSync(destino)) continue;
    mkdirSync(carpeta, { recursive: true });
    copyFileSync(origen, destino);
  }
}

export async function crearMotorNode(): Promise<MotorSql> {
  prepararExtensiones();
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
  const conectar = () => {
    const c = db.connect();
    c.query(ajusteExtensiones(REPOSITORIO));
    return c;
  };
  const conexion = conectar();
  marcarMotorListo();
  return {
    registrar: async (nombre, datos) => db.registerFileBuffer(nombre, datos.slice()),
    consultar: async (sql, o) => deArrow(conexion.query(sql) as unknown as TablaArrow, o),
    async sesion() {
      const c = conectar();
      return {
        consultar: async (sql, o) => deArrow(c.query(sql) as unknown as TablaArrow, o),
        cerrar: async () => c.close(),
      };
    },
    quitar: async (nombre) => db.dropFile(nombre),
  };
}
