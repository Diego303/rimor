/**
 * Lectores en la interfaz (IN-012, VIS-01): el proveedor con el registro y la cola de derivados, y los
 * contenedores `VistaElemento` y `TarjetaElemento`, que pintan la vista de cada lector en diferido.
 */
import type { Elemento } from '@rimor/formato';
import { Component, createContext, type ReactNode, Suspense, useContext, useEffect, useState } from 'react';
import type { Repositorio } from '../almacen/repositorio';
import { type Previa, previsualizar } from '../captura/previa';
import type { OpcionesCaptura } from '../espacio/ajustes';
import { useEspacioOpcional } from '../espacio/Espacio';
import type { Idioma } from '../i18n/formatos';
import { traducir } from '../i18n/i18n';
import { useT } from '../i18n/useT';
import { clases } from '../ui/clases';
import { ErrorTarjeta, IconoTipo } from '../ui/componentes';
import { Senal } from '../ui/marca/Senal';
import { useEsperaVisible } from '../ui/marca/useEsperaVisible';
import { cargarTextoAdjunto } from './adjuntos';
import type { Lector } from './contrato';
import { AntesDeDetalles, DetallesElemento } from './DetallesElemento';
import { ColaDerivados, type Ejecutor, esCancelado, type Progreso } from './derivados';
import { crearEjecutor } from './ejecutor';
import { REGISTRO, type Registro } from './registro';
import { olvidarVistas, tarjetaDe, vistaDe } from './vistas';

interface ValorLectores {
  registro: Registro;
  cola: ColaDerivados;
  /** Vista previa del compositor (en el Worker si lo hay). */
  previsualizar(texto: string, opciones?: OpcionesCaptura): Promise<Previa>;
}

const Contexto = createContext<ValorLectores | null>(null);

const mismoResumen = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface PropsProveedor {
  children: ReactNode;
  registro?: Registro;
  /** Las pruebas pasan su propio ejecutor; si no, el Worker de derivados. */
  ejecutar?: Ejecutor;
}

/**
 * Registro y cola de derivados para las pantallas. La cola usa la caché del espacio (solo la pestaña que escribe
 * guarda en ella) y, cuando los datos de un elemento cambian el resumen o la versión de su lector, pone al día
 * el frontmatter (solo la pestaña que escribe y solo si el original sigue siendo el mismo).
 */
export function ProveedorLectores({ children, registro = REGISTRO, ejecutar }: PropsProveedor) {
  const espacio = useEspacioOpcional();
  const [valor, setValor] = useState<ValorLectores | null>(null);

  useEffect(() => {
    const ejecutor = ejecutar
      ? {
          ejecutar,
          previsualizar: async (texto: string, opciones?: OpcionesCaptura) => previsualizar(texto, registro, opciones),
          reiniciar: () => undefined,
          cerrar: () => undefined,
        }
      : crearEjecutor(registro);
    const escribe = () => espacio?.coordinacion.modo() === 'escritor';
    const cache = espacio && {
      derivado: espacio.cache.derivado.bind(espacio.cache),
      // Una pestaña lectora no toca la caché compartida (IN-007): podría ser de otra versión de la app.
      guardarDerivado: async (...args: Parameters<typeof espacio.cache.guardarDerivado>) => {
        if (escribe()) await espacio.cache.guardarDerivado(...args);
      },
    };
    const nueva = new ColaDerivados({
      registro,
      ejecutar: ejecutor.ejecutar,
      ...(cache ? { cache } : {}),
      alDerivar: (el, lector, datos) => {
        if (espacio && escribe()) void ponerAlDia(espacio.repositorio, el, lector, datos).catch(() => undefined);
      },
      // Un Worker atascado se termina; lo siguiente abre otro.
      alAgotarPlazo: ejecutor.reiniciar,
      // Un texto de más de 2 MB va como adjunto: se lee del espacio para que el Worker lo analice.
      ...(espacio ? { cargarOriginal: (el: Elemento) => cargarTextoAdjunto(espacio.repositorio, el) } : {}),
    });
    setValor({ registro, cola: nueva, previsualizar: ejecutor.previsualizar });
    return () => ejecutor.cerrar();
  }, [registro, ejecutar, espacio]);

  return valor ? <Contexto.Provider value={valor}>{children}</Contexto.Provider> : null;
}

/** Escribe en el frontmatter el resumen y la versión vigentes del lector, si cambiaron. */
async function ponerAlDia(repositorio: Repositorio, el: Elemento, lector: Lector, datos: unknown): Promise<void> {
  const resumen = lector.resumen(datos);
  const vigente = (fm: Elemento['frontmatter']) =>
    fm.lector.nombre === lector.nombre &&
    fm.lector.version === lector.version &&
    mismoResumen(fm.lector.resumen, resumen);
  if (vigente(el.frontmatter)) return;
  // Leer y escribir en el mismo turno del elemento: una edición pedida a la vez no se pisa.
  await repositorio.actualizarElemento(el.frontmatter.id, (actual) =>
    // Si el original cambió desde que se pidieron los datos, estos ya no le corresponden.
    actual.frontmatter.hash !== el.frontmatter.hash || vigente(actual.frontmatter)
      ? null
      : {
          ...actual,
          frontmatter: { ...actual.frontmatter, lector: { nombre: lector.nombre, version: lector.version, resumen } },
        },
  );
}

/** Registro y cola, o `null` fuera de `ProveedorLectores`. */
export function useLectoresOpcional(): ValorLectores | null {
  return useContext(Contexto);
}

export function useLectores(): ValorLectores {
  const v = useContext(Contexto);
  if (!v) throw new Error('useLectores necesita un ProveedorLectores');
  return v;
}

export type EstadoDerivado<D> =
  | { estado: 'calculando'; progreso?: Progreso }
  | { estado: 'listo'; datos: D }
  | { estado: 'error' }
  | { estado: 'sin-lector' };

/** Derivados de un elemento con prioridad visible; se cancelan al dejar de pintarlo. */
export function useDerivado<D = unknown>(el: Elemento): EstadoDerivado<D> {
  const { registro, cola } = useLectores();
  const lector = registro.paraElemento(el);
  const fm = el.frontmatter;
  const clave = `${fm.id}|${lector?.nombre}|${lector?.version}|${fm.hash}`;
  const [estado, setEstado] = useState<{ clave: string; valor: EstadoDerivado<D> }>({
    clave,
    valor: { estado: 'calculando' },
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: `clave` resume el elemento y el lector que importan.
  useEffect(() => {
    if (!lector) return undefined;
    const parar = new AbortController();
    setEstado({ clave, valor: { estado: 'calculando' } });
    cola
      .pedir<D>(el, {
        prioridad: 'visible',
        senal: parar.signal,
        alProgreso: (progreso) => setEstado({ clave, valor: { estado: 'calculando', progreso } }),
      })
      .then((datos) => setEstado({ clave, valor: { estado: 'listo', datos } }))
      .catch((e) => {
        if (!esCancelado(e)) setEstado({ clave, valor: { estado: 'error' } });
      });
    return () => parar.abort();
  }, [cola, clave]);

  if (!lector) return { estado: 'sin-lector' };
  // Mientras el efecto no ha corrido para un elemento nuevo, no se enseñan los datos del anterior.
  return estado.clave === clave ? estado.valor : { estado: 'calculando' };
}

/**
 * El original tal cual, para cuando no hay lector, ni vista, o el lector falla; con los detalles comunes del
 * elemento (desde ahí se le puede cambiar el tipo).
 */
function Original({ el }: { el: Elemento }) {
  return (
    <>
      <pre className="code">{el.original ?? ''}</pre>
      <DetallesElemento refe={el.frontmatter.ref} />
    </>
  );
}

/** Resumen del frontmatter en una línea, si el lector sabe decirlo (un resumen de otra forma no lo rompe). */
function ResumenFrontmatter({ el, lector }: { el: Pick<Elemento, 'frontmatter'>; lector: Lector }) {
  const { idioma } = useT();
  let texto: string | undefined;
  try {
    texto = lector.resumenLegible?.(el.frontmatter.lector.resumen, idioma);
  } catch {
    texto = undefined;
  }
  return texto ? <p className="sm muted">{texto}</p> : null;
}

/**
 * Límite de errores de la vista o la tarjeta de un lector: si su trozo no carga o falla al pintar, se enseña la
 * alternativa en su sitio (no cae la pantalla) y la próxima vez se vuelve a cargar.
 */
class LimiteLector extends Component<
  { nombre: string; alternativa: ReactNode; children: ReactNode },
  { fallo: boolean }
> {
  override state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  override componentDidCatch(error: Error): void {
    olvidarVistas(this.props.nombre);
    console.error(error);
  }

  override render() {
    return this.state.fallo ? this.props.alternativa : this.props.children;
  }
}

/** Lo que se está calculando y, si el lector lo da, cuánto lleva: «Analizando 100.000 de 340.000 líneas». */
function textoAnalizando(lector: Lector, idioma: Idioma, d: EstadoDerivado<unknown>): string {
  const progreso = d.estado === 'calculando' ? d.progreso : undefined;
  if (!progreso) return lector.textos.t(idioma, 'analizando');
  const vars = { hechas: progreso.hechas, total: progreso.total };
  // El lector puede decirlo en su unidad (líneas, filas…) con su texto `progreso`; si no, el genérico.
  return 'progreso' in lector.textos.es
    ? (lector.textos.t as (i: Idioma, c: string, v: typeof vars) => string)(idioma, 'progreso', vars)
    : traducir(idioma, 'lectores.progreso', { texto: lector.textos.t(idioma, 'analizando'), ...vars });
}

/**
 * Vista completa de un elemento: la del lector con sus derivados, o lo que se sepa mientras tanto. `editable`
 * llega a la vista (no, en la papelera).
 */
export function VistaElemento({ el, editable = true }: { el: Elemento; editable?: boolean }) {
  const { t, idioma } = useT();
  const { registro } = useLectores();
  const derivado = useDerivado(el);
  const lector = registro.paraElemento(el);
  // «Analizando» aparece pasados 400 ms y, si aparece, se queda al menos 600 ms (guía §11.1).
  const analizando = useEsperaVisible(derivado.estado === 'calculando');
  const fallo = (
    <>
      <ErrorTarjeta titulo={t('lectores.error.titulo')}>{t('lectores.error.texto')}</ErrorTarjeta>
      <Original el={el} />
    </>
  );

  if (!lector || derivado.estado === 'sin-lector') return <Original el={el} />;
  if (derivado.estado === 'error') return fallo;
  if (derivado.estado === 'calculando' || analizando)
    return (
      <>
        <div className="vista-elemento">
          <ResumenFrontmatter el={el} lector={lector} />
          {analizando && <Senal estado="analizando" etiqueta={textoAnalizando(lector, idioma, derivado)} />}
        </div>
        {/* Si el análisis tarda (un log enorme), lo común de «Detalles» ya se puede usar. Solo entonces: en los
            rápidos, aparecería y se volvería a montar con la vista un instante después. Lo de la pantalla que va antes
            (las versiones), siempre. */}
        {analizando ? <DetallesElemento refe={el.frontmatter.ref} /> : <AntesDeDetalles />}
      </>
    );
  const Vista = vistaDe(lector.nombre);
  if (!Vista) return <Original el={el} />;
  return (
    <LimiteLector key={`${lector.nombre}|${el.frontmatter.id}`} nombre={lector.nombre} alternativa={fallo}>
      <Suspense
        fallback={
          <>
            <ResumenFrontmatter el={el} lector={lector} />
            <AntesDeDetalles />
          </>
        }
      >
        <Vista el={el} datos={derivado.datos} editable={editable} />
      </Suspense>
    </LimiteLector>
  );
}

/**
 * Vista previa de un elemento en mosaico: tipo, título y ref, con la tarjeta del lector o su resumen. Con solo el
 * frontmatter (el elemento aún se está leyendo), el resumen. Con `alAbrir`, el título es el botón que lo abre y
 * toda la tarjeta se puede pulsar.
 */
export function TarjetaElemento({
  el,
  alAbrir,
}: {
  el: Elemento | Pick<Elemento, 'frontmatter'>;
  alAbrir?: (ref: string) => void;
}) {
  const { registro } = useLectores();
  const lector = registro.paraElemento(el);
  const fm = el.frontmatter;
  const completo = 'original' in el;
  const Tarjeta = lector && completo ? tarjetaDe(lector.nombre) : null;
  const resumen = lector ? <ResumenFrontmatter el={el} lector={lector} /> : null;
  return (
    <article className={clases('card tarjeta-elemento', alAbrir && 'pulsable')}>
      <div className="row">
        <IconoTipo tipo={fm.tipo} />
        {alAbrir ? (
          <button type="button" className="tarjeta-abrir sm" onClick={() => alAbrir(fm.ref)}>
            {fm.titulo}
          </button>
        ) : (
          <b className="sm">{fm.titulo}</b>
        )}
        <span className="mono xs muted">{fm.ref}</span>
      </div>
      {lector && Tarjeta && completo ? (
        <LimiteLector key={`${lector.nombre}|${fm.id}`} nombre={lector.nombre} alternativa={resumen}>
          <Suspense fallback={resumen}>
            <Tarjeta el={el} />
          </Suspense>
        </LimiteLector>
      ) : (
        resumen
      )}
    </article>
  );
}
