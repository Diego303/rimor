import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { TarjetaCuidado } from '../../espacio/Avisos';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { Boton, Detalles } from '../../ui/componentes';
import { Pantalla } from '../Pantalla';

/** Cuántos elementos hay en el espacio y en su papelera, al día con cada cambio. */
function useRecuentos(): { elementos: number; papelera: number } {
  const espacio = useEspacioOpcional();
  const [recuentos, setRecuentos] = useState({ elementos: 0, papelera: 0 });
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () =>
      setRecuentos({
        elementos: espacio.repositorio.elementos().length,
        papelera: espacio.repositorio.enPapelera().length,
      });
    leer();
    return espacio.alCambiar(leer);
  }, [espacio]);
  return recuentos;
}

/**
 * Datos y copias: de momento, cuánto ocupa, si está protegido y la última copia (IN-007), y el espacio con su
 * papelera (IN-027); el resto, IN-037.
 */
export function Datos() {
  const { t } = useT();
  const navegar = useNavigate();
  const nombre = useEspacio((s) => s.nombre);
  const enMemoria = useEspacioOpcional()?.enMemoria ?? false;
  const { elementos, papelera } = useRecuentos();
  return (
    <Pantalla
      titulo={t('pantallas.datos.titulo')}
      meta={t(enMemoria ? 'espacio.cuidado.metaMemoria' : 'espacio.cuidado.meta', { nombre })}
    >
      <TarjetaCuidado />
      <Detalles resumen={t('pantallas.datos.espacios')}>
        <dl className="kv">
          <dt>{nombre}</dt>
          <dd>{t('pantallas.datos.espacioActivo', { n: elementos })}</dd>
          <dt>{t('pantallas.datos.papelera')}</dt>
          <dd>
            {papelera ? t('pantallas.datos.papeleraN', { n: papelera }) : t('pantallas.datos.papeleraVacia')}{' '}
            <Boton variante="fantasma" pequeno onClick={() => void navegar({ to: '/papelera' })}>
              {t('pantallas.datos.verPapelera')}
            </Boton>
          </dd>
        </dl>
      </Detalles>
    </Pantalla>
  );
}
