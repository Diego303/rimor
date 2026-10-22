/**
 * Exportar desde la app (IN-035): genera el ZIP o el JSON en el Worker de exportación (o, sin él, en este hilo
 * con el almacén del espacio), lo descarga y, si es una copia completa, la apunta en el estado de cuidado (el
 * piloto del raíl pasa a verde). Una exportación a la vez; su progreso, en `useExportacion`.
 */
import type { Manifest } from '@rimor/formato';
import { proxy, wrap } from 'comlink';
import { create } from 'zustand';
import type { Almacen } from '../almacen/contrato';
import { ahoraIso } from '../espacio/abrir';
import { conCopia, type EstadoCuidado } from '../espacio/estado';
import { descargarBlob } from '../lectores/descargar';
import type { ApiExportar } from '../workers/exportar.worker';
import type { ProgresoExportacion } from './exportar';

/** El módulo que exporta (con fflate), cargado al exportar: no pesa en la carga inicial. */
const cargarExportar = () => import('./exportar');

export type TipoExportacion = 'zip' | 'json';

export interface EstadoExportacion {
  /** La que está en marcha, o `null`. */
  tipo: TipoExportacion | null;
  /** De 0 a 100. */
  porcentaje: number;
}

export const useExportacion = create<EstadoExportacion>(() => ({ tipo: null, porcentaje: 0 }));

/** Lo que la exportación necesita del espacio abierto. */
export interface EspacioExportable {
  id: string;
  almacen: Almacen;
  enMemoria?: boolean;
  manifest: Manifest;
  esperarEscrituras(): Promise<void>;
  guardarEstado(cambio: (e: EstadoCuidado) => EstadoCuidado): Promise<void>;
}

export interface Exportado {
  nombre: string;
  bytes: number;
  /** Adjuntos que no caben en el JSON: si hay alguno, no es una copia completa. */
  excluidos: string[];
  /** Cuenta como copia (se apunta y el piloto pasa a verde). */
  completa: boolean;
}

interface Generado {
  blob: Blob;
  excluidos: string[];
}

type Opciones = { ahora: Date; version: string; alProgreso: (p: ProgresoExportacion) => void };

async function enHilo(almacen: Almacen, tipo: TipoExportacion, o: Opciones): Promise<Generado> {
  const { exportarJson, exportarZip } = await cargarExportar();
  if (tipo === 'zip') {
    const { trozos } = await exportarZip(almacen, o);
    return { blob: new Blob(trozos as Uint8Array<ArrayBuffer>[], { type: 'application/zip' }), excluidos: [] };
  }
  const { texto, excluidos } = await exportarJson(almacen, o);
  return { blob: new Blob([texto], { type: 'application/json' }), excluidos };
}

/** En el Worker; si no carga, se rechaza (y se hace en el hilo). */
function enWorker(espacio: string, tipo: TipoExportacion, o: Opciones): Promise<Generado> {
  const worker = new Worker(new URL('../workers/exportar.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Generado>((resolver, rechazar) => {
    worker.addEventListener('error', () => rechazar(new Error('exportar.workerNoCarga')));
    wrap<ApiExportar>(worker)
      .exportar(espacio, tipo, { ahora: o.ahora, version: o.version }, proxy(o.alProgreso))
      .then(({ blob, excluidos }) => resolver({ blob, excluidos }), rechazar);
  }).finally(() => worker.terminate());
}

/**
 * Exporta, descarga y, si la copia es completa, la apunta. `null` si ya había una en marcha. Lanza si falla (y
 * entonces no se apunta nada). `motivo` va en el nombre (la copia previa a algo destructivo).
 */
export async function exportarEspacio(
  espacio: EspacioExportable,
  tipo: TipoExportacion,
  { motivo, reloj = () => new Date() }: { motivo?: string; reloj?: () => Date } = {},
): Promise<Exportado | null> {
  if (useExportacion.getState().tipo) return null;
  useExportacion.setState({ tipo, porcentaje: 0 });
  try {
    await espacio.esperarEscrituras();
    const ahora = reloj();
    const o: Opciones = {
      ahora,
      version: __VERSION_APP__,
      alProgreso: ({ hechos, total }) =>
        useExportacion.setState({ porcentaje: total ? Math.floor((hechos / total) * 100) : 100 }),
    };
    let generado: Generado;
    if (!espacio.enMemoria && typeof Worker === 'function') {
      try {
        generado = await enWorker(espacio.id, tipo, o);
      } catch {
        // El Worker no carga (o falló dentro): lo mismo en este hilo.
        generado = await enHilo(espacio.almacen, tipo, o);
      }
    } else generado = await enHilo(espacio.almacen, tipo, o);
    const nombre = (await cargarExportar()).nombreExportacion(espacio.manifest.espacio.nombre, ahora, tipo, motivo);
    descargarBlob(generado.blob, nombre);
    const completa = generado.excluidos.length === 0;
    if (completa) await espacio.guardarEstado((e) => conCopia(e, ahoraIso(reloj)));
    return { nombre, bytes: generado.blob.size, excluidos: generado.excluidos, completa };
  } finally {
    useExportacion.setState({ tipo: null, porcentaje: 0 });
  }
}
