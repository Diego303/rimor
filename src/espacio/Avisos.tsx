/** Avisos del almacenamiento (IN-007): sin guardar, ventana privada, solo lectura y protección de los datos. */
import { type ReactNode, useEffect, useState } from 'react';
import { useCompositor } from '../captura/compositor';
import { useExportacion } from '../datos/exportacion';
import { useEspacio } from '../estado/espacio';
import { fmtBytes, fmtFechaRelativa } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { useEnLinea } from '../pwa/enLinea';
import { actualizar, useActualizacion } from '../pwa/registrar';
import { Banner, Boton, Tarjeta } from '../ui/componentes';
import { Senal } from '../ui/marca/Senal';
import { ahoraIso } from './abrir';
import { useEspacioOpcional } from './Espacio';
import { conPersistencia } from './estado';
import { espacioUsado, pedirPersistencia } from './persistencia';

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

/**
 * Banner de la carcasa cuando hay una versión nueva de Rimor (IN-050): esperando (entra cuando se pide) o ya entrada
 * desde otra pestaña (solo falta recargar). Con adjuntos sin guardar en el compositor o una exportación en marcha, se
 * espera: recargar los perdería.
 */
export function AvisoVersion() {
  const { t } = useT();
  const { esperando, cambiada } = useActualizacion();
  const adjuntos = useCompositor((s) => s.archivos.length > 0);
  const exportando = useExportacion((s) => s.tipo !== null);
  if (!esperando && !cambiada) return null;
  const espera = adjuntos ? t('espacio.aviso.versionAdjuntos') : exportando ? t('espacio.aviso.versionExportando') : '';
  return (
    <div className="aviso-espacio">
      <Banner>
        <span className="row aviso-version">
          <span>
            {t(cambiada ? 'espacio.aviso.versionEntrada' : 'espacio.aviso.version')}
            {espera ? ` ${espera}` : ''}
          </span>
          <Boton pequeno disabled={Boolean(espera)} onClick={actualizar}>
            {t(cambiada ? 'espacio.aviso.recargar' : 'espacio.aviso.actualizar')}
          </Boton>
        </span>
      </Banner>
    </div>
  );
}

/** Sin red (IN-050), en el móvil: allí no se ve el pie del raíl, que lo dice en el escritorio. */
export function AvisoSinConexion() {
  const { t } = useT();
  const enLinea = useEnLinea();
  return enLinea ? null : (
    <div className="aviso-espacio aviso-sin-red">
      <Banner>
        <span className="row">
          <Senal estado="sin-conexion" decorativa etiqueta="" tamano={12} prioridad="secundaria" />
          {t('rail.sinConexion')}
        </span>
      </Banner>
    </div>
  );
}

/**
 * Lo que dicen los avisos de la carcasa, para los lectores de pantalla: una región viva siempre montada (un banner que
 * aparece ya lleno no siempre se anuncia).
 */
export function AnuncioAvisos() {
  const { t } = useT();
  const { esperando, cambiada } = useActualizacion();
  const enLinea = useEnLinea();
  const frases = [
    ...(esperando || cambiada ? [t(cambiada ? 'espacio.aviso.versionEntrada' : 'espacio.aviso.version')] : []),
    ...(enLinea ? [] : [t('rail.sinConexion')]),
  ];
  return (
    <div className="solo-lector" role="status" aria-live="polite">
      {frases.join(' ')}
    </div>
  );
}

/** Tarjeta de Inicio que explica y pide el almacenamiento persistente; desaparece cuando ya se pidió. */
export function TarjetaPersistencia() {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const [resultado, setResultado] = useState(espacio?.estado().persistencia ?? 'sin-pedir');
  // En una pestaña lectora el resultado no se podría guardar: se pide desde la que escribe.
  if (!espacio || espacio.enMemoria || soloLectura || resultado === 'concedida') return null;
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
            setResultado(r);
            // Si no se puede escribir, el resultado queda en memoria y la tarjeta igual responde.
            await espacio.guardarEstado((e) => conPersistencia(e, r, ahoraIso())).catch(() => undefined);
          }}
        >
          {t('espacio.persistencia.boton')}
        </Boton>
      </div>
    </Tarjeta>
  );
}

/** Estado de persistencia como cifra de Datos y copias: texto y tono. */
const PERSISTENCIA = {
  concedida: { clave: 'espacio.cuidado.protegido', tono: 'ok' },
  denegada: { clave: 'espacio.cuidado.sinProteger', tono: 'warn' },
  'sin-pedir': { clave: 'espacio.cuidado.sinProteger', tono: 'warn' },
  'no-disponible': { clave: 'espacio.cuidado.noDisponible', tono: 'warn' },
} as const;

/**
 * Tarjeta de cabecera de Datos y copias (DAT-06, DAT-07), como en la pantalla de referencia: espacio usado,
 * persistencia y última copia. IN-037 le añade exportar e importar.
 */
/** Cuánto ocupa, si está protegido y la última copia; `children`, debajo (los botones de Datos y copias). */
export function TarjetaCuidado({ children }: { children?: ReactNode }) {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const [usado, setUsado] = useState<number | null>(null);
  const [estado, setEstado] = useState(() => espacio?.estado());

  useEffect(() => {
    if (!espacio) return undefined;
    let vivo = true;
    void espacioUsado().then((e) => vivo && setUsado(e?.usado ?? null));
    // Cada cambio de elementos o de estado llega con un estado nuevo: repinta también el recuento.
    const baja = espacio.alCambiar(setEstado);
    return () => {
      vivo = false;
      baja();
    };
  }, [espacio]);

  if (!espacio || !estado) return null;
  const total = espacio.repositorio.elementos().length;
  const persistencia = espacio.enMemoria ? PERSISTENCIA['no-disponible'] : PERSISTENCIA[estado.persistencia];
  return (
    <section className="card">
      <div className="stats">
        <div className="stat">
          <span className="v">{usado === null ? t('espacio.cuidado.usadoDesconocido') : fmtBytes(usado, idioma)}</span>
          <span className="xs muted">{t('espacio.cuidado.usado', { n: total })}</span>
        </div>
        <div className="stat">
          <span className={`v ${persistencia.tono}`}>{t(persistencia.clave)}</span>
          <span className="xs muted">{t('espacio.cuidado.persistencia')}</span>
        </div>
        <div className="stat">
          <span className="v">
            {estado.ultimaCopia
              ? fmtFechaRelativa(new Date(estado.ultimaCopia), new Date(), idioma)
              : t('espacio.cuidado.nunca')}
          </span>
          <span className="xs muted">{t('espacio.cuidado.copia', { n: estado.cambiosDesdeCopia })}</span>
        </div>
      </div>
      {children}
    </section>
  );
}
