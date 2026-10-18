import { useParams } from '@tanstack/react-router';
import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Hilo: la completa su funcionalidad (ver docs/seguimiento.md). */
export function Hilo() {
  const { t } = useT();
  const { ref } = useParams({ from: '/hilo/$ref' });
  return (
    <Pantalla titulo={ref}>
      <Vacio titulo={t('pantallas.hilo.vacioTitulo')}>{t('pantallas.hilo.vacio')}</Vacio>
    </Pantalla>
  );
}
