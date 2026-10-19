/**
 * El feed de Inicio con lista virtual (D17, `@tanstack/react-virtual`): solo monta las filas visibles (y un margen),
 * con alturas medidas, anclado abajo como un chat y con la carga de días anteriores al llegar arriba. Pinta lo
 * que le dan; las acciones y el teclado van en `Inicio`.
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

  // Dónde empieza la lista dentro del contenedor (debajo de la cabecera y de las tarjetas de arriba).
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
    return () => observador?.disconnect();
  }, []);

  // Anclado abajo: al abrir, y cuando llega algo nuevo al final, se ve lo último.
  const ultima = filas.at(-1)?.clave;
  const total = filas.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo cuando cambia la última fila, no en cada medida.
  useEffect(() => {
    if (total) virtual.scrollToIndex(total - 1, { align: 'end' });
  }, [ultima]);

  // Días anteriores: al llegar a las primeras filas, se piden y se conserva la fila que estaba arriba.
  const items = virtual.getVirtualItems();
  const primera = items[0]?.index ?? 0;
  const anclaArriba = useRef<string | null>(null);
  useEffect(() => {
    if (!alLlegarArriba || primera > 1 || !filas.length) return;
    anclaArriba.current = filas[primera]?.clave ?? null;
    alLlegarArriba();
  }, [primera, alLlegarArriba, filas]);
  useEffect(() => {
    const clave = anclaArriba.current;
    if (!clave) return;
    const i = filas.findIndex((f) => f.clave === clave);
    if (i > 0) virtual.scrollToIndex(i, { align: 'start' });
    anclaArriba.current = null;
  }, [filas, virtual]);

  // El seleccionado con el teclado, siempre a la vista.
  useEffect(() => {
    if (!enfocado) return;
    const i = filas.findIndex((f) => f.t === 'mensaje' && f.fm.ref === enfocado);
    if (i >= 0) virtual.scrollToIndex(i, { align: 'auto' });
  }, [enfocado, filas, virtual]);

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
