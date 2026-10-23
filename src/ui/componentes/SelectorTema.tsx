import { useState } from 'react';
import { useT } from '../../i18n/useT';
import { guardarPreferencia, leerPreferencia, type PreferenciaTema } from '../tema/tema';
import { Segmentado } from './Segmentado';

/**
 * Sistema, claro u oscuro (APP-02). Guarda la elección en local y la aplica al momento; `alCambiar` la lleva
 * además a los ajustes del espacio (IN-038). Con `valor`, lo sigue (el tema de los ajustes, que puede cambiar la
 * otra pestaña).
 */
export function SelectorTema({
  valor: controlado,
  alCambiar,
  deshabilitado,
}: {
  valor?: PreferenciaTema;
  alCambiar?: (p: PreferenciaTema) => void;
  deshabilitado?: boolean;
} = {}) {
  const { t } = useT();
  const [propio, setPropio] = useState<PreferenciaTema>(() => leerPreferencia());
  const valor = controlado ?? propio;
  return (
    <Segmentado<PreferenciaTema>
      etiqueta={t('tema.etiqueta')}
      valor={valor}
      deshabilitado={deshabilitado ?? false}
      opciones={[
        { valor: 'sistema', etiqueta: t('tema.sistema') },
        { valor: 'claro', etiqueta: t('tema.claro') },
        { valor: 'oscuro', etiqueta: t('tema.oscuro') },
      ]}
      alCambiar={(p) => {
        setPropio(p);
        guardarPreferencia(p);
        alCambiar?.(p);
      }}
    />
  );
}
