/**
 * El editor de la consulta SQL (IN-044): CodeMirror con el modo SQL, el historial y `Ctrl+Intro` para ejecutar;
 * los colores, los del resaltado del código (`tok-*` con `classHighlighter`). Se carga al abrir la consulta: no pesa
 * en la vista de los datos.
 */
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { sql } from '@codemirror/lang-sql';
import { syntaxHighlighting } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { useEffect, useRef } from 'react';

interface Props {
  valor: string;
  alCambiar: (sql: string) => void;
  alEjecutar: () => void;
  etiqueta: string;
}

export default function EditorSql({ valor, alCambiar, alEjecutar, etiqueta }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  // Lo último de quien lo usa, sin volver a crear el editor en cada pintada.
  const llamadas = useRef({ alCambiar, alEjecutar });
  llamadas.current = { alCambiar, alEjecutar };
  // biome-ignore lint/correctness/useExhaustiveDependencies: el editor se crea una vez con su valor inicial.
  useEffect(() => {
    if (!caja.current) return undefined;
    const vista = new EditorView({
      parent: caja.current,
      state: EditorState.create({
        doc: valor,
        extensions: [
          history(),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                llamadas.current.alEjecutar();
                return true;
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          sql(),
          syntaxHighlighting(classHighlighter),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': etiqueta }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) llamadas.current.alCambiar(u.state.doc.toString());
          }),
        ],
      }),
    });
    return () => vista.destroy();
  }, []);
  return <div ref={caja} className="editor-sql codigo" />;
}
