/**
 * Abrir (o crear) un espacio (DAT-06): coordina pestañas, termina escrituras cortadas, crea el manifest si no
 * existe, pone la caché al día con los archivos y deja listo el repositorio. Sin React: todo inyectado.
 */
import { fallo, isoConZona, leerManifest, type Manifest, ok, type Resultado } from '@rimor/formato';
import { CacheEspacio, type EntradaFrontmatter } from '../almacen/cache/cache';
import { type Progreso, reconciliar } from '../almacen/cache/reconciliar';
import { type Almacen, escribirTexto, leerTexto } from '../almacen/contrato';
import { type Canal, type Cerrojos, type Coordinacion, coordinarPestanas } from '../almacen/pestanas';
import { Repositorio } from '../almacen/repositorio';
import { conCambios, type EstadoCuidado, leerEstado, RUTA_ESTADO } from './estado';
import { crearManifest, NOMBRE_ESPACIO_INICIAL, RUTA_MANIFEST } from './manifest';

export interface DependenciasEspacio {
  espacioId: string;
  almacen: Almacen & { limpiarHuerfanos?: () => Promise<number> };
  /** IndexedDB a usar (las pruebas pasan una aislada). */
  fabricaIndexedDb?: IDBFactory;
  cerrojos: Cerrojos;
  canal: Canal;
  reloj?: () => Date;
}

export interface EspacioAbierto {
  manifest: Manifest;
  repositorio: Repositorio;
  cache: CacheEspacio;
  coordinacion: Coordinacion;
  entradas: EntradaFrontmatter[];
  /** Archivos que no se pudieron leer (frontmatter inválido o duplicados). */
  fallidos: { ruta: string; codigo: string }[];
  estado(): EstadoCuidado;
  /** Guarda un cambio del estado de cuidado (persistencia, copia). */
  guardarEstado(cambio: (e: EstadoCuidado) => EstadoCuidado): Promise<void>;
  /** Se llama tras cada cambio del repositorio, con el estado ya actualizado. */
  alCambiar(fn: (e: EstadoCuidado) => void): () => void;
  cerrar(): void;
}

export type FaseApertura = { fase: 'abriendo' } | { fase: 'indexando'; hechos: number; total: number };

export async function abrirEspacio(
  dep: DependenciasEspacio,
  alProgreso: (f: FaseApertura) => void = () => undefined,
): Promise<Resultado<EspacioAbierto>> {
  const reloj = dep.reloj ?? (() => new Date());
  alProgreso({ fase: 'abriendo' });
  const coordinacion = await coordinarPestanas(dep.espacioId, dep.cerrojos, dep.canal);
  const escribe = coordinacion.modo() === 'escritor';
  let cache: CacheEspacio | null = null;
  try {
    if (escribe) await dep.almacen.limpiarHuerfanos?.();
    const textoManifest = await leerTexto(dep.almacen, RUTA_MANIFEST);
    let manifest = textoManifest === null ? null : leerManifest(textoManifest);
    // Un manifest que existe pero no se entiende no se sobrescribe: el espacio podría ser de otra versión.
    if (textoManifest !== null && !manifest) {
      coordinacion.cerrar();
      return fallo('espacio.manifestInvalido');
    }
    if (!manifest) {
      // El id del manifest es un ULID propio; `espacioId` solo nombra la carpeta y la caché del navegador.
      manifest = crearManifest(NOMBRE_ESPACIO_INICIAL, reloj());
      if (escribe) await escribirTexto(dep.almacen, RUTA_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    }

    let estado = leerEstado(await leerTexto(dep.almacen, RUTA_ESTADO));
    const oyentes = new Set<(e: EstadoCuidado) => void>();
    let pendiente = Promise.resolve();
    const guardarEstado = (cambio: (e: EstadoCuidado) => EstadoCuidado) => {
      estado = cambio(estado);
      const copia = estado;
      for (const fn of oyentes) fn(copia);
      // Las escrituras del estado van en orden; solo escribe la pestaña que tiene el cerrojo.
      pendiente = pendiente
        .catch(() => undefined)
        .then(() =>
          coordinacion.modo() === 'escritor'
            ? escribirTexto(dep.almacen, RUTA_ESTADO, `${JSON.stringify(copia, null, 2)}\n`)
            : undefined,
        );
      return pendiente;
    };

    const abierta = await CacheEspacio.abrir(dep.espacioId, dep.fabricaIndexedDb);
    cache = abierta;
    const r = await reconciliar(dep.almacen, abierta, (p: Progreso) => alProgreso({ fase: 'indexando', ...p }));
    const repositorio = new Repositorio(dep.almacen, abierta, {
      alCambiar: () => {
        // Si la escritura falla, el recuento sigue en memoria y se escribe con el siguiente cambio.
        guardarEstado((e) => conCambios(e)).catch(() => undefined);
        coordinacion.avisarCambio([]);
      },
    });
    repositorio.cargarDesde(r.entradas);

    return ok({
      manifest,
      repositorio,
      cache: abierta,
      coordinacion,
      entradas: r.entradas,
      fallidos: r.fallidos,
      estado: () => estado,
      guardarEstado,
      alCambiar: (fn) => {
        oyentes.add(fn);
        return () => oyentes.delete(fn);
      },
      cerrar: () => {
        coordinacion.cerrar();
        abierta.cerrar();
      },
    });
  } catch (e) {
    // Lo que falle después de coger el cerrojo no puede dejarlo cogido.
    coordinacion.cerrar();
    cache?.cerrar();
    throw e;
  }
}

/** Fecha ISO de ahora, con la zona del usuario. */
export const ahoraIso = (reloj: () => Date = () => new Date()) => isoConZona(reloj());
