import { TarjetaCuidado } from '../../espacio/Avisos';
import { useEspacioOpcional } from '../../espacio/Espacio';
import { useEspacio } from '../../estado/espacio';
import { useT } from '../../i18n/useT';
import { Pantalla } from '../Pantalla';

/** Datos y copias: de momento, cuánto ocupa, si está protegido y la última copia (IN-007); el resto, IN-037. */
export function Datos() {
  const { t } = useT();
  const nombre = useEspacio((s) => s.nombre);
  const enMemoria = useEspacioOpcional()?.enMemoria ?? false;
  return (
    <Pantalla
      titulo={t('pantallas.datos.titulo')}
      meta={t(enMemoria ? 'espacio.cuidado.metaMemoria' : 'espacio.cuidado.meta', { nombre })}
    >
      <TarjetaCuidado />
    </Pantalla>
  );
}
