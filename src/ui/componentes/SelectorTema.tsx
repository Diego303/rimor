import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { guardarPreferencia, leerPreferencia, type PreferenciaTema } from '../tema/tema';
import { Segmentado } from './Segmentado';

/**
 * Sistema, claro u oscuro (APP-02). Guarda la elección en local y la aplica al momento; `alCambiar` la lleva
 * además a los ajustes del espacio (IN-038).
 */
export function SelectorTema({
  alCambiar,
  deshabilitado,
}: {
  alCambiar?: (p: PreferenciaTema) => void;
  deshabilitado?: boolean;
} = {}) {
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
        if (deshabilitado) return;
        setValor(p);
        guardarPreferencia(p);
        alCambiar?.(p);
      }}
    />
  );
}
