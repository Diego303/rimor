/**
 * Una animación en bucle por zona (IN-090, guía §11: «nunca dos animaciones en bucle a la vez en la misma
 * pantalla»): cuando varias esperas la piden a la vez (las respuestas de un feed que se componen, una exportación
 * con Ctrl+E mientras Buscar indexa), solo una la enseña; las demás, su reposo con el texto. Tiene el turno la de
 * más prioridad y, entre iguales, la que lo pidió antes; al acabar (o a los 20 s, cuando todo bucle se para), pasa
 * a la siguiente.
 */
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { LIMITE_BUCLE_MS } from './estadosSenal';

interface Peticion {
  id: string;
  prioridad: number;
  orden: number;
}

/**
 * La espera de lo que se está mirando (el contenido de la pantalla, la respuesta a lo recién capturado) va antes que
 * las secundarias (las respuestas antiguas de un feed, el piloto del raíl).
 */
export const PRIORIDAD_BUCLE = { principal: 1, secundaria: 0 } as const;

/** La zona de toda la pantalla: solo se ve una pantalla a la vez. */
export const ZONA_PANTALLA = 'pantalla';

const zonas = new Map<string, Peticion[]>();
const oyentes = new Set<() => void>();
let siguienteOrden = 0;

function avisar() {
  for (const o of [...oyentes]) o();
}

function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

/** Quién tiene el turno de una zona ahora mismo. */
export function turnoDe(zona: string): string | undefined {
  const lista = zonas.get(zona);
  if (!lista?.length) return undefined;
  return lista.reduce((a, b) =>
    b.prioridad > a.prioridad || (b.prioridad === a.prioridad && b.orden < a.orden) ? b : a,
  ).id;
}

export function pedirTurno(zona: string, id: string, prioridad: number): () => void {
  const lista = zonas.get(zona) ?? [];
  lista.push({ id, prioridad, orden: siguienteOrden++ });
  zonas.set(zona, lista);
  avisar();
  return () => {
    const resto = (zonas.get(zona) ?? []).filter((p) => p.id !== id);
    if (resto.length) zonas.set(zona, resto);
    else zonas.delete(zona);
    avisar();
  };
}

/**
 * De una `Senal`: `principal` (la espera del contenido), `secundaria` (cede ante las demás: el piloto del raíl) o
 * `sinTurno` (el turno ya lo ha pedido el contenedor, como la respuesta de Rimor).
 */
export type PrioridadSenal = 'principal' | 'secundaria' | 'sinTurno';

/** `true` si el bucle de una `Senal` debe quedarse en su reposo porque otro tiene el turno. */
export function useSinTurno(bucle: boolean, prioridad: PrioridadSenal): boolean {
  const pide = bucle && prioridad !== 'sinTurno';
  const turno = useTurnoBucle(pide, PRIORIDAD_BUCLE[prioridad === 'secundaria' ? prioridad : 'principal']);
  return pide && !turno;
}

/**
 * `true` si esta espera, activa, es la que enseña la animación de su zona. A los 20 s de pedirlo lo suelta aunque siga
 * activa (una espera atascada no deja sin animación a las demás).
 */
export function useTurnoBucle(activo: boolean, prioridad = 0, zona = ZONA_PANTALLA): boolean {
  const id = useId();
  const [agotado, setAgotado] = useState(false);
  useEffect(() => {
    setAgotado(false);
    if (!activo) return undefined;
    const limite = setTimeout(() => setAgotado(true), LIMITE_BUCLE_MS);
    return () => clearTimeout(limite);
  }, [activo]);
  const pide = activo && !agotado;
  useEffect(() => (pide ? pedirTurno(zona, id, prioridad) : undefined), [zona, id, pide, prioridad]);
  const turno = useSyncExternalStore(
    suscribir,
    () => turnoDe(zona),
    () => undefined,
  );
  return pide && turno === id;
}
