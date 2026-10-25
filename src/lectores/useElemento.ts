/**
 * El elemento completo (con su original) de una fila del feed o de una tarjeta del mosaico: el repositorio solo
 * tiene en memoria el frontmatter. Se lee al montarse (las listas virtuales y el mosaico solo montan lo que se ve)
 * y se recuerda un rato, por si vuelve a la vista al desplazarse.
 */
import type { Elemento, FrontmatterComun } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { useEspacioOpcional } from '../espacio/Espacio';

/** Elementos recordados (los últimos leídos). */
const MAX_RECORDADOS = 300;
const recordados = new Map<string, Elemento>();

/**
 * El frontmatter entero: `modificado` va al segundo, y un cambio en el mismo segundo que el anterior (la ficha de un
 * enlace que llega justo después de capturarlo) no debe dejar el elemento de antes.
 */
const claveDe = (fm: FrontmatterComun) => `${fm.id}|${JSON.stringify(fm)}`;

function recordar(clave: string, el: Elemento) {
  recordados.delete(clave);
  recordados.set(clave, el);
  if (recordados.size > MAX_RECORDADOS) recordados.delete(recordados.keys().next().value as string);
}

/** Para las pruebas. */
export const olvidarElementos = () => recordados.clear();

export function useElemento(fm: FrontmatterComun): Elemento | null {
  const espacio = useEspacioOpcional();
  const clave = claveDe(fm);
  const [el, setEl] = useState<Elemento | null>(() => recordados.get(clave) ?? null);
  useEffect(() => {
    const ya = recordados.get(clave);
    if (ya) {
      setEl(ya);
      return undefined;
    }
    if (!espacio) return undefined;
    let vigente = true;
    void espacio.repositorio
      .leerElemento(fm.id)
      .then((r) => {
        if (!r.ok || !vigente) return;
        recordar(clave, r.valor);
        setEl(r.valor);
      })
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [espacio, clave, fm.id]);
  return el;
}
