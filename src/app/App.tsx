/**
 * Raíz de la isla de Rimor: el único árbol React de la app (ADR-0002).
 * Monta el router; `#/muestras` (solo en desarrollo) se pinta fuera de la carcasa, a pantalla completa.
 */
import { RouterProvider } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { iniciarIdioma } from '../i18n/iniciar';
import { crearRouter } from '../rutas/rutas';

iniciarIdioma();

// En producción `import.meta.env.DEV` es falso y Vite elimina el import.
const Muestras = import.meta.env.DEV ? lazy(() => import('../ui/muestras/Muestras')) : null;

export function App() {
  const [router] = useState(() => crearRouter());
  if (Muestras && location.hash.startsWith('#/muestras')) {
    return (
      <Suspense>
        <Muestras />
      </Suspense>
    );
  }
  return <RouterProvider router={router} />;
}
