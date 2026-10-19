/**
 * Notas del usuario de un elemento (el cuerpo de su `.md`), con un editor simple: un campo que crece con el
 * texto; `Ctrl+Intro` o salir del campo guardan y `Esc` deja la nota como estaba. Sin nota, un botón para añadirla.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useT } from '../../i18n/useT';
import { Boton, Tarjeta } from '../../ui/componentes';
import MarkdownSeguro from '../../ui/componentes/MarkdownSeguro';

interface Props {
  notas: string;
  editable: boolean;
  editando: boolean;
  alEmpezar: () => void;
  /** El texto escrito, o `null` si se canceló. */
  alTerminar: (texto: string | null) => void;
}

export function Notas({ notas, editable, editando, alEmpezar, alTerminar }: Props) {
  const { t } = useT();
  if (editando) return <EditorNotas notas={notas} alTerminar={alTerminar} />;
  if (!notas.trim())
    return editable ? (
      <div className="row">
        <Boton variante="fantasma" pequeno icono="mas" onClick={alEmpezar}>
          {t('pantallas.elemento.anadirNota')}
        </Boton>
      </div>
    ) : null;
  return (
    <Tarjeta titulo={t('pantallas.elemento.notas')} className="notas-elemento">
      <MarkdownSeguro texto={notas} />
      {editable && (
        <div className="row">
          <Boton variante="fantasma" pequeno onClick={alEmpezar}>
            {t('pantallas.elemento.editarNota')}
          </Boton>
        </div>
      )}
    </Tarjeta>
  );
}

function EditorNotas({ notas, alTerminar }: Pick<Props, 'notas' | 'alTerminar'>) {
  const { t } = useT();
  const [texto, setTexto] = useState(notas);
  const campo = useRef<HTMLTextAreaElement>(null);
  const terminado = useRef(false);
  const terminar = (resultado: string | null) => {
    if (terminado.current) return;
    terminado.current = true;
    alTerminar(resultado);
  };

  // Crece con el texto (sin barra de desplazamiento propia); donde no se puede medir, se queda en sus filas.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se vuelve a medir con cada cambio del texto.
  useLayoutEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.style.height = 'auto';
    if (c.scrollHeight > 0) c.style.height = `${c.scrollHeight + 2}px`;
  }, [texto]);

  useLayoutEffect(() => {
    const c = campo.current;
    if (!c) return;
    c.focus();
    c.setSelectionRange(c.value.length, c.value.length);
  }, []);

  return (
    <Tarjeta titulo={t('pantallas.elemento.notas')} className="notas-elemento">
      <textarea
        ref={campo}
        rows={3}
        aria-label={t('pantallas.elemento.campoNota')}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => terminar(texto)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
            e.preventDefault();
            terminar(texto);
          } else if (e.key === 'Escape' && !e.nativeEvent.isComposing) {
            // (Durante una composición de IME, Esc es del IME.)
            e.preventDefault();
            e.stopPropagation();
            terminar(null);
          }
        }}
      />
      <p className="xs faint">{t('pantallas.elemento.guiaNota')}</p>
    </Tarjeta>
  );
}
