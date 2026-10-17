import { useState } from 'react';
import { guardarPreferencia, leerPreferencia, type PreferenciaTema } from '../tema/tema';
import { Segmentado } from './Segmentado';

interface Props {
  etiqueta: string;
  textos: Record<PreferenciaTema, string>;
}

/** Sistema, claro u oscuro (APP-02). Guarda la elección en local y la aplica al momento. */
export function SelectorTema({ etiqueta, textos }: Props) {
  const [valor, setValor] = useState<PreferenciaTema>(() => leerPreferencia());
  return (
    <Segmentado<PreferenciaTema>
      etiqueta={etiqueta}
      valor={valor}
      opciones={[
        { valor: 'sistema', etiqueta: textos.sistema },
        { valor: 'claro', etiqueta: textos.claro },
        { valor: 'oscuro', etiqueta: textos.oscuro },
      ]}
      alCambiar={(p) => {
        setValor(p);
        guardarPreferencia(p);
      }}
    />
  );
}
