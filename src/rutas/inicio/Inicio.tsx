import { useNavigate } from '@tanstack/react-router';
import { TarjetaPersistencia } from '../../espacio/Avisos';
import { useT } from '../../i18n/useT';
import { IdeasQueVuelven } from '../../lectores/idea/IdeasQueVuelven';
import { Vacio } from '../../ui/componentes';
import { Compositor } from '../../ui/componentes/Compositor';
import { Pantalla } from '../Pantalla';

/** Inicio: el compositor abajo (IN-015); el feed lo completa IN-026. */
export function Inicio() {
  const { t } = useT();
  const navegar = useNavigate();
  return (
    <>
      <Pantalla>
        <TarjetaPersistencia />
        <IdeasQueVuelven />
        <Vacio titulo={t('pantallas.inicio.vacioTitulo')}>{t('pantallas.inicio.vacio')}</Vacio>
      </Pantalla>
      <div className="col ccol">
        <Compositor alAbrir={(ref) => void navegar({ to: '/e/$ref', params: { ref } })} />
      </div>
    </>
  );
}
