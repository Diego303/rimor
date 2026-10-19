/**
 * La respuesta de Rimor a un elemento, en la interfaz (IN-016): espera a sus derivados, construye el contexto
 * y compone. `null` mientras se compone; `'desactivada'` si su tipo no tiene respuestas (D14).
 */
import type { Elemento } from '@rimor/formato';
import { useEffect, useState } from 'react';
import { respuestaDesactivada } from '../espacio/ajustes';
import { useEspacioOpcional } from '../espacio/Espacio';
import { useT } from '../i18n/useT';
import { useLectoresOpcional } from '../lectores/Lectores';
import { componer, respuestaSinDatos } from './componer';
import { construirContexto } from './contexto';
import type { Respuesta } from './tipos';

export interface OpcionesRespuesta {
  derivados?: Promise<unknown>;
  respondeA?: string;
  /** `visible` para lo que está en pantalla (un mensaje del feed): se adelanta en la cola. */
  prioridad?: 'visible' | 'fondo';
}

export function useRespuesta(el: Elemento, opciones: OpcionesRespuesta = {}): Respuesta | null | 'desactivada' {
  const { idioma } = useT();
  const espacio = useEspacioOpcional();
  const lectores = useLectoresOpcional();
  const tipo = el.frontmatter.tipo;
  const [desactivada, setDesactivada] = useState(() =>
    espacio ? respuestaDesactivada(espacio.ajustes(), tipo) : false,
  );
  // Los ajustes pueden cambiar (Ajustes, otra pestaña): se vuelve a mirar con cada aviso del espacio.
  useEffect(() => {
    if (!espacio) return undefined;
    const mirar = () => setDesactivada(respuestaDesactivada(espacio.ajustes(), tipo));
    mirar();
    return espacio.alCambiar(mirar);
  }, [espacio, tipo]);
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const { derivados, respondeA, prioridad = 'fondo' } = opciones;

  useEffect(() => {
    if (desactivada) return undefined;
    let vigente = true;
    // Si se desmonta (un mensaje que sale de la lista virtual), su petición se retira de la cola.
    const cancelar = new AbortController();
    setRespuesta(null);
    const lector = lectores?.registro.paraElemento(el);
    (async () => {
      if (!lector || !lectores || !espacio) return respuestaSinDatos(el, idioma);
      const datos = await (derivados ?? lectores.cola.pedir(el, { prioridad, senal: cancelar.signal }));
      // La huella y lo demás salen del resumen definitivo, el de los derivados.
      let resumen: Record<string, unknown> | undefined;
      try {
        resumen = lector.resumen(datos);
      } catch {
        resumen = undefined;
      }
      const ctx = await construirContexto(el, espacio.repositorio, idioma, {
        ...(respondeA ? { respondeA } : {}),
        ...(resumen ? { resumen } : {}),
      });
      return componer(el, lector, datos, ctx);
    })()
      .catch(() => respuestaSinDatos(el, idioma))
      .then((r) => vigente && setRespuesta(r));
    return () => {
      vigente = false;
      cancelar.abort();
    };
  }, [el, derivados, respondeA, prioridad, idioma, desactivada, lectores, espacio]);

  return desactivada ? 'desactivada' : respuesta;
}
