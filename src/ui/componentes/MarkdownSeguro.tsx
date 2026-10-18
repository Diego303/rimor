/** La única forma de pintar Markdown pegado (SEG-01): saneado y convertido a React sin `dangerouslySetInnerHTML`. */
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { useMemo } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { markdownAHast } from '../../seguridad/sanear';

export default function MarkdownSeguro({ texto, className }: { texto: string; className?: string }) {
  const contenido = useMemo(() => toJsxRuntime(markdownAHast(texto), { Fragment, jsx, jsxs }), [texto]);
  return <div className={className ?? 'dp md-seguro'}>{contenido}</div>;
}
