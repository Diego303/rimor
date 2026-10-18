import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Datos: la completa su funcionalidad (ver docs/seguimiento.md). */
export function Datos() {
  const { t } = useT();
  return (
    <Pantalla titulo={t('pantallas.datos.titulo')}>
      <Vacio titulo={t('pantallas.datos.vacioTitulo')}>{t('pantallas.datos.vacio')}</Vacio>
    </Pantalla>
  );
}
