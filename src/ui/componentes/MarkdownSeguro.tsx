/** La única forma de pintar Markdown pegado (SEG-01): saneado y convertido a React sin `dangerouslySetInnerHTML`. */
import type { Element as ElementoHast, Root } from 'hast';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { type MouseEvent, useMemo } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { visit } from 'unist-util-visit';
import { useT } from '../../i18n/useT';
import { markdownAHast } from '../../seguridad/sanear';
import { crearAnclador, idDeAncla, textoPlano } from '../anclas';

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

const ENCABEZADO = /^h[1-6]$/;

/**
 * Pone a cada encabezado su ancla estable (la misma que calcula el índice del lector Markdown). Los que ya traen
 * `id` (el de las notas al pie) se dejan.
 */
function anclarEncabezados(arbol: Root): Root {
  const anclar = crearAnclador();
  visit(arbol, 'element', (nodo: ElementoHast) => {
    if (!ENCABEZADO.test(nodo.tagName) || nodo.properties.id !== undefined) return;
    nodo.properties.id = idDeAncla(anclar(textoPlano(nodo).trim()));
  });
  return arbol;
}

interface PropsMarkdown {
  texto: string;
  className?: string;
  /** Encabezados con su ancla (`rimor-<ancla>`), para que un índice lleve a ellos. */
  anclas?: boolean;
}

export default function MarkdownSeguro({ texto, className, anclas = false }: PropsMarkdown) {
  const { idioma } = useT();
  const contenido = useMemo(() => {
    const arbol = markdownAHast(texto, idioma);
    return toJsxRuntime(anclas ? anclarEncabezados(arbol) : arbol, { Fragment, jsx, jsxs });
  }, [texto, idioma, anclas]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: el clic llega de los enlaces, que ya se activan con teclado.
    // biome-ignore lint/a11y/noStaticElementInteractions: solo delega el clic de las anclas internas.
    <div className={className ?? 'dp md-seguro'} onClick={alPulsar}>
      {contenido}
    </div>
  );
}
