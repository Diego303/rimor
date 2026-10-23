/**
 * Instalar Rimor como app (APP-03): el navegador avisa con `beforeinstallprompt` cuando se puede (con la PWA de
 * IN-050). Se guarda el aviso y se ofrece en la bienvenida; sin él, no se ofrece nada.
 */
import { create } from 'zustand';

interface AvisoInstalacion extends Event {
  prompt(): Promise<void>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const useInstalacion = create<{ aviso: AvisoInstalacion | null }>(() => ({ aviso: null }));

if (typeof window !== 'undefined')
  window.addEventListener('beforeinstallprompt', (e) => {
    // Se guarda para ofrecerlo en el momento oportuno, no en la barra del navegador.
    e.preventDefault();
    useInstalacion.setState({ aviso: e as AvisoInstalacion });
  });

/** Abre el diálogo de instalar del navegador (una vez: después el aviso ya no vale). */
export async function instalar(): Promise<void> {
  const { aviso } = useInstalacion.getState();
  if (!aviso) return;
  useInstalacion.setState({ aviso: null });
  await aviso.prompt().catch(() => undefined);
}
