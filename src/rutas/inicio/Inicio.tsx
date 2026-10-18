import { TarjetaPersistencia } from '../../espacio/Avisos';
import { useT } from '../../i18n/useT';
import { Vacio } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Inicio: feed y compositor (los completan IN-015 e IN-026). */
export function Inicio() {
  const { t } = useT();
  return (
    <Pantalla>
      <TarjetaPersistencia />
      <Vacio titulo={t('pantallas.inicio.vacioTitulo')}>{t('pantallas.inicio.vacio')}</Vacio>
    </Pantalla>
  );
}
