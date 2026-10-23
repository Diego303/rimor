/** El recordatorio de copia y el ZIP previo (IN-037): en Datos y copias y en Ajustes. */
import { type KeyboardEvent, useEffect, useState } from 'react';
import { type AjustesCopias, COPIAS_INICIALES, copiasDe, LIMITES_COPIAS } from '../espacio/ajustes';
import { useEspacioOpcional } from '../espacio/Espacio';
import { useEspacio } from '../estado/espacio';
import { useT } from '../i18n/useT';
import { useAvisosOpcional } from '../ui/componentes/Avisos';

/**
 * El recordatorio de copia (DAT-07): avisar o no y tras cuántos cambios o días, y el ZIP previo a lo destructivo.
 * Se guarda en los ajustes del espacio al cambiar (los números, al salir del campo, dentro de sus límites).
 */
export function AjustesRecordatorio() {
  const { t } = useT();
  const espacio = useEspacioOpcional();
  const avisos = useAvisosOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const [copias, setCopias] = useState(() => espacio?.ajustes().copias ?? COPIAS_INICIALES);
  // Lo que se escribe en los números, hasta guardarlo (al salir del campo o con Intro).
  const [cambios, setCambios] = useState(String(copias.cambios));
  const [dias, setDias] = useState(String(copias.dias));
  // Al día con los ajustes de ahora (los cambia también la otra pestaña).
  useEffect(() => {
    if (!espacio) return undefined;
    const leer = () => {
      const ahora = espacio.ajustes().copias;
      setCopias(ahora);
      setCambios(String(ahora.cambios));
      setDias(String(ahora.dias));
    };
    return espacio.alCambiar(leer);
  }, [espacio]);
  if (!espacio) return null;
  const guardar = (cambio: Partial<AjustesCopias>) => {
    // Sobre lo que hay ahora (y lo que no se conoce de `copias` se queda).
    void espacio
      .guardarAjustes((a) => ({ ...a, copias: { ...a.copias, ...copiasDe({ ...a.copias, ...cambio }) } }))
      .catch(() => avisos?.avisar(t('ajustes.noGuardado')));
    const nuevas = espacio.ajustes().copias;
    setCopias(nuevas);
    setCambios(String(nuevas.cambios));
    setDias(String(nuevas.dias));
  };
  /** Un número escrito: vacío o inválido, vuelve al que había; si no, se guarda (dentro de sus límites). */
  const numero = (clave: 'cambios' | 'dias', escrito: string) => {
    const n = Number(escrito);
    if (!escrito.trim() || !Number.isFinite(n)) {
      (clave === 'cambios' ? setCambios : setDias)(String(copias[clave]));
      return;
    }
    guardar({ [clave]: n });
  };
  const alPulsar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };
  return (
    <div className="list ajustes-copia">
      <label className="chk">
        <input
          type="checkbox"
          checked={copias.avisar}
          disabled={soloLectura}
          onChange={(e) => guardar({ avisar: e.target.checked })}
        />
        <span>
          {t('copias.avisar')}{' '}
          <input
            type="number"
            min={LIMITES_COPIAS.cambios[0]}
            max={LIMITES_COPIAS.cambios[1]}
            value={cambios}
            disabled={soloLectura || !copias.avisar}
            aria-label={t('copias.cambiosEtiqueta')}
            onChange={(e) => setCambios(e.target.value)}
            onBlur={() => numero('cambios', cambios)}
            onKeyDown={alPulsar}
          />{' '}
          {t('copias.cambios')}{' '}
          <input
            type="number"
            min={LIMITES_COPIAS.dias[0]}
            max={LIMITES_COPIAS.dias[1]}
            value={dias}
            disabled={soloLectura || !copias.avisar}
            aria-label={t('copias.diasEtiqueta')}
            onChange={(e) => setDias(e.target.value)}
            onBlur={() => numero('dias', dias)}
            onKeyDown={alPulsar}
          />{' '}
          {t('copias.dias')}
        </span>
      </label>
      <label className="chk">
        <input
          type="checkbox"
          checked={copias.zipPrevio}
          disabled={soloLectura}
          onChange={(e) => guardar({ zipPrevio: e.target.checked })}
        />
        <span>{t('copias.zipPrevio')}</span>
      </label>
    </div>
  );
}
