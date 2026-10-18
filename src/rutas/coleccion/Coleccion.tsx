import { useParams } from '@tanstack/react-router';
import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Colección: la completa IN-031 (lista) e IN-052 (panel de grupo). */
export function Coleccion() {
  const { t } = useT();
  const { coleccion } = useParams({ from: '/c/$coleccion' });
  return (
    <Pantalla titulo={coleccion}>
      <Vacio titulo={t('pantallas.coleccion.vacioTitulo')}>{t('pantallas.coleccion.vacio')}</Vacio>
    </Pantalla>
  );
}
