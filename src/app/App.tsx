/**
 * Raíz de la isla de Rimor: el único árbol React de la app (ADR-0002).
 * IN-008 sustituye este esqueleto por la carcasa completa con su router.
 */
import { lazy, Suspense } from 'react';
import { iniciarIdioma } from '../i18n/iniciar';

iniciarIdioma();

// Solo en desarrollo; en producción `import.meta.env.DEV` es falso y Vite elimina el import.
const Muestras = import.meta.env.DEV ? lazy(() => import('../ui/muestras/Muestras')) : null;

export function App() {
  if (Muestras && location.hash.startsWith('#/muestras')) {
    return (
      <Suspense>
        <Muestras />
      </Suspense>
    );
  }
  return (
    <div className="carcasa">
      <nav className="rail" />
      <main className="amain" />
    </div>
  );
}
