/**
 * Las vistas de un grupo de elementos (VIS-02, VIS-03): el selector «Lista · Mosaico · Densa», el mosaico de
 * tarjetas agrupado con cabeceras y recuentos, y la lista densa en columnas, ordenable y virtual. Las usan la
 * colección y Buscar; la lista de siempre la pinta cada pantalla.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { estadoVisible, tonoDeEstado } from '../../espacio/estados';
import { fmtDia, fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { TarjetaElemento, useLectoresOpcional } from '../../lectores/Lectores';
import { nombreDeEstado } from '../../lectores/nombreEstado';
import { useElemento } from '../../lectores/useElemento';
import { Boton, Estado, IconoTipo, Segmentado } from '../../ui/componentes';
import { claveDia, etiquetaDia } from '../inicio/filas';
import {
  type AgruparPor,
  agruparMosaico,
  COLUMNAS_DENSA,
  type ColumnaDensa,
  ORDEN_INICIAL,
  type OrdenDensa,
  ordenarDensa,
  siguienteOrden,
  type Vista,
} from './orden';

export function SelectorVista({ vista, alCambiar }: { vista: Vista; alCambiar: (v: Vista) => void }) {
  const { t } = useT();
  return (
    <Segmentado
      etiqueta={t('vistas.etiqueta')}
      valor={vista}
      alCambiar={alCambiar}
      opciones={[
        { valor: 'lista', etiqueta: t('vistas.lista') },
        { valor: 'mosaico', etiqueta: t('vistas.mosaico') },
        { valor: 'densa', etiqueta: t('vistas.densa') },
      ]}
    />
  );
}

interface PropsVista {
  elementos: readonly FrontmatterComun[];
  alAbrir: (ref: string) => void;
}

/** Tarjetas que se pintan de una vez (cada una lee su elemento); «Ver más» añade otras tantas. */
export const TARJETAS_POR_TANDA = 60;

/** La tarjeta de un elemento: con su resumen mientras se lee y con la del lector cuando llega. */
function Tarjeta({ fm, alAbrir }: { fm: FrontmatterComun; alAbrir: (ref: string) => void }) {
  const el = useElemento(fm);
  return <TarjetaElemento el={el ?? { frontmatter: fm }} alAbrir={alAbrir} />;
}

/** Mosaico agrupado (VIS-02): por tipo o por día, cada grupo con su cabecera y su recuento. */
export function Mosaico({ elementos, alAbrir }: PropsVista) {
  const { t, idioma } = useT();
  const [por, setPor] = useState<AgruparPor>('tipo');
  const [cuantas, setCuantas] = useState(TARJETAS_POR_TANDA);
  const grupos = useMemo(() => agruparMosaico(elementos, por, (fm) => claveDia(fm.creado)), [elementos, por]);
  const ahora = new Date();
  const nombre = (clave: string) =>
    por === 'tipo'
      ? t(`tipos.${clave as FrontmatterComun['tipo']}`)
      : etiquetaDia(clave, ahora, idioma, { hoy: t('pantallas.inicio.hoy'), ayer: t('pantallas.inicio.ayer') });

  // Las primeras `cuantas` tarjetas, en el orden de los grupos.
  let quedan = cuantas;
  const visibles = grupos
    .map(([clave, lista]) => {
      const parte = lista.slice(0, Math.max(quedan, 0));
      quedan -= parte.length;
      return { clave, total: lista.length, parte };
    })
    .filter((g) => g.parte.length > 0);
  const sinPintar = elementos.length - Math.min(cuantas, elementos.length);

  return (
    <div className="vista-mosaico">
      <div className="row">
        <span className="xs muted">{t('vistas.agrupar')}</span>
        <Segmentado
          etiqueta={t('vistas.agrupar')}
          valor={por}
          alCambiar={setPor}
          opciones={[
            { valor: 'tipo', etiqueta: t('vistas.porTipo') },
            { valor: 'fecha', etiqueta: t('vistas.porFecha') },
          ]}
        />
      </div>
      {visibles.map((g) => (
        <section key={g.clave} className="grupo-mosaico" aria-label={nombre(g.clave)}>
          <h3 className="lbl">
            {nombre(g.clave)} · {g.total}
          </h3>
          <div className="mosaico">
            {g.parte.map((fm) => (
              <Tarjeta key={fm.id} fm={fm} alAbrir={alAbrir} />
            ))}
          </div>
        </section>
      ))}
      {sinPintar > 0 && (
        <Boton variante="fantasma" pequeno onClick={() => setCuantas((n) => n + TARJETAS_POR_TANDA)}>
          {t('vistas.verMas', { n: sinPintar })}
        </Boton>
      )}
    </div>
  );
}

/** Alto de una fila de la lista densa (una línea). */
const ALTO_FILA = 38;
/** Filas que se montan por encima y por debajo de las visibles. */
const MARGEN_FILAS = 8;

/** Lista densa (VIS-03): columnas ordenables y solo las filas que se ven montadas. */
export function ListaDensa({ elementos, alAbrir }: PropsVista) {
  const { t, idioma } = useT();
  const lectores = useLectoresOpcional();
  const [orden, setOrden] = useState<OrdenDensa>(ORDEN_INICIAL);
  const [foco, setFoco] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const enfocar = useRef(false);

  const estadoDe = useMemo(
    () => (fm: FrontmatterComun) => {
      const lector = lectores?.registro.paraElemento({ frontmatter: fm });
      const estado = estadoVisible(fm.estado, lector);
      return { estado, nombre: nombreDeEstado(estado, lector, idioma) };
    },
    [lectores, idioma],
  );
  const filas = useMemo(
    () =>
      ordenarDensa(elementos, orden, {
        tipo: (fm) => t(`tipos.${fm.tipo}`),
        estado: (fm) => estadoDe(fm).nombre,
        idioma,
      }),
    [elementos, orden, t, estadoDe, idioma],
  );

  const virtual = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedor.current,
    estimateSize: () => ALTO_FILA,
    overscan: MARGEN_FILAS,
    // Sin un alto medible (antes de maquetar, o sin maquetación), el de la ventana: nunca una lista vacía.
    observeElementRect: (instancia, avisar) => {
      const el = instancia.scrollElement;
      if (!el) return undefined;
      const medir = () => {
        const rect = el.getBoundingClientRect();
        avisar({ width: rect.width, height: rect.height || globalThis.innerHeight || 800 });
      };
      medir();
      const observador = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
      observador?.observe(el);
      return () => observador?.disconnect();
    },
  });

  // Tras mover el foco con las flechas, la fila ya está montada: se enfoca.
  useEffect(() => {
    if (!enfocar.current) return;
    enfocar.current = false;
    contenedor.current?.querySelector<HTMLElement>(`tr[data-indice="${foco}"]`)?.focus();
  });

  const mover = (i: number) => {
    const j = Math.min(Math.max(i, 0), filas.length - 1);
    setFoco(j);
    enfocar.current = true;
    virtual.scrollToIndex(j, { align: 'auto' });
  };

  const items = virtual.getVirtualItems();
  const arriba = items[0]?.start ?? 0;
  const abajo = virtual.getTotalSize() - (items.at(-1)?.end ?? 0);
  const ahora = new Date();
  const sentidoAria = (c: ColumnaDensa) =>
    orden.columna !== c ? undefined : orden.sentido === 'asc' ? 'ascending' : 'descending';

  return (
    <div ref={contenedor} className="tbl-wrap lista-densa">
      <table>
        <caption className="solo-lector">{t('vistas.densa')}</caption>
        <thead>
          <tr>
            {COLUMNAS_DENSA.map((c) => (
              <th key={c} scope="col" aria-sort={sentidoAria(c)}>
                <button type="button" className="th-orden" onClick={() => setOrden((o) => siguienteOrden(o, c))}>
                  {t(`vistas.columnas.${c}`)}
                  {orden.columna === c && <span aria-hidden="true">{orden.sentido === 'asc' ? ' ↑' : ' ↓'}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {arriba > 0 && (
            <tr className="espaciador" style={{ height: arriba }}>
              <td colSpan={COLUMNAS_DENSA.length} aria-hidden="true" />
            </tr>
          )}
          {items.map((item) => {
            const fm = filas[item.index];
            if (!fm) return null;
            const { estado, nombre } = estadoDe(fm);
            const tono = tonoDeEstado(estado);
            const fecha = new Date(fm.creado);
            return (
              <tr
                key={fm.id}
                data-indice={item.index}
                className="click"
                tabIndex={item.index === foco ? 0 : -1}
                onClick={() => alAbrir(fm.ref)}
                onFocus={() => setFoco(item.index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') alAbrir(fm.ref);
                  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    mover(item.index + (e.key === 'ArrowDown' ? 1 : -1));
                  } else if (e.key === 'Home' || e.key === 'End') {
                    e.preventDefault();
                    mover(e.key === 'Home' ? 0 : filas.length - 1);
                  }
                }}
              >
                <td>
                  <span className="row inline">
                    <IconoTipo tipo={fm.tipo} denso />
                    <span className="xs muted">{t(`tipos.${fm.tipo}`)}</span>
                  </span>
                </td>
                <td className="densa-titulo">
                  <b className="sm">{fm.titulo}</b> <span className="mono xs muted">{fm.ref}</span>
                </td>
                <td className="n">
                  {Number.isNaN(fecha.getTime()) ? '' : `${fmtDia(fecha, ahora, idioma)} ${fmtHora(fecha)}`}
                </td>
                <td className="xs">{(fm.colecciones ?? []).join(', ')}</td>
                <td>
                  <Estado tono={tono}>{nombre}</Estado>
                </td>
              </tr>
            );
          })}
          {abajo > 0 && (
            <tr className="espaciador" style={{ height: abajo }}>
              <td colSpan={COLUMNAS_DENSA.length} aria-hidden="true" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
