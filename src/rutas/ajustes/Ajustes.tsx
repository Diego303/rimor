import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Ajustes: la completa su funcionalidad (ver docs/seguimiento.md). */
export function Ajustes() {
  const { t } = useT();
  return (
    <Pantalla titulo={t('pantallas.ajustes.titulo')}>
      <Vacio titulo={t('pantallas.ajustes.vacioTitulo')}>{t('pantallas.ajustes.vacio')}</Vacio>
    </Pantalla>
  );
}
