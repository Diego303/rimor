/**
 * Aprender de una corrección del tipo (CAP-06, IN-049): la anota en las reglas del espacio y, si con ella ya son tres
 * con la misma firma, deja la propuesta en el feed. Lo usan «Cambiar tipo» (en el elemento y en el feed) y la captura
 * con un `/tipo` que contradice al detector.
 */
import { isoConZona, type TipoElemento } from '@rimor/formato';
import type { EspacioAbierto } from '../espacio/abrir';
import { useCompositor } from './compositor';
import { anotarCorreccion, firmaDe, type Propuesta } from './reglas';

/** Anota la corrección de `texto` (el original; sin él, nada) a `tipo`; devuelve la propuesta, si la hay. */
export function aprenderCorreccion(
  espacio: Pick<EspacioAbierto, 'guardarReglas'>,
  texto: string | null | undefined,
  tipo: TipoElemento,
  ahora: Date = new Date(),
): Propuesta | null {
  // Sin firma no hay nada que aprender (ni que escribir).
  if (!texto || !firmaDe(texto)) return null;
  const en = isoConZona(ahora);
  const salida: { propuesta: Propuesta | null } = { propuesta: null };
  // `guardarReglas` aplica el cambio al momento; la escritura va detrás (si falla, la corrección vive en memoria).
  espacio
    .guardarReglas((d) => {
      const r = anotarCorreccion(d, texto, tipo, en);
      salida.propuesta = r.propuesta;
      return r.datos;
    })
    .catch(() => undefined);
  if (salida.propuesta) useCompositor.getState().anotarPropuesta({ ...salida.propuesta, en });
  return salida.propuesta;
}
