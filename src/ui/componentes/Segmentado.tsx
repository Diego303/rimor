import type { ReactNode } from 'react';

export interface OpcionSegmentado<V extends string> {
  valor: V;
  etiqueta: ReactNode;
}

interface Props<V extends string> {
  opciones: readonly OpcionSegmentado<V>[];
  valor: V;
  alCambiar: (valor: V) => void;
  /** Nombre del grupo para el lector de pantalla. */
  etiqueta: string;
}

/** De 2 a 4 opciones excluyentes en una píldora hundida (guía §7.2). */
export function Segmentado<V extends string>({ opciones, valor, alCambiar, etiqueta }: Props<V>) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: un <fieldset> obliga a una leyenda visible; el grupo lleva aria-label.
    <div className="seg" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button key={o.valor} type="button" aria-pressed={o.valor === valor} onClick={() => alCambiar(o.valor)}>
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
