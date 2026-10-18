import { Link } from '@tanstack/react-router';
import { useT } from '../i18n/useT';
import { Vacio } from '../ui/componentes';
import { Pantalla } from './Pantalla';

/** Ruta que no existe (un enlace viejo o mal escrito). */
export function NoEncontrada() {
  const { t } = useT();
  return (
    <Pantalla>
      <Vacio titulo={t('pantallas.noEncontrada.titulo')}>
        {t('pantallas.noEncontrada.texto')} <Link to="/">{t('pantallas.noEncontrada.volver')}</Link>
      </Vacio>
    </Pantalla>
  );
}
