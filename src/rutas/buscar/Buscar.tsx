import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Buscar: la completa su funcionalidad (ver docs/seguimiento.md). */
export function Buscar() {
  const { t } = useT();
  return (
    <Pantalla titulo={t('pantallas.buscar.titulo')}>
      <Vacio titulo={t('pantallas.buscar.vacioTitulo')}>{t('pantallas.buscar.vacio')}</Vacio>
    </Pantalla>
  );
}
