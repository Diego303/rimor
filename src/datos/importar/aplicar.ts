/**
 * Importar de verdad (DAT-04), cuando el paquete ya se validó y se eligió el modo: fusionar (lo que dice el plan),
 * reemplazar (todo lo del paquete; lo de aquí que no está, fuera; `manifest.json` y `.rimor/` se quedan) o un
 * espacio nuevo (otra carpeta con todo y su manifest). Quien llama hace antes la copia previa (reemplazar) y
 * después relee el espacio. TS puro sobre un almacén.
 */
import { isoConZona, type Manifest, ulid } from '@rimor/formato';
import { type Almacen, escribirTexto, listarTodo } from '../../almacen/contrato';
import { RUTA_AJUSTES } from '../../espacio/ajustes';
import type { Paquete } from './paquete';
import type { Plan } from './plan';

export type ModoImportar = 'fusionar' | 'reemplazar' | 'nuevo';

/** De este navegador: ni se borra ni se pisa al reemplazar. */
const deEsteNavegador = (ruta: string) => ruta === 'manifest.json' || ruta.startsWith('.rimor/');

/** Los adjuntos primero, los elementos al final: si algo se corta, ningún elemento apunta a un adjunto que falta. */
const orden = (ruta: string) => (ruta.startsWith('adjuntos/') ? 0 : /^(papelera\/)?elementos\//.test(ruta) ? 2 : 1);

async function escribirTodo(almacen: Almacen, archivos: Iterable<[string, Uint8Array]>): Promise<number> {
  const lista = [...archivos].sort(([a], [b]) => orden(a) - orden(b) || (a < b ? -1 : 1));
  for (const [ruta, datos] of lista) await almacen.escribir(ruta, datos);
  return lista.length;
}

/** Fusionar: escribe y borra lo que dice el plan. */
export async function fusionar(almacen: Almacen, plan: Plan): Promise<void> {
  await escribirTodo(almacen, plan.escrituras);
  for (const ruta of plan.borrados) await almacen.borrar(ruta);
}

/**
 * Reemplazar: primero se escribe todo lo del paquete y después se borra lo de aquí que no viene en él (si se corta a
 * mitad, queda una mezcla, nunca un espacio vacío).
 */
export async function reemplazar(almacen: Almacen, paquete: Paquete): Promise<void> {
  const delPaquete = [...paquete.archivos].filter(([ruta]) => !deEsteNavegador(ruta));
  // Los adjuntos que un JSON no trae (excluidos por tamaño) se quedan: sus elementos los siguen citando.
  const quedan = new Set([...delPaquete.map(([ruta]) => ruta), ...(paquete.manifest.adjuntos_excluidos ?? [])]);
  const aqui = (await listarTodo(almacen, '')).map((e) => e.ruta);
  // Lo de aquí que estorba (un archivo donde el paquete necesita una carpeta, o al revés) sale antes de escribir.
  const carpetas = new Set(
    delPaquete.flatMap(([ruta]) =>
      ruta
        .split('/')
        .slice(0, -1)
        .map((_, i, p) => p.slice(0, i + 1).join('/')),
    ),
  );
  for (const ruta of aqui)
    if (!deEsteNavegador(ruta) && (carpetas.has(ruta) || [...quedan].some((q) => ruta.startsWith(`${q}/`))))
      await almacen.borrar(ruta);
  await escribirTodo(almacen, delPaquete);
  for (const ruta of aqui) if (!deEsteNavegador(ruta) && !quedan.has(ruta)) await almacen.borrar(ruta);
}

/** El manifest de un espacio nuevo con lo importado: id nuevo y el nombre con «(importado)». */
export function manifestNuevo(manifest: Manifest, nombre: string, ahora: Date, id: string = ulid()): Manifest {
  const { exportado: _e, hashes: _h, ...resto } = manifest as Manifest & { exportado?: string };
  return { ...resto, espacio: { id, nombre }, creado: isoConZona(ahora), adjuntos_excluidos: [] } as Manifest;
}

/**
 * Los ajustes del paquete sin los dominios de red activados (IN-041): quien importa el espacio de otro no le da
 * permiso a Rimor para consultar lo que el otro activó. Si no se entienden, tal cual (se leerán con sus valores por
 * defecto).
 */
export function sinDominiosActivados(datos: Uint8Array): Uint8Array {
  try {
    const ajustes = JSON.parse(new TextDecoder().decode(datos)) as Record<string, unknown>;
    const red = ajustes.red;
    if (!red || typeof red !== 'object' || Array.isArray(red)) return datos;
    return new TextEncoder().encode(`${JSON.stringify({ ...ajustes, red: { ...red, dominios: [] } }, null, 2)}\n`);
  } catch {
    return datos;
  }
}

/**
 * Espacio nuevo: todo lo del paquete (también su `.rimor/`, con los dominios de red apagados) en un almacén vacío, con
 * su manifest.
 */
export async function enEspacioNuevo(almacen: Almacen, paquete: Paquete, manifest: Manifest): Promise<void> {
  await escribirTodo(
    almacen,
    [...paquete.archivos].map(([ruta, datos]): [string, Uint8Array] =>
      ruta === RUTA_AJUSTES ? [ruta, sinDominiosActivados(datos)] : [ruta, datos],
    ),
  );
  await escribirTexto(almacen, 'manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
}
