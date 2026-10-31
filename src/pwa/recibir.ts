/**
 * Al abrir la app desde «Compartir» (`?compartido`, IN-050): lo que guardó el service worker pasa al compositor, como
 * un pegado (se guarda con Enter), y la URL vuelve a estar limpia (al recargar no se vuelve a recoger).
 */
import { useCompositor } from '../captura/compositor';
import { CACHE_COMPARTIDO, type CacheMinima, MARCA_COMPARTIDO, recogerCompartido } from './compartir';

interface Entorno {
  location: Pick<Location, 'search' | 'pathname' | 'hash'>;
  history: Pick<History, 'replaceState'>;
  caches?: { open(nombre: string): Promise<CacheMinima> };
}

/** Si se abrió con `?compartido`, rellena el compositor con lo compartido. Devuelve si había algo. */
export async function recibirCompartido(base: string, entorno: Entorno = globalThis as unknown as Entorno) {
  const marcas = new URLSearchParams(entorno.location.search);
  if (!marcas.has(MARCA_COMPARTIDO)) return false;
  marcas.delete(MARCA_COMPARTIDO);
  const resto = marcas.toString();
  entorno.history.replaceState(
    null,
    '',
    `${entorno.location.pathname}${resto ? `?${resto}` : ''}${entorno.location.hash}`,
  );
  if (!entorno.caches) return false;
  const compartido = await recogerCompartido(await entorno.caches.open(CACHE_COMPARTIDO), base).catch(() => null);
  if (!compartido) return false;
  useCompositor.getState().recibir(compartido.texto, compartido.archivos);
  return true;
}
