/**
 * Espacio abierto en la app (IN-007): lo abre al montar (OPFS en un Worker o, si no se puede, en memoria),
 * enseña la pantalla de arranque si tarda, llena lo que pinta la carcasa y da el espacio a las pantallas.
 */
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { CacheEspacio } from '../almacen/cache/cache';
import { ColaEscrituras } from '../almacen/cola';
import { AlmacenMemoria } from '../almacen/memoria';
import { crearAlmacenOpfs } from '../almacen/opfs/cliente';
import type { Canal, Cerrojos } from '../almacen/pestanas';
import { useEspacio } from '../estado/espacio';
import { idiomaActivo } from '../i18n/i18n';
import { elegirIdioma } from '../i18n/iniciar';
import { useT } from '../i18n/useT';
import { Boton, ErrorTarjeta } from '../ui/componentes';
import { ESTADOS_SENAL } from '../ui/marca/estadosSenal';
import { Senal } from '../ui/marca/Senal';
import { useEsperaVisible } from '../ui/marca/useEsperaVisible';
import { guardarPreferencia, leerPreferencia } from '../ui/tema/tema';
import { abrirEspacio, ahoraIso, type DependenciasEspacio, type EspacioAbierto, type FaseApertura } from './abrir';
import { conPersistencia } from './estado';
import { estaPersistido, esVentanaPrivada } from './persistencia';
import { resumenParaCarcasa } from './resumen';

const CLAVE_ESPACIO = 'rimor:espacio';

export interface EspacioEnUso extends EspacioAbierto {
  /** El navegador no deja guardar: todo está en memoria y se pierde al cerrar. */
  enMemoria: boolean;
  ventanaPrivada: boolean;
}

const Contexto = createContext<EspacioEnUso | null>(null);

/** El espacio abierto, o `null` fuera de `ProveedorEspacio` (pruebas de pantallas sueltas). */
export function useEspacioOpcional(): EspacioEnUso | null {
  return useContext(Contexto);
}

/** El espacio abierto. Solo dentro de `ProveedorEspacio`, que no pinta a sus hijos hasta tenerlo. */
export function useEspacioAbierto(): EspacioEnUso {
  const e = useContext(Contexto);
  if (!e) throw new Error('useEspacioAbierto necesita un ProveedorEspacio');
  return e;
}

/** Cerrojos que siempre conceden, para navegadores sin Web Locks (una sola pestaña de confianza). */
const cerrojoUnico: Cerrojos = { request: (_n, _o, fn) => fn({}) };
const canalMudo: Canal = { postMessage: () => undefined, addEventListener: () => undefined, close: () => undefined };

function idEspacio(): string {
  try {
    const guardado = globalThis.localStorage?.getItem(CLAVE_ESPACIO);
    if (guardado) return guardado;
  } catch {
    // Sin localStorage: el espacio por defecto.
  }
  return 'principal';
}

/** Lo que el proveedor necesita para abrir el espacio; `liberar` suelta lo que no cierra el espacio (el Worker). */
export type DependenciasProveedor = DependenciasEspacio & { enMemoria: boolean; liberar?: () => void };

const CLAVE_CONOCIDOS = 'rimor:espacios';

/**
 * Los espacios abiertos o creados en este navegador (id y nombre), para poder volver a cada uno: un espacio nuevo
 * importado (IN-036) no deja inaccesible al anterior. Cambiar entre espacios a fondo llega con IN-060.
 */
export function espaciosConocidos(): { id: string; nombre: string }[] {
  try {
    const lista: unknown = JSON.parse(globalThis.localStorage?.getItem(CLAVE_CONOCIDOS) ?? '[]');
    return Array.isArray(lista)
      ? lista.filter(
          (x): x is { id: string; nombre: string } => typeof x?.id === 'string' && typeof x?.nombre === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

/** Apunta un espacio como conocido (o le pone el nombre de ahora). */
export function recordarEspacioConocido(id: string, nombre: string): void {
  try {
    const otros = espaciosConocidos().filter((e) => e.id !== id);
    globalThis.localStorage?.setItem(CLAVE_CONOCIDOS, JSON.stringify([...otros, { id, nombre }]));
  } catch {
    // Sin localStorage, solo se conoce el de ahora.
  }
}

/** Lo quita de los conocidos (al borrarlo). */
export function olvidarEspacioConocido(id: string): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_CONOCIDOS, JSON.stringify(espaciosConocidos().filter((e) => e.id !== id)));
  } catch {
    // Sin localStorage no había lista.
  }
}

/** Borra la carpeta de un espacio en OPFS (en las pruebas, otra). Si ya no estaba, no es un error. */
export async function borrarCarpetaOpfs(id: string): Promise<void> {
  try {
    const raiz = await navigator.storage.getDirectory();
    const espacios = await raiz.getDirectoryHandle('espacios');
    await espacios.removeEntry(id, { recursive: true });
  } catch (e) {
    if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e;
  }
}

export interface OpcionesBorrarEspacio {
  /** El espacio abierto en esta pestaña: no se borra. */
  abierto: string;
  borrarCarpeta?: (id: string) => Promise<void>;
  cerrojos?: Cerrojos;
  /** La copia previa (el ZIP del espacio, §13.7): si falla, no se borra nada. */
  copiaPrevia?: (id: string) => Promise<void>;
}

/**
 * Borra un espacio que no es el abierto (IN-039: el de ejemplo, o uno importado): primero su copia, después sus
 * archivos, su caché y su sitio en la lista. Con el cerrojo de escritura del espacio cogido: si otra pestaña lo
 * tiene abierto (y lo escribe), no se borra (`espacio.enUso`).
 */
export async function borrarEspacio(
  id: string,
  {
    abierto,
    borrarCarpeta = borrarCarpetaOpfs,
    cerrojos = (globalThis.navigator?.locks as unknown as Cerrojos | undefined) ?? cerrojoUnico,
    copiaPrevia,
  }: OpcionesBorrarEspacio,
): Promise<void> {
  if (id === abierto) throw new Error('espacio.borrarAbierto');
  await cerrojos.request(`rimor:${id}`, { ifAvailable: true }, async (cerrojo) => {
    if (!cerrojo) throw new Error('espacio.enUso');
    await copiaPrevia?.(id);
    await borrarCarpeta(id);
  });
  await CacheEspacio.borrar(id).catch(() => undefined);
  olvidarEspacioConocido(id);
  // Si era el que se abre por defecto, la próxima vez se abre el de siempre (no uno vacío con su id).
  try {
    if (globalThis.localStorage?.getItem(CLAVE_ESPACIO) === id) globalThis.localStorage.removeItem(CLAVE_ESPACIO);
  } catch {
    // Sin localStorage no se recordaba.
  }
}

/** Abre otro espacio: lo recuerda y recarga la app en él (un espacio nuevo importado, IN-036). */
export function cambiarDeEspacio(id: string): void {
  recordarEspacio(id);
  globalThis.location?.reload();
}

/** Recuerda el espacio abierto para la próxima vez. */
function recordarEspacio(id: string): void {
  try {
    globalThis.localStorage?.setItem(CLAVE_ESPACIO, id);
  } catch {
    // Sin localStorage se abre el de por defecto.
  }
}

/** Dependencias reales del navegador; si OPFS falla, el espacio va en memoria. */
async function dependenciasDelNavegador(): Promise<DependenciasProveedor> {
  const espacioId = idEspacio();
  const cerrojos = (globalThis.navigator?.locks as unknown as Cerrojos | undefined) ?? cerrojoUnico;
  const canal =
    typeof BroadcastChannel === 'function'
      ? (new BroadcastChannel(`rimor:${espacioId}`) as unknown as Canal)
      : canalMudo;
  try {
    const opfs = await crearAlmacenOpfs(espacioId);
    const cola = new ColaEscrituras(opfs);
    return {
      espacioId,
      cerrojos,
      canal,
      enMemoria: false,
      almacen: Object.assign(cola, { limpiarHuerfanos: () => opfs.limpiarHuerfanos() }),
      // El Worker se termina cuando la cola ha escrito todo lo pendiente.
      liberar: () => void cola.esperar().finally(() => opfs.cerrar()),
    };
  } catch {
    // OPFS no se abre (navegador antiguo, ventana privada de Firefox, Worker que no carga): en memoria.
    if (typeof BroadcastChannel === 'function') (canal as unknown as BroadcastChannel).close();
    return { espacioId, cerrojos: cerrojoUnico, canal: canalMudo, enMemoria: true, almacen: new AlmacenMemoria() };
  }
}

export type Apertura =
  | { estado: 'abriendo'; fase: FaseApertura }
  | { estado: 'listo'; espacio: EspacioEnUso }
  | { estado: 'fallo'; codigo: string };

interface Props {
  children: ReactNode;
  /** Las pruebas inyectan sus dependencias. */
  dependencias?: () => Promise<DependenciasProveedor>;
}

export function ProveedorEspacio({ children, dependencias = dependenciasDelNavegador }: Props) {
  const [apertura, setApertura] = useState<Apertura>({ estado: 'abriendo', fase: { fase: 'abriendo' } });
  // Cada «Reintentar» vuelve a abrir desde el principio.
  const [intento, setIntento] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `intento` solo sirve para volver a abrir.
  useEffect(() => {
    let vivo = true;
    // Mientras se abre, el desmontaje solo marca `vivo = false` y la propia apertura suelta todo en su
    // siguiente paso: terminar el Worker a mitad dejaría promesas colgadas y el cerrojo de escritura cogido.
    let soltar: (() => void) | null = null;
    let listo = false;
    let reloj: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const dep = await dependencias();
      let abierto: EspacioAbierto | null = null;
      let suelto = false;
      soltar = () => {
        if (suelto) return;
        suelto = true;
        // Primero se escribe lo pendiente y se suelta el cerrojo; después se termina el Worker.
        void Promise.resolve(abierto?.cerrar())
          .catch(() => undefined)
          .finally(() => dep.liberar?.());
      };
      if (!vivo) return soltar();
      const r = await abrirEspacio(dep, (fase) => vivo && setApertura({ estado: 'abriendo', fase }));
      if (r.ok) abierto = r.valor;
      if (!vivo) return soltar();
      if (!r.ok) {
        soltar();
        setApertura({ estado: 'fallo', codigo: r.error.codigo });
        return;
      }
      const e = r.valor;
      const ventanaPrivada = dep.enMemoria || (await esVentanaPrivada());
      if (!vivo) return soltar();
      // El tema y el idioma de los ajustes del espacio (uno importado, elegidos en otro navegador o cambiados en la
      // otra pestaña) se aplican al abrir y cada vez que cambian; no se insiste si este navegador elige otro.
      let aplicados: { tema?: string; idioma?: string } = {};
      const aplicarAjustes = () => {
        const { tema, idioma } = e.ajustes();
        if (tema && tema !== aplicados.tema && tema !== leerPreferencia()) guardarPreferencia(tema);
        if (idioma && idioma !== aplicados.idioma && idioma !== idiomaActivo()) elegirIdioma(idioma);
        aplicados = { ...(tema ? { tema } : {}), ...(idioma ? { idioma } : {}) };
      };
      aplicarAjustes();
      const pintar = () => {
        aplicarAjustes();
        useEspacio.setState({
          ...resumenParaCarcasa(
            e.manifest,
            e.repositorio.elementos(),
            e.estado(),
            new Date(),
            e.colecciones.lista(),
            e.ajustes().copias,
          ),
          soloLectura: e.coordinacion.modo() === 'lector',
        });
      };
      pintar();
      e.alCambiar(pintar);
      e.coordinacion.alCambiarModo(pintar);
      // El paso del tiempo también cambia la copia (vencen los días sin copia): se repinta cada minuto.
      reloj = setInterval(pintar, 60_000);
      // Una PWA instalada puede tener ya el almacenamiento protegido sin haberlo pedido: se anota. Si no se
      // puede escribir, se sigue igual (nunca bloquea).
      if (!dep.enMemoria && e.estado().persistencia !== 'concedida' && (await estaPersistido()))
        await e.guardarEstado((x) => conPersistencia(x, 'concedida', ahoraIso())).catch(() => undefined);
      if (!vivo) return soltar();
      if (!dep.enMemoria) {
        recordarEspacio(dep.espacioId);
        recordarEspacioConocido(dep.espacioId, e.manifest.espacio.nombre);
      }
      listo = true;
      setApertura({ estado: 'listo', espacio: { ...e, enMemoria: dep.enMemoria, ventanaPrivada } });
    })().catch(() => {
      soltar?.();
      if (vivo) setApertura({ estado: 'fallo', codigo: 'espacio.noSeAbre' });
    });
    return () => {
      vivo = false;
      clearInterval(reloj);
      if (listo) soltar?.();
    };
  }, [dependencias, intento]);

  if (apertura.estado === 'listo') return <Contexto.Provider value={apertura.espacio}>{children}</Contexto.Provider>;
  return (
    <Arranque
      apertura={apertura}
      alReintentar={() => {
        setApertura({ estado: 'abriendo', fase: { fase: 'abriendo' } });
        setIntento((n) => n + 1);
      }}
    />
  );
}

/** Texto del fallo según su código. */
const TEXTO_FALLO = {
  'espacio.manifestInvalido': 'espacio.fallo.manifest',
  'espacio.esquemaNuevo': 'espacio.fallo.esquemaNuevo',
} as const;

/**
 * Pantalla de arranque: nada antes de 400 ms; después, «arranque» una vez y, si sigue abriendo, «cargando» (o
 * «indexando», con el progreso, si está reconstruyendo la caché y el índice: tabla de IN-090).
 */
export function Arranque({
  apertura,
  alReintentar,
}: {
  apertura: Exclude<Apertura, { estado: 'listo' }>;
  alReintentar: () => void;
}) {
  const { t } = useT();
  const visible = useEsperaVisible(apertura.estado === 'abriendo');
  const [larga, setLarga] = useState(false);
  useEffect(() => {
    if (!visible) return undefined;
    const tiempo = setTimeout(() => setLarga(true), ESTADOS_SENAL.arranque.duracionS * 1000);
    return () => clearTimeout(tiempo);
  }, [visible]);

  if (apertura.estado === 'fallo')
    return (
      <div className="arranque">
        <ErrorTarjeta
          titulo={t('espacio.fallo.titulo')}
          accion={<Boton onClick={alReintentar}>{t('espacio.fallo.reintentar')}</Boton>}
        >
          {t(TEXTO_FALLO[apertura.codigo as keyof typeof TEXTO_FALLO] ?? 'espacio.fallo.otro')}
        </ErrorTarjeta>
      </div>
    );
  if (!visible) return <div className="arranque" />;
  const texto =
    apertura.fase.fase === 'indexando'
      ? t('espacio.indexando', { hechos: apertura.fase.hechos, total: apertura.fase.total })
      : t('espacio.abriendo');
  return (
    <div className="arranque">
      {larga ? (
        <Senal estado={apertura.fase.fase === 'indexando' ? 'indexando' : 'cargando'} etiqueta={texto} tamano={32} />
      ) : (
        <Senal estado="arranque" veces={1} etiqueta={texto} tamano={48} textoOculto />
      )}
    </div>
  );
}
