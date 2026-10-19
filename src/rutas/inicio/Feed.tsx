/**
 * El feed de Inicio con lista virtual (D17, `@tanstack/react-virtual`): solo monta las filas visibles (y un margen),
 * con alturas medidas, anclado abajo como un chat y con la carga de días anteriores al llegar arriba desplazándose
 * (conservando la posición). Pinta lo que le dan; las acciones y el teclado van en `Inicio`.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { measureElement, observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FilaFeed } from './filas';

interface Props {
  filas: readonly FilaFeed[];
  /** Cómo se pinta cada fila. */
  pintar: (fila: FilaFeed) => ReactNode;
  /** El mensaje que hay que traer a la vista (el seleccionado con el teclado). */
  enfocado: string | null;
  /** Se ha llegado arriba y hay días anteriores que cargar. */
  alLlegarArriba?: () => void;
  etiqueta: string;
}

/** Alto de la vista si no se puede medir el contenedor ni la ventana. */
const ALTO_SIN_MEDIDA = 800;
/** Alto estimado de una fila antes de medirla. */
const ALTO_ESTIMADO = 150;
/** Filas que se montan por encima y por debajo de las visibles. */
const MARGEN = 6;
/** A cuántos píxeles del principio se piden los días anteriores. */
const UMBRAL_ARRIBA_PX = 300;

/** El contenedor que se desplaza: `main.amain` de la carcasa. */
const contenedorDe = (el: HTMLElement | null): HTMLElement | null =>
  (el?.closest('.amain') as HTMLElement | null) ?? null;

export function Feed({ filas, pintar, enfocado, alLlegarArriba, etiqueta }: Props) {
  const lista = useRef<HTMLDivElement>(null);
  const [margenArriba, setMargenArriba] = useState(0);
  const virtual = useVirtualizer({
    count: filas.length,
    getScrollElement: () => contenedorDe(lista.current),
    estimateSize: () => ALTO_ESTIMADO,
    overscan: MARGEN,
    scrollMargin: margenArriba,
    getItemKey: (i) => filas[i]?.clave ?? i,
    // Si el contenedor aún no tiene alto medible (antes de maquetar, o en un entorno sin maquetación), se toma el
    // de la ventana: nunca una lista vacía por medir cero.
    // Una fila que mide 0 aún no está maquetada: se queda con el alto estimado (si no, cabrían infinitas y la lista
    // montaría y mediría sin parar).
    measureElement: (elemento, entrada, instancia) => measureElement(elemento, entrada, instancia) || ALTO_ESTIMADO,
    observeElementRect: (instancia, avisar) =>
      observeElementRect(instancia, (rect) =>
        avisar(rect.height > 0 ? rect : { width: rect.width, height: globalThis.innerHeight || ALTO_SIN_MEDIDA }),
      ),
  });

  // Dónde empieza la lista dentro del contenedor (debajo de la cabecera y de las tarjetas de arriba). Se vuelve a
  // medir si cambia el contenedor o la columna (aparece o desaparece una tarjeta encima).
  useLayoutEffect(() => {
    const contenedor = contenedorDe(lista.current);
    if (!lista.current || !contenedor) return;
    const medir = () =>
      setMargenArriba(
        lista.current
          ? lista.current.getBoundingClientRect().top - contenedor.getBoundingClientRect().top + contenedor.scrollTop
          : 0,
      );
    medir();
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir);
    observador?.observe(contenedor);
    if (lista.current.parentElement) observador?.observe(lista.current.parentElement);
    return () => observador?.disconnect();
  }, []);

  // Días anteriores pedidos y aún no pintados: el alto y el desplazamiento de entonces, para conservar la posición.
  const pendiente = useRef<{ total: number; scroll: number } | null>(null);

  // Anclado abajo: al abrir, y cuando llega algo nuevo al final (no al cargar días anteriores, que van arriba).
  const ultima = filas.at(-1)?.clave;
  const total = filas.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia la última fila, no en cada medida.
  useEffect(() => {
    if (total && !pendiente.current) virtual.scrollToIndex(total - 1, { align: 'end' });
  }, [ultima]);

  // Al llegar arriba desplazándose (nunca en el primer pintado), se piden los días anteriores, de tanda en tanda.
  const pedir = useRef(alLlegarArriba);
  pedir.current = alLlegarArriba;
  useEffect(() => {
    const contenedor = contenedorDe(lista.current);
    if (!contenedor) return undefined;
    const alDesplazar = () => {
      if (!pedir.current || pendiente.current) return;
      if (contenedor.scrollTop - virtual.options.scrollMargin > UMBRAL_ARRIBA_PX) return;
      pendiente.current = { total: virtual.getTotalSize(), scroll: contenedor.scrollTop };
      pedir.current();
    };
    contenedor.addEventListener('scroll', alDesplazar, { passive: true });
    return () => contenedor.removeEventListener('scroll', alDesplazar);
  }, [virtual]);

  // Cuando llegan: lo que se añadió arriba se compensa en el desplazamiento, y la vista no se mueve.
  // biome-ignore lint/correctness/useExhaustiveDependencies: al cambiar las filas.
  useLayoutEffect(() => {
    const p = pendiente.current;
    if (!p) return;
    pendiente.current = null;
    const contenedor = contenedorDe(lista.current);
    const crecio = virtual.getTotalSize() - p.total;
    if (contenedor && crecio > 0) contenedor.scrollTop = p.scroll + crecio;
  }, [filas]);

  // El seleccionado con el teclado, a la vista; solo cuando cambia la selección (no cada vez que cambian las filas:
  // quien se ha desplazado con el ratón no vuelve allí sin pedirlo).
  const filasActuales = useRef(filas);
  filasActuales.current = filas;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia la selección.
  useEffect(() => {
    if (!enfocado) return;
    const i = filasActuales.current.findIndex((f) => f.t === 'mensaje' && f.fm.ref === enfocado);
    if (i >= 0) virtual.scrollToIndex(i, { align: 'auto' });
  }, [enfocado]);

  const items = virtual.getVirtualItems();

  return (
    <div
      ref={lista}
      className="feed-virtual"
      style={{ height: virtual.getTotalSize() }}
      aria-label={etiqueta}
      role="feed"
    >
      {items.map((v) => {
        const fila = filas[v.index];
        if (!fila) return null;
        return (
          <div
            key={v.key}
            data-index={v.index}
            ref={virtual.measureElement}
            className="fila-feed"
            style={{ transform: `translateY(${v.start - virtual.options.scrollMargin}px)` }}
          >
            {pintar(fila)}
          </div>
        );
      })}
    </div>
  );
}

/** El siguiente (o anterior) mensaje a partir del seleccionado; sin selección, el último (el más reciente). */
export function moverSeleccion(filas: readonly FilaFeed[], actual: string | null, paso: 1 | -1): string | null {
  const refs: string[] = filas.flatMap((f) => (f.t === 'mensaje' ? [f.fm.ref] : []));
  if (!refs.length) return null;
  const i = actual ? refs.indexOf(actual) : -1;
  if (i < 0) return refs[refs.length - 1] ?? null;
  return refs[Math.min(refs.length - 1, Math.max(0, i + paso))] ?? null;
}

/** El frontmatter de un mensaje del feed por su ref. */
export const mensajeDe = (filas: readonly FilaFeed[], ref: string | null): FrontmatterComun | null =>
  (ref && filas.find((f): f is Extract<FilaFeed, { t: 'mensaje' }> => f.t === 'mensaje' && f.fm.ref === ref)?.fm) ||
  null;
