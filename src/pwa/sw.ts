/**
 * Service worker de Rimor (IN-050, APP-06 y CAP-08), con la estrategia `injectManifest` de vite-plugin-pwa: precarga el
 * núcleo (todo menos DuckDB), guarda DuckDB la primera vez que se usa, sirve el `index.html` en cualquier navegación
 * (el enrutado va por hash) y recibe lo que se comparte desde otra app. Una versión nueva espera a que la app le pida
 * `SALTAR_ESPERA` (el aviso «Hay una versión nueva»).
 */
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CACHE_COMPARTIDO, esDuckdb, guardarCompartido, MARCA_COMPARTIDO, RUTA_COMPARTIR } from './compartir';

interface EventoFetch extends Event {
  readonly request: Request;
  respondWith(respuesta: Promise<Response> | Response): void;
}

// Sin la `lib` de WebWorker (chocaría con la del DOM del resto del proyecto): lo que se usa del ámbito del worker.
declare const self: {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[];
  registration: { scope: string };
  location: { origin: string };
  skipWaiting(): Promise<void>;
  addEventListener(tipo: 'fetch', oyente: (e: EventoFetch) => void): void;
  addEventListener(tipo: 'message', oyente: (e: MessageEvent) => void): void;
};

/** La `BASE` de la app (el alcance del worker), con su barra final. */
const base = new URL(self.registration.scope).pathname;

// Compartir: antes que las rutas de Workbox (que solo atienden GET).
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'POST' || new URL(e.request.url).pathname !== `${base}${RUTA_COMPARTIR}`) return;
  e.respondWith(
    (async () => {
      try {
        await guardarCompartido(await e.request.formData(), await caches.open(CACHE_COMPARTIDO), base);
      } catch {
        // Si no se pudo leer o guardar, se abre la app igual (con el compositor vacío).
      }
      return Response.redirect(`${self.location.origin}${base}?${MARCA_COMPARTIDO}`, 303);
    })(),
  );
});

self.addEventListener('message', (e) => {
  if ((e.data as { tipo?: string } | null)?.tipo === 'SALTAR_ESPERA') void self.skipWaiting();
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
// La portada se precarga con la URL del alcance (`@vite-pwa/astro` cambia `index.html` por ella).
registerRoute(new NavigationRoute(createHandlerBoundToURL(base)));
registerRoute(
  ({ url }) => esDuckdb(url.pathname),
  new CacheFirst({
    cacheName: 'rimor-wasm',
    // Los tipos de Workbox no se escribieron con `exactOptionalPropertyTypes` (sus métodos opcionales, `| undefined`).
    plugins: [new ExpirationPlugin({ maxEntries: 8 }) as never],
  }),
);
