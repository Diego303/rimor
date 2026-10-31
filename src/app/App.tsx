/**
 * Raíz de la isla de Rimor: el único árbol React de la app (ADR-0002).
 * Abre el espacio y monta el router; `#/muestras` (solo en desarrollo) se pinta fuera de la carcasa, a pantalla completa.
 */
import { RouterProvider } from '@tanstack/react-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ProveedorBusqueda } from '../busqueda/Busqueda';
import { ProveedorEspacio } from '../espacio/Espacio';
// El aviso de instalar llega una vez y pronto: se escucha desde el arranque, no desde una pantalla diferida.
import '../espacio/instalar';
import { iniciarIdioma } from '../i18n/iniciar';
import { ProveedorLectores } from '../lectores/Lectores';
import { recibirCompartido } from '../pwa/recibir';
import { registrarServiceWorker } from '../pwa/registrar';
import { crearRouter } from '../rutas/rutas';

iniciarIdioma();
// Sin conexión, instalación y versiones nuevas (IN-050): el service worker, desde el arranque.
registrarServiceWorker();

// En producción `import.meta.env.DEV` es falso y Vite elimina el import.
const Muestras = import.meta.env.DEV ? lazy(() => import('../ui/muestras/Muestras')) : null;

export function App() {
  const [router] = useState(() => crearRouter());
  // Abierta desde «Compartir» en otra app: lo compartido, al compositor (IN-050).
  useEffect(() => {
    void recibirCompartido(import.meta.env.BASE_URL.replace(/\/?$/, '/')).catch(() => false);
  }, []);
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
        <ProveedorBusqueda>
          <RouterProvider router={router} />
        </ProveedorBusqueda>
      </ProveedorLectores>
    </ProveedorEspacio>
  );
}
