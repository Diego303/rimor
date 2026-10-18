import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { guardarPreferencia, leerPreferencia, type PreferenciaTema } from '../tema/tema';
import { Segmentado } from './Segmentado';

/** Sistema, claro u oscuro (APP-02). Guarda la elección en local y la aplica al momento. */
export function SelectorTema() {
  const { t } = useT();
  const [valor, setValor] = useState<PreferenciaTema>(() => leerPreferencia());
  return (
    <Segmentado<PreferenciaTema>
      etiqueta={t('tema.etiqueta')}
      valor={valor}
      opciones={[
        { valor: 'sistema', etiqueta: t('tema.sistema') },
        { valor: 'claro', etiqueta: t('tema.claro') },
        { valor: 'oscuro', etiqueta: t('tema.oscuro') },
      ]}
      alCambiar={(p) => {
        setValor(p);
        guardarPreferencia(p);
      }}
    />
  );
}
