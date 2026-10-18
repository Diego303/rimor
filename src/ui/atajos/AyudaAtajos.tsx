/** Ayuda de atajos (tecla «?»): lista los atajos activos en un diálogo. */
import { useEffect, useRef } from 'react';
import { useT } from '../../i18n/useT';
import { Boton, Kbd } from '../componentes';
import { useGestorAtajos } from './useAtajos';

const TECLAS = ['ctrl', 'shift', 'alt', 'space', 'enter', 'escape'] as const;
type Tecla = (typeof TECLAS)[number];
const esTeclaConNombre = (k: string): k is Tecla => (TECLAS as readonly string[]).includes(k);

export function AyudaAtajos({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const { t } = useT();
  const gestor = useGestorAtajos();
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal?.();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  const filas = gestor.lista().flatMap(({ atajos }) => atajos);
  const mostrar = (teclas: string) =>
    teclas.split(' ').map((paso) => paso.split('+').map((k) => (esTeclaConNombre(k) ? t(`atajos.teclas.${k}`) : k)));
  return (
    <dialog ref={dialogo} className="dialogo card" aria-labelledby="ayuda-atajos" onClose={alCerrar}>
      <h3 id="ayuda-atajos">{t('atajos.titulo')}</h3>
      <dl className="kv">
        {filas.map((a) => (
          <div key={a.teclas} className="contents">
            <dt>
              {mostrar(a.teclas).map((paso, i) => (
                <span key={paso.join('+')} className="row inline">
                  {i > 0 && <span className="xs faint">{t('atajos.luego')}</span>}
                  {paso.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              ))}
            </dt>
            <dd>{t(a.descripcion)}</dd>
          </div>
        ))}
      </dl>
      <div className="row">
        <Boton onClick={alCerrar}>{t('atajos.cerrar')}</Boton>
      </div>
    </dialog>
  );
}
