/**
 * Abrir (o crear) un espacio (DAT-06): coordina pestañas, termina escrituras cortadas, crea el manifest si no
 * existe, pone la caché al día con los archivos y deja listo el repositorio. Sin React: todo inyectado.
 *
 * Solo la pestaña con el cerrojo escribe (IN-005). Una pestaña lectora no toca archivos ni caché, y relee lo
 * que cambie la otra; cuando pasa a escribir, vuelve a leerlo todo antes de escribir nada.
 */
import { ESQUEMA_ACTUAL, fallo, isoConZona, leerManifest, type Manifest, ok, type Resultado } from '@rimor/formato';
import { CacheEspacio } from '../almacen/cache/cache';
import { type Progreso, reconciliar } from '../almacen/cache/reconciliar';
import { type Almacen, escribirTexto, leerTexto } from '../almacen/contrato';
import { type Canal, type Cerrojos, type Coordinacion, coordinarPestanas } from '../almacen/pestanas';
import { Repositorio } from '../almacen/repositorio';
import { abrirContadores, type Contadores } from '../respuestas/contadores';
import { type Ajustes, leerAjustes, RUTA_AJUSTES } from './ajustes';
import { conCambios, type EstadoCuidado, leerEstado, RUTA_ESTADO } from './estado';
import { crearManifest, NOMBRE_ESPACIO_INICIAL, RUTA_MANIFEST } from './manifest';

export interface DependenciasEspacio {
  espacioId: string;
  almacen: Almacen & {
    limpiarHuerfanos?: () => Promise<number>;
    /** Espera a que se escriba lo pendiente (la cola de escrituras). */
    esperar?: () => Promise<void>;
  };
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
  /** Archivos que no se pudieron leer en la última lectura (frontmatter inválido o duplicados). */
  fallidos(): { ruta: string; codigo: string }[];
  estado(): EstadoCuidado;
  /** Guarda un cambio del estado de cuidado (persistencia, copia). */
  guardarEstado(cambio: (e: EstadoCuidado) => EstadoCuidado): Promise<void>;
  /** Se llama tras cada cambio del estado o de los elementos (también los que relee de otra pestaña). */
  alCambiar(fn: (e: EstadoCuidado) => void): () => void;
  /** Ajustes del espacio (`.rimor/ajustes.json`). */
  ajustes(): Ajustes;
  /** Contadores locales de lo ahorrado (IN-016). */
  contadores: Contadores;
  /** Escribe lo pendiente y suelta el cerrojo y la caché. */
  cerrar(): Promise<void>;
}

export type FaseApertura = { fase: 'abriendo' } | { fase: 'indexando'; hechos: number; total: number };

const json = (x: unknown) => `${JSON.stringify(x, null, 2)}\n`;

/** Abre la caché; si no se deja abrir, la borra y lo intenta otra vez (es regenerable). */
async function abrirCache(dep: DependenciasEspacio): Promise<CacheEspacio> {
  try {
    return await CacheEspacio.abrir(dep.espacioId, dep.fabricaIndexedDb);
  } catch {
    await CacheEspacio.borrar(dep.espacioId, dep.fabricaIndexedDb);
    return CacheEspacio.abrir(dep.espacioId, dep.fabricaIndexedDb);
  }
}

export async function abrirEspacio(
  dep: DependenciasEspacio,
  alProgreso: (f: FaseApertura) => void = () => undefined,
): Promise<Resultado<EspacioAbierto>> {
  const reloj = dep.reloj ?? (() => new Date());
  alProgreso({ fase: 'abriendo' });
  const coordinacion = await coordinarPestanas(dep.espacioId, dep.cerrojos, dep.canal);
  const escribe = () => coordinacion.modo() === 'escritor';
  let cache: CacheEspacio | null = null;
  try {
    if (escribe()) await dep.almacen.limpiarHuerfanos?.();

    const textoManifest = await leerTexto(dep.almacen, RUTA_MANIFEST);
    let manifest = textoManifest === null ? null : leerManifest(textoManifest);
    // Un manifest que existe pero no se entiende, o de un esquema más nuevo, no se toca: el espacio es de otra versión.
    if (textoManifest !== null && !manifest) {
      coordinacion.cerrar();
      return fallo('espacio.manifestInvalido');
    }
    if (manifest && manifest.esquema > ESQUEMA_ACTUAL) {
      coordinacion.cerrar();
      return fallo('espacio.esquemaNuevo', { esquema: manifest.esquema });
    }
    let estado = leerEstado(await leerTexto(dep.almacen, RUTA_ESTADO));
    if (!manifest) {
      // El id del manifest es un ULID propio; `espacioId` solo nombra la carpeta y la caché del navegador.
      manifest = crearManifest(NOMBRE_ESPACIO_INICIAL, reloj());
      if (escribe()) {
        await escribirTexto(dep.almacen, RUTA_MANIFEST, json(manifest));
        await escribirTexto(dep.almacen, RUTA_ESTADO, json(estado));
      }
    }

    let cerrado = false;
    // Falso mientras una pestaña que acaba de pasar a escribir relee: hasta entonces su índice es viejo.
    let alDia = true;
    const oyentes = new Set<(e: EstadoCuidado) => void>();
    const avisar = () => {
      for (const fn of oyentes) fn(estado);
    };
    let pendiente = Promise.resolve();
    const guardarEstado = (cambio: (e: EstadoCuidado) => EstadoCuidado) => {
      estado = cambio(estado);
      const copia = estado;
      avisar();
      // Las escrituras del estado van en orden; solo escribe la pestaña que tiene el cerrojo.
      pendiente = pendiente
        .catch(() => undefined)
        .then(() => (escribe() && !cerrado ? escribirTexto(dep.almacen, RUTA_ESTADO, json(copia)) : undefined));
      return pendiente;
    };

    // Los ajustes que no se pueden leer (E/S) toman los iniciales: nunca impiden abrir.
    const leerAjustesSeguro = async () => {
      try {
        return leerAjustes(await leerTexto(dep.almacen, RUTA_AJUSTES));
      } catch {
        return null;
      }
    };
    let ajustes = (await leerAjustesSeguro()) ?? leerAjustes(null);
    const contadores = await abrirContadores(dep.almacen, () => escribe() && alDia && !cerrado, reloj);

    const abierta = await abrirCache(dep);
    cache = abierta;
    const leerTodo = (progreso?: (p: Progreso) => void) =>
      reconciliar(dep.almacen, abierta, progreso, { soloLectura: !escribe() });
    // Una lectura que falla (p. ej. un archivo que la otra pestaña tiene abierto) se reintenta una vez.
    const r = await leerTodo((p) => alProgreso({ fase: 'indexando', ...p })).catch(() => leerTodo());
    let fallidos = r.fallidos;
    const repositorio = new Repositorio(dep.almacen, abierta, {
      puedeEscribir: () => escribe() && alDia && !cerrado,
      alCambiar: () => {
        // Si la escritura falla, el recuento sigue en memoria y se escribe con el siguiente cambio.
        guardarEstado((e) => conCambios(e)).catch(() => undefined);
        coordinacion.avisarCambio([]);
      },
    });
    repositorio.cargarDesde(r.entradas);

    // Relee estado y elementos: al recibir un cambio de la otra pestaña o al pasar a escribir. En orden, y los
    // avisos que llegan mientras ya hay una relectura esperando se juntan en ella.
    let relectura: Promise<boolean> = Promise.resolve(true);
    let enEspera = false;
    /** Relee todo; devuelve si lo consiguió (una lectura que falla deja lo anterior). */
    const releer = (antes?: () => Promise<unknown>): Promise<boolean> => {
      if (enEspera && !antes) return relectura;
      enEspera = true;
      const turno = relectura.then(async () => {
        enEspera = false;
        if (cerrado) return false;
        await antes?.();
        const nuevo = await leerTodo();
        repositorio.cargarDesde(nuevo.entradas);
        fallidos = nuevo.fallidos;
        estado = leerEstado(await leerTexto(dep.almacen, RUTA_ESTADO));
        ajustes = (await leerAjustesSeguro()) ?? ajustes;
        avisar();
        return true;
      });
      relectura = turno.catch(() => false);
      return relectura;
    };
    coordinacion.alCambiarEnOtra(() => {
      if (!escribe()) void releer();
    });
    coordinacion.alCambiarModo((modo) => {
      if (modo !== 'escritor') return;
      alDia = false;
      const preparar = async () => {
        await dep.almacen.limpiarHuerfanos?.();
        // Si la otra pestaña no llegó a crearlos, se crean ahora.
        if ((await leerTexto(dep.almacen, RUTA_MANIFEST)) === null)
          await escribirTexto(dep.almacen, RUTA_MANIFEST, json(manifest));
        if ((await leerTexto(dep.almacen, RUTA_ESTADO)) === null)
          await escribirTexto(dep.almacen, RUTA_ESTADO, json(estado));
      };
      // Solo se escribe con todo releído; si la relectura falla dos veces, la pestaña sigue sin escribir (mejor
      // que escribir sobre un índice viejo).
      void releer(preparar)
        .then((bien) => bien || releer(preparar))
        .then(async (bien) => {
          if (!bien) return;
          alDia = true;
          // Lo que se contó mientras solo se leía, ahora sí, sobre lo que contó la otra pestaña.
          await contadores.recargar();
          avisar();
        });
    });

    return ok({
      manifest,
      repositorio,
      cache: abierta,
      coordinacion,
      fallidos: () => fallidos,
      estado: () => estado,
      guardarEstado,
      ajustes: () => ajustes,
      contadores,
      alCambiar: (fn) => {
        oyentes.add(fn);
        return () => oyentes.delete(fn);
      },
      cerrar: async () => {
        if (cerrado) return;
        // Primero lo que ya estaba pedido; después nada más se escribe y se sueltan cerrojo y caché.
        await pendiente.catch(() => undefined);
        await contadores.esperar();
        await dep.almacen.esperar?.().catch(() => undefined);
        cerrado = true;
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
