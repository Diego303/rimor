/** La única forma de pintar Markdown pegado (SEG-01): saneado y convertido a React sin `dangerouslySetInnerHTML`. */
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { type MouseEvent, useMemo } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { useT } from '../../i18n/useT';
import { markdownAHast } from '../../seguridad/sanear';

/**
 * Las anclas internas (`#rimor-…`, notas al pie) cambiarían el hash, que es la ruta de la app: se desplaza a su
 * destino dentro del texto sin navegar.
 */
function alPulsar(e: MouseEvent<HTMLDivElement>) {
  const enlace = (e.target as Element).closest?.('a[href^="#rimor-"]');
  if (!enlace) return;
  e.preventDefault();
  const destino = document.getElementById(enlace.getAttribute('href')?.slice(1) ?? '');
  destino?.scrollIntoView({ block: 'center' });
}

export default function MarkdownSeguro({ texto, className }: { texto: string; className?: string }) {
  const { idioma } = useT();
  const contenido = useMemo(() => toJsxRuntime(markdownAHast(texto, idioma), { Fragment, jsx, jsxs }), [texto, idioma]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: el clic llega de los enlaces, que ya se activan con teclado.
    // biome-ignore lint/a11y/noStaticElementInteractions: solo delega el clic de las anclas internas.
    <div className={className ?? 'dp md-seguro'} onClick={alPulsar}>
      {contenido}
    </div>
  );
}
