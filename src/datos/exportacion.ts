/**
 * Exportar desde la app (IN-035): genera el ZIP o el JSON en el Worker de exportación (o, sin él, en este hilo
 * con el almacén del espacio), lo descarga y, si es una copia completa, la apunta en el estado de cuidado (el
 * piloto del raíl pasa a verde). Una exportación a la vez; su progreso, en `useExportacion`.
 */
import { isoConZona, type Manifest } from '@rimor/formato';
import { proxy, wrap } from 'comlink';
import { create } from 'zustand';
import type { Almacen } from '../almacen/contrato';
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
  estado(): EstadoCuidado;
  guardarEstado(cambio: (e: EstadoCuidado) => EstadoCuidado): Promise<void>;
  /** Solo la pestaña que escribe apunta la copia (en la otra, no quedaría guardada). */
  coordinacion: { modo(): string };
}

export interface Exportado {
  nombre: string;
  bytes: number;
  /** Adjuntos que no caben en el JSON: si hay alguno, no es una copia completa. */
  excluidos: string[];
  /** Cuenta como copia. */
  completa: boolean;
  /** Se apuntó como la última copia (completa y en la pestaña que escribe): el piloto pasa a verde. */
  apuntada: boolean;
}

interface Generado {
  blob: Blob;
  excluidos: string[];
}

type Opciones = { ahora: Date; version: string; alProgreso: (p: ProgresoExportacion) => void; senal: AbortSignal };

/** Sin progreso en tanto tiempo, la exportación se da por atascada y se corta. */
export const PLAZO_SIN_PROGRESO_MS = 60_000;

const cancelada = () => new DOMException('Exportación cancelada', 'AbortError');

/** Lo que se espera, cortado si llega la señal (una lectura que no vuelve no deja la exportación colgada). */
function conCorte<T>(promesa: Promise<T>, senal: AbortSignal): Promise<T> {
  return new Promise<T>((resolver, rechazar) => {
    if (senal.aborted) return rechazar(senal.reason ?? cancelada());
    const alCortar = () => rechazar(senal.reason ?? cancelada());
    senal.addEventListener('abort', alCortar, { once: true });
    promesa.then(resolver, rechazar).finally(() => senal.removeEventListener('abort', alCortar));
  });
}

async function enHilo(almacen: Almacen, tipo: TipoExportacion, o: Opciones): Promise<Generado> {
  const { exportarJson, exportarZip } = await cargarExportar();
  if (tipo === 'zip') {
    const { trozos } = await exportarZip(almacen, o);
    return { blob: new Blob(trozos as Uint8Array<ArrayBuffer>[], { type: 'application/zip' }), excluidos: [] };
  }
  const { texto, excluidos } = await exportarJson(almacen, o);
  return { blob: new Blob([texto], { type: 'application/json' }), excluidos };
}

/** Un fallo del Worker (no carga o algo dentro), distinto de una cancelación: entonces se intenta en el hilo. */
class FalloWorker extends Error {}

/** En el Worker. Cortar lo termina. */
function enWorker(espacio: string, tipo: TipoExportacion, o: Opciones): Promise<Generado> {
  const worker = new Worker(new URL('../workers/exportar.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<Generado>((resolver, rechazar) => {
    if (o.senal.aborted) return rechazar(cancelada());
    o.senal.addEventListener('abort', () => rechazar(o.senal.reason ?? cancelada()), { once: true });
    worker.addEventListener('error', () => rechazar(new FalloWorker('exportar.workerNoCarga')));
    wrap<ApiExportar>(worker)
      .exportar(espacio, tipo, { ahora: o.ahora, version: o.version }, proxy(o.alProgreso))
      .then(
        ({ blob, excluidos }) => resolver({ blob, excluidos }),
        (e) => rechazar(new FalloWorker(String(e))),
      );
  }).finally(() => worker.terminate());
}

/** El corte de la exportación en marcha. */
let corteActual: AbortController | null = null;

/** Corta la exportación en marcha (el botón «Cancelar»): se rechaza con `AbortError` y no se descarga nada. */
export function cancelarExportacion(): void {
  corteActual?.abort(cancelada());
}

/**
 * Exporta, descarga y, si la copia es completa (y esta pestaña escribe), la apunta: con la fecha del principio y
 * descontando solo los cambios que había entonces (lo cambiado mientras tanto no está en ella). `null` si ya había
 * una en marcha. Lanza si falla, se cancela o se atasca (y entonces no se apunta nada). `motivo` va en el nombre
 * (la copia previa a algo destructivo).
 */
export async function exportarEspacio(
  espacio: EspacioExportable,
  tipo: TipoExportacion,
  { motivo, reloj = () => new Date() }: { motivo?: string; reloj?: () => Date } = {},
): Promise<Exportado | null> {
  if (useExportacion.getState().tipo) return null;
  useExportacion.setState({ tipo, porcentaje: 0 });
  const corte = new AbortController();
  corteActual = corte;
  let ultimoProgreso = Date.now();
  const vigia = setInterval(() => {
    if (Date.now() - ultimoProgreso > PLAZO_SIN_PROGRESO_MS) corte.abort(new Error('exportar.atascada'));
  }, 5000);
  try {
    await espacio.esperarEscrituras();
    const ahora = reloj();
    const cambiosAlEmpezar = espacio.estado().cambiosDesdeCopia;
    const o: Opciones = {
      ahora,
      version: __VERSION_APP__,
      senal: corte.signal,
      alProgreso: ({ hechos, total }) => {
        ultimoProgreso = Date.now();
        useExportacion.setState({ porcentaje: total ? Math.floor((hechos / total) * 100) : 100 });
      },
    };
    let generado: Generado;
    if (!espacio.enMemoria && typeof Worker === 'function') {
      try {
        generado = await enWorker(espacio.id, tipo, o);
      } catch (e) {
        // El Worker no carga (o falló dentro): lo mismo en este hilo. Una cancelación, no.
        if (!(e instanceof FalloWorker)) throw e;
        generado = await conCorte(enHilo(espacio.almacen, tipo, o), corte.signal);
      }
    } else generado = await conCorte(enHilo(espacio.almacen, tipo, o), corte.signal);
    if (corte.signal.aborted) throw corte.signal.reason ?? cancelada();
    const nombre = (await cargarExportar()).nombreExportacion(espacio.manifest.espacio.nombre, ahora, tipo, motivo);
    descargarBlob(generado.blob, nombre);
    const completa = generado.excluidos.length === 0;
    const apuntada = completa && espacio.coordinacion.modo() === 'escritor';
    if (apuntada) await espacio.guardarEstado((e) => conCopia(e, isoConZona(ahora), cambiosAlEmpezar));
    return { nombre, bytes: generado.blob.size, excluidos: generado.excluidos, completa, apuntada };
  } finally {
    clearInterval(vigia);
    if (corteActual === corte) corteActual = null;
    useExportacion.setState({ tipo: null, porcentaje: 0 });
  }
}
