/** Rutas de la app (D6, ADR-0002): TanStack Router con historial por hash y pantallas en carga diferida. */
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  type RouterHistory,
} from '@tanstack/react-router';
import { Carcasa } from './Carcasa';

const raiz = createRootRoute({ component: Carcasa });

const inicio = createRoute({
  getParentRoute: () => raiz,
  path: '/',
  component: lazyRouteComponent(() => import('./inicio/Inicio'), 'Inicio'),
});
const elemento = createRoute({
  getParentRoute: () => raiz,
  path: '/e/$ref',
  component: lazyRouteComponent(() => import('./elemento/Elemento'), 'Elemento'),
});
const hilo = createRoute({
  getParentRoute: () => raiz,
  path: '/hilo/$ref',
  component: lazyRouteComponent(() => import('./hilo/Hilo'), 'Hilo'),
});
const buscar = createRoute({
  getParentRoute: () => raiz,
  path: '/buscar',
  validateSearch: (s: Record<string, unknown>): { q?: string } => (typeof s.q === 'string' ? { q: s.q } : {}),
  component: lazyRouteComponent(() => import('./buscar/Buscar'), 'Buscar'),
});
const coleccion = createRoute({
  getParentRoute: () => raiz,
  path: '/c/$coleccion',
  component: lazyRouteComponent(() => import('./coleccion/Coleccion'), 'Coleccion'),
});
const datos = createRoute({
  getParentRoute: () => raiz,
  path: '/datos',
  component: lazyRouteComponent(() => import('./datos/Datos'), 'Datos'),
});
const ajustes = createRoute({
  getParentRoute: () => raiz,
  path: '/ajustes',
  component: lazyRouteComponent(() => import('./ajustes/Ajustes'), 'Ajustes'),
});

const arbol = raiz.addChildren([inicio, elemento, hilo, buscar, coleccion, datos, ajustes]);

/** Crea el router; las pruebas pasan un historial en memoria. */
export function crearRouter(historial: RouterHistory = createHashHistory()) {
  return createRouter({ routeTree: arbol, history: historial, defaultPreload: 'intent' });
}

export type RouterRimor = ReturnType<typeof crearRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: RouterRimor;
  }
}
