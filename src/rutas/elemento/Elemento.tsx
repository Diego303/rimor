import { useParams } from '@tanstack/react-router';
import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Elemento: la completa su funcionalidad (ver docs/seguimiento.md). */
export function Elemento() {
  const { t } = useT();
  const { ref } = useParams({ from: '/e/$ref' });
  return (
    <Pantalla titulo={ref}>
      <Vacio titulo={t('pantallas.elemento.vacioTitulo')}>{t('pantallas.elemento.vacio')}</Vacio>
    </Pantalla>
  );
}
