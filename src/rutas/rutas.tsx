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
import { NoEncontrada } from './NoEncontrada';
import { type Vista, vistaDe } from './vistas/orden';

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
/** La vista de un grupo en la dirección (`?vista=mosaico`); la lista, que es la de siempre, no se escribe. */
const conVista = (s: Record<string, unknown>): { vista?: Vista } => {
  const vista = vistaDe(s.vista);
  return vista === 'lista' ? {} : { vista };
};

const buscar = createRoute({
  getParentRoute: () => raiz,
  path: '/buscar',
  // La dirección se lee como JSON: `?q=404` llega como número.
  validateSearch: (s: Record<string, unknown>): { q?: string; vista?: Vista } => ({
    ...(['string', 'number', 'boolean'].includes(typeof s.q) ? { q: String(s.q) } : {}),
    ...conVista(s),
  }),
  component: lazyRouteComponent(() => import('./buscar/Buscar'), 'Buscar'),
});
const coleccion = createRoute({
  getParentRoute: () => raiz,
  path: '/c/$coleccion',
  validateSearch: (s: Record<string, unknown>): { vista?: Vista } => conVista(s),
  component: lazyRouteComponent(() => import('./coleccion/Coleccion'), 'Coleccion'),
});
const datos = createRoute({
  getParentRoute: () => raiz,
  path: '/datos',
  component: lazyRouteComponent(() => import('./datos/Datos'), 'Datos'),
});
const papelera = createRoute({
  getParentRoute: () => raiz,
  path: '/papelera',
  component: lazyRouteComponent(() => import('./papelera/Papelera'), 'Papelera'),
});
const ajustes = createRoute({
  getParentRoute: () => raiz,
  path: '/ajustes',
  component: lazyRouteComponent(() => import('./ajustes/Ajustes'), 'Ajustes'),
});

const arbol = raiz.addChildren([inicio, elemento, hilo, buscar, coleccion, datos, papelera, ajustes]);

/** Crea el router; las pruebas pasan un historial en memoria. */
export function crearRouter(historial: RouterHistory = createHashHistory()) {
  return createRouter({
    routeTree: arbol,
    history: historial,
    defaultPreload: 'intent',
    defaultNotFoundComponent: NoEncontrada,
  });
}

export type RouterRimor = ReturnType<typeof crearRouter>;

declare module '@tanstack/react-router' {
  interface Register {
    router: RouterRimor;
  }
}
