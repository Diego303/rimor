/** Avisos del almacenamiento (IN-007): sin guardar, ventana privada, solo lectura y protección de los datos. */
import { useState } from 'react';
import { useEspacio } from '../estado/espacio';
import { useT } from '../i18n/useT';
import { Banner, Boton, Tarjeta } from '../ui/componentes';
import { ahoraIso } from './abrir';
import { useEspacioOpcional } from './Espacio';
import { conPersistencia } from './estado';
import { pedirPersistencia } from './persistencia';

/** Banner persistente de la carcasa cuando lo guardado corre peligro o no se puede escribir. */
export function AvisoAlmacenamiento() {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  if (!espacio) return null;
  const texto = espacio.enMemoria
    ? t('espacio.aviso.memoria')
    : espacio.ventanaPrivada
      ? t('espacio.aviso.privada')
      : soloLectura
        ? t('espacio.aviso.soloLectura')
        : null;
  return texto ? (
    <div className="aviso-espacio">
      <Banner>{texto}</Banner>
    </div>
  ) : null;
}

/** Tarjeta de Inicio que explica y pide el almacenamiento persistente; desaparece cuando ya se pidió. */
export function TarjetaPersistencia() {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const [resultado, setResultado] = useState(espacio?.estado().persistencia ?? 'sin-pedir');
  if (!espacio || espacio.enMemoria || resultado === 'concedida') return null;
  if (resultado !== 'sin-pedir')
    return (
      <Banner>
        {t(resultado === 'denegada' ? 'espacio.persistencia.denegada' : 'espacio.persistencia.noDisponible')}
      </Banner>
    );
  return (
    <Tarjeta titulo={t('espacio.persistencia.titulo')}>
      <p className="sm muted">{t('espacio.persistencia.texto')}</p>
      <div className="row">
        <Boton
          variante="primario"
          onClick={async () => {
            const r = await pedirPersistencia();
            await espacio.guardarEstado((e) => conPersistencia(e, r, ahoraIso()));
            setResultado(r);
          }}
        >
          {t('espacio.persistencia.boton')}
        </Boton>
      </div>
    </Tarjeta>
  );
}
