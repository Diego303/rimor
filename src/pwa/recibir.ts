/**
 * Al abrir la app desde «Compartir» (`?compartido`, IN-050): lo que guardó el service worker pasa al compositor, como
 * un pegado (se guarda con Enter), y la URL vuelve a estar limpia (al recargar no se vuelve a recoger). En una pestaña
 * que solo lee no se recoge (no se podría guardar): se queda en la caché para cuando pueda escribir.
 */
import { useCompositor } from '../captura/compositor';
import { CACHE_COMPARTIDO, type CacheMinima, MARCA_COMPARTIDO, recogerCompartido, VALOR_ERROR } from './compartir';

interface Entorno {
  location: Pick<Location, 'search' | 'pathname' | 'hash'>;
  history: Pick<History, 'replaceState' | 'state'>;
  caches?: { open(nombre: string): Promise<CacheMinima> };
}

export type Recibido = 'nada' | 'recogido' | 'vacio' | 'soloLectura' | 'error';

/** Quita `?compartido` de la URL sin tocar el estado del historial (el del enrutado por hash). */
function limpiar(entorno: Entorno, marcas: URLSearchParams): void {
  marcas.delete(MARCA_COMPARTIDO);
  const resto = marcas.toString();
  entorno.history.replaceState(
    entorno.history.state,
    '',
    `${entorno.location.pathname}${resto ? `?${resto}` : ''}${entorno.location.hash}`,
  );
}

/** Si se abrió con `?compartido`, rellena el compositor con lo compartido. */
export async function recibirCompartido(
  base: string,
  { soloLectura = false }: { soloLectura?: boolean } = {},
  entorno: Entorno = globalThis as unknown as Entorno,
): Promise<Recibido> {
  const marcas = new URLSearchParams(entorno.location.search);
  if (!marcas.has(MARCA_COMPARTIDO)) return 'nada';
  if (marcas.get(MARCA_COMPARTIDO) === VALOR_ERROR) {
    limpiar(entorno, marcas);
    return 'error';
  }
  if (soloLectura) return 'soloLectura';
  limpiar(entorno, marcas);
  if (!entorno.caches) return 'vacio';
  const compartido = await recogerCompartido(await entorno.caches.open(CACHE_COMPARTIDO), base).catch(() => undefined);
  if (compartido === undefined) return 'error';
  if (!compartido) return 'vacio';
  useCompositor.getState().recibir(compartido.texto, compartido.archivos);
  return 'recogido';
}
