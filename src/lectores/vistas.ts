/**
 * Vistas de los lectores por convención de carpeta (IN-012): `src/lectores/<nombre>/Vista.tsx` y `Tarjeta.tsx`,
 * con export por defecto, se cargan en diferido (`React.lazy`) la primera vez que se pintan. Una carpeta que
 * empieza por `_` (la plantilla) sirve con su nombre sin el guion bajo.
 */
import { type ComponentType, type LazyExoticComponent, lazy } from 'react';
import type { PropsTarjeta, PropsVista } from './contrato';

type Modulo<P> = () => Promise<{ default: ComponentType<P> }>;

// biome-ignore lint/suspicious/noExplicitAny: cada lector tipa sus propios datos; aquí da igual cuáles.
const VISTAS = import.meta.glob<{ default: ComponentType<PropsVista<any>> }>('./*/Vista.tsx');
const TARJETAS = import.meta.glob<{ default: ComponentType<PropsTarjeta> }>('./*/Tarjeta.tsx');

/** `./log/Vista.tsx` → `log`; `./_plantilla/Vista.tsx` → `plantilla`. */
export const carpetaDe = (ruta: string): string => (ruta.split('/')[1] ?? '').replace(/^_/, '');

function porCarpeta<P>(modulos: Record<string, Modulo<P>>) {
  const cargadores = new Map(Object.entries(modulos).map(([ruta, cargar]) => [carpetaDe(ruta), cargar]));
  const hechos = new Map<string, LazyExoticComponent<ComponentType<P>>>();
  return (nombre: string): LazyExoticComponent<ComponentType<P>> | null => {
    const cargar = cargadores.get(nombre);
    if (!cargar) return null;
    let c = hechos.get(nombre);
    if (!c) {
      c = lazy(cargar);
      hechos.set(nombre, c);
    }
    return c;
  };
}

/** Vista completa del lector `nombre`, o `null` si no tiene. */
export const vistaDe = porCarpeta<PropsVista<unknown>>(VISTAS);

/** Tarjeta del lector `nombre`, o `null` si no tiene. */
export const tarjetaDe = porCarpeta<PropsTarjeta>(TARJETAS);
