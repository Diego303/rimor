/**
 * La búsqueda en la interfaz (IN-032): el proveedor con el motor del espacio abierto (el índice en su Worker),
 * que se pone al día al abrir y tras cada tanda de cambios, y los ganchos para buscar y para saber si el índice
 * aún se prepara. La app no espera al índice: mientras, se busca con lo que ya tiene.
 */
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { useLectoresOpcional } from '../lectores/Lectores';
import { type ClienteIndice, crearClienteIndice, indiceEnHilo } from './cliente';
import { type Busqueda, type EstadoMotor, MotorBusqueda } from './motor';

const Contexto = createContext<MotorBusqueda | null>(null);

/** Lo que se espera tras un cambio del espacio para reindexar (agrupa las ráfagas: una importación). */
const ESPERA_SINCRONIZAR_MS = 300;

interface PropsProveedor {
  children: ReactNode;
  /** Las pruebas usan el índice en el hilo; si no, el Worker de búsqueda. */
  enHilo?: boolean;
}

export function ProveedorBusqueda({ children, enHilo = false }: PropsProveedor) {
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const [motor, setMotor] = useState<MotorBusqueda | null>(null);

  useEffect(() => {
    if (!espacio) {
      setMotor(null);
      return undefined;
    }
    const cliente: ClienteIndice = enHilo ? { api: indiceEnHilo(), cerrar: () => undefined } : crearClienteIndice();
    const nuevo = new MotorBusqueda({
      repositorio: espacio.repositorio,
      api: cliente.api,
      cache: espacio.cache,
      puedeEscribir: () => espacio.coordinacion.modo() === 'escritor',
      ...(lectores
        ? {
            // Lo que el lector deriva para buscar, con prioridad de fondo (lo visible va antes) y de su caché.
            indexable: async (el) => {
              const lector = lectores.registro.paraElemento(el);
              if (!lector?.textoIndexable) return '';
              return lector.textoIndexable(await lectores.cola.pedir(el, { prioridad: 'fondo' }));
            },
            estadosDe: (fm) => lectores.registro.paraElemento({ frontmatter: fm }),
          }
        : {}),
    });
    setMotor(nuevo);
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const programar = () => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => void nuevo.sincronizar().catch(() => undefined), ESPERA_SINCRONIZAR_MS);
    };
    // Al abrir, sin competir con la primera pintura; después, tras cada tanda de cambios.
    programar();
    const dejar = espacio.alCambiar(programar);
    return () => {
      dejar();
      clearTimeout(temporizador);
      void nuevo
        .cerrar()
        .catch(() => undefined)
        .finally(() => cliente.cerrar());
    };
  }, [espacio, lectores, enHilo]);

  return <Contexto.Provider value={motor}>{children}</Contexto.Provider>;
}

/** El motor del espacio abierto, o `null` (sin espacio, o fuera del proveedor). */
export function useBusquedaOpcional(): MotorBusqueda | null {
  return useContext(Contexto);
}

const LISTO: EstadoMotor = { fase: 'listo' };

/** El estado del índice: preparándose, indexando (con su progreso) o listo. */
export function useEstadoBusqueda(): EstadoMotor {
  const motor = useBusquedaOpcional();
  const suscribir = useCallback((avisar: () => void) => motor?.alCambiarEstado(avisar) ?? (() => undefined), [motor]);
  return useSyncExternalStore(suscribir, () => motor?.estado() ?? LISTO);
}

/**
 * Los resultados de una consulta, al día con el espacio y con el índice (al acabar de indexar se repite). Gana la
 * última consulta: la respuesta de una vieja que llega tarde se descarta. `null` mientras no hay motor o aún no
 * ha respondido a la primera.
 */
export function useBuscar(texto: string): { busqueda: Busqueda | null; buscando: boolean } {
  const motor = useBusquedaOpcional();
  const espacio = useEspacioOpcional();
  const [vuelta, setVuelta] = useState(0);
  const [estado, setEstado] = useState<{ texto: string; busqueda: Busqueda | null }>({ texto: '', busqueda: null });

  useEffect(() => {
    if (!motor) return undefined;
    const otraVuelta = () => setVuelta((v) => v + 1);
    const dejarMotor = motor.alCambiarEstado((e) => {
      if (e.fase === 'listo') otraVuelta();
    });
    const dejarEspacio = espacio?.alCambiar(otraVuelta);
    return () => {
      dejarMotor();
      dejarEspacio?.();
    };
  }, [motor, espacio]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `vuelta` repite la búsqueda tras un cambio.
  useEffect(() => {
    if (!motor) return undefined;
    let vigente = true;
    motor
      .buscar(texto)
      .then((busqueda) => {
        if (vigente) setEstado({ texto, busqueda });
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [motor, texto, vuelta]);

  return { busqueda: estado.busqueda, buscando: estado.texto !== texto || !estado.busqueda };
}

/** Las búsquedas ya contadas (en toda la app: un mensaje de Inicio puede volver a montarse). */
const CONTADAS = new Set<string>();

/**
 * Cuenta una búsqueda con resultado abierto (IN-016, MET-06) una sola vez por búsqueda: `clave` identifica la
 * búsqueda (la de un mensaje de Inicio, o la consulta de Buscar mientras se está en la pantalla).
 */
export function useContarAbierto(): (clave: string) => void {
  const espacio = useEspacioOpcional();
  return useCallback(
    (clave: string) => {
      if (!espacio || CONTADAS.has(clave)) return;
      CONTADAS.add(clave);
      void espacio.contadores.contar('busquedasConResultado').catch(() => undefined);
    },
    [espacio],
  );
}
