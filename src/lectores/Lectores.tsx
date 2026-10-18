/**
 * Lectores en la interfaz (IN-012, VIS-01): el proveedor con el registro y la cola de derivados, y los
 * contenedores `VistaElemento` y `TarjetaElemento`, que pintan la vista de cada lector en diferido.
 */
import type { Elemento } from '@rimor/formato';
import { createContext, type ReactNode, Suspense, useContext, useEffect, useState } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';
import { useT } from '../i18n/useT';
import { ErrorTarjeta, IconoTipo } from '../ui/componentes';
import { Senal } from '../ui/marca/Senal';
import { useEsperaVisible } from '../ui/marca/useEsperaVisible';
import type { Lector } from './contrato';
import { ColaDerivados, type Ejecutor, esCancelado } from './derivados';
import { crearEjecutor } from './ejecutor';
import { REGISTRO, type Registro } from './registro';
import { tarjetaDe, vistaDe } from './vistas';

interface ValorLectores {
  registro: Registro;
  cola: ColaDerivados;
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
 * Registro y cola de derivados para las pantallas. La cola usa la caché del espacio y, cuando un derivado
 * nuevo cambia el resumen o la versión del lector, pone al día el frontmatter (solo la pestaña que escribe y
 * solo si el archivo sigue siendo el mismo).
 */
export function ProveedorLectores({ children, registro = REGISTRO, ejecutar }: PropsProveedor) {
  const espacio = useEspacioOpcional();
  const [valor, setValor] = useState<ValorLectores | null>(null);

  useEffect(() => {
    const ejecutor = ejecutar ? { ejecutar, cerrar: () => undefined } : crearEjecutor(registro);
    const repositorio = espacio?.repositorio;
    const nueva = new ColaDerivados({
      registro,
      ejecutar: ejecutor.ejecutar,
      ...(espacio ? { cache: espacio.cache } : {}),
      alDerivar: (el, lector, datos) => void ponerAlDia(el, lector, datos),
    });
    async function ponerAlDia(el: Elemento, lector: Lector, datos: unknown) {
      if (!repositorio || espacio?.coordinacion.modo() !== 'escritor') return;
      const resumen = lector.resumen(datos);
      const fm = el.frontmatter;
      if (
        fm.lector.nombre === lector.nombre &&
        fm.lector.version === lector.version &&
        mismoResumen(fm.lector.resumen, resumen)
      )
        return;
      // Se relee: si el archivo cambió desde que se pidió el derivado, este ya no le corresponde.
      const actual = await repositorio.leerElemento(fm.id);
      if (!actual.ok || actual.valor.frontmatter.hash !== fm.hash) return;
      await repositorio
        .guardarElemento({
          ...actual.valor,
          frontmatter: {
            ...actual.valor.frontmatter,
            lector: { nombre: lector.nombre, version: lector.version, resumen },
          },
        })
        .catch(() => undefined);
    }
    setValor({ registro, cola: nueva });
    return () => ejecutor.cerrar();
  }, [registro, ejecutar, espacio]);

  return valor ? <Contexto.Provider value={valor}>{children}</Contexto.Provider> : null;
}

export function useLectores(): ValorLectores {
  const v = useContext(Contexto);
  if (!v) throw new Error('useLectores necesita un ProveedorLectores');
  return v;
}

export type EstadoDerivado<D> =
  | { estado: 'calculando' }
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
      .pedir<D>(el, { prioridad: 'visible', senal: parar.signal })
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

/** El original tal cual, para cuando no hay lector, ni vista, o el lector falla. */
function Original({ el }: { el: Elemento }) {
  return <pre className="code">{el.original ?? ''}</pre>;
}

/** Resumen del frontmatter en una línea, si el lector sabe decirlo. */
function ResumenFrontmatter({ el, lector }: { el: Elemento; lector: Lector }) {
  const { idioma } = useT();
  const texto = lector.resumenLegible?.(el.frontmatter.lector.resumen, idioma);
  return texto ? <p className="sm muted">{texto}</p> : null;
}

/** «Analizando» con lo que calcula el lector, pasados 400 ms. */
function Analizando({ lector }: { lector: Lector }) {
  const { idioma } = useT();
  const visible = useEsperaVisible(true);
  return visible ? <Senal estado="analizando" etiqueta={lector.textos.t(idioma, 'analizando')} /> : null;
}

/** Vista completa de un elemento: la del lector con sus derivados, o lo que se sepa mientras tanto. */
export function VistaElemento({ el }: { el: Elemento }) {
  const { t } = useT();
  const { registro } = useLectores();
  const derivado = useDerivado(el);
  const lector = registro.paraElemento(el);

  if (!lector || derivado.estado === 'sin-lector') return <Original el={el} />;
  if (derivado.estado === 'error')
    return (
      <>
        <ErrorTarjeta titulo={t('lectores.error.titulo')}>{t('lectores.error.texto')}</ErrorTarjeta>
        <Original el={el} />
      </>
    );
  if (derivado.estado === 'calculando')
    return (
      <div className="vista-elemento">
        <ResumenFrontmatter el={el} lector={lector} />
        <Analizando lector={lector} />
      </div>
    );
  const Vista = vistaDe(lector.nombre);
  if (!Vista) return <Original el={el} />;
  return (
    <Suspense fallback={<ResumenFrontmatter el={el} lector={lector} />}>
      <Vista el={el} datos={derivado.datos} />
    </Suspense>
  );
}

/** Vista previa de un elemento en mosaico: tipo, título y ref, con la tarjeta del lector o su resumen. */
export function TarjetaElemento({ el }: { el: Elemento }) {
  const { registro } = useLectores();
  const lector = registro.paraElemento(el);
  const fm = el.frontmatter;
  const Tarjeta = lector ? tarjetaDe(lector.nombre) : null;
  const resumen = lector ? <ResumenFrontmatter el={el} lector={lector} /> : null;
  return (
    <article className="card tarjeta-elemento">
      <div className="row">
        <IconoTipo tipo={fm.tipo} />
        <b className="sm">{fm.titulo}</b>
        <span className="mono xs muted">{fm.ref}</span>
      </div>
      {Tarjeta ? (
        <Suspense fallback={resumen}>
          <Tarjeta el={el} />
        </Suspense>
      ) : (
        resumen
      )}
    </article>
  );
}
