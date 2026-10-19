/** Diálogo modal (`<dialog>` nativo) con título: se abre y se cierra con `abierto`; Esc y el fondo lo cierran. */
import { type ReactNode, useEffect, useId, useRef } from 'react';

interface PropsDialogo {
  abierto: boolean;
  alCerrar: () => void;
  titulo: ReactNode;
  children: ReactNode;
}

export function Dialogo({ abierto, alCerrar, titulo, children }: PropsDialogo) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal?.();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className="dialogo card" aria-labelledby={id} onClose={alCerrar}>
      <h3 id={id}>{titulo}</h3>
      {abierto && children}
    </dialog>
  );
}
