/**
 * Carcasa de la app (APP-01, APP-05): raíl, área principal con la pantalla activa, atajos globales,
 * avisos efímeros y límite de errores por pantalla.
 */
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n/useT';
import { AyudaAtajos } from '../ui/atajos/AyudaAtajos';
import { esCampoDeTexto, GestorAtajos } from '../ui/atajos/atajos';
import { ContextoAtajos } from '../ui/atajos/useAtajos';
import { Espera, ProveedorAvisos, ProveedorEsperas } from '../ui/componentes';
import { LimiteErrores } from './LimiteErrores';
import { Rail } from './Rail';

export function Carcasa() {
  const { t } = useT();
  const gestor = useMemo(() => new GestorAtajos(), []);
  const navegar = useNavigate();
  // La pantalla que de verdad se pinta: `location` cambia antes de que cambie el <Outlet>.
  const ruta = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname });
  const [ayuda, setAyuda] = useState(false);

  useEffect(
    () =>
      gestor.registrar('global', [
        { teclas: '/', descripcion: 'atajos.buscar', accion: () => void navegar({ to: '/buscar' }) },
        { teclas: 'g h', descripcion: 'atajos.irInicio', accion: () => void navegar({ to: '/' }) },
        { teclas: 'g b', descripcion: 'atajos.irBuscar', accion: () => void navegar({ to: '/buscar' }) },
        { teclas: '?', descripcion: 'atajos.ayuda', accion: () => setAyuda(true) },
      ]),
    [gestor, navegar],
  );

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // Con un diálogo modal abierto (la ayuda), los atajos de la app no actúan por detrás.
      if (document.querySelector('dialog[open]')) return;
      const consumida = gestor.pulsar({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        enCampo: esCampoDeTexto(document.activeElement),
      });
      if (consumida) e.preventDefault();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [gestor]);

  return (
    <ContextoAtajos.Provider value={gestor}>
      <ProveedorAvisos>
        <div className="marco">
          <div className="shell">
            <Rail />
            <main className="amain" id="principal">
              <ProveedorEsperas>
                <LimiteErrores clave={ruta}>
                  <Suspense fallback={<Espera texto={t('comun.cargandoPantalla')} />}>
                    <Outlet />
                  </Suspense>
                </LimiteErrores>
              </ProveedorEsperas>
            </main>
          </div>
        </div>
        <AyudaAtajos abierta={ayuda} alCerrar={() => setAyuda(false)} />
      </ProveedorAvisos>
    </ContextoAtajos.Provider>
  );
}
