/**
 * Raíz de la isla de Rimor: el único árbol React de la app (ADR-0002).
 * Abre el espacio y monta el router; `#/muestras` (solo en desarrollo) se pinta fuera de la carcasa, a pantalla completa.
 */
import { RouterProvider } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { ProveedorEspacio } from '../espacio/Espacio';
import { iniciarIdioma } from '../i18n/iniciar';
import { ProveedorLectores } from '../lectores/Lectores';
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
  return (
    <ProveedorEspacio>
      <ProveedorLectores>
        <RouterProvider router={router} />
      </ProveedorLectores>
    </ProveedorEspacio>
  );
}
