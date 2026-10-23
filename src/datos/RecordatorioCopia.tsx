/**
 * El recordatorio de copia en Inicio (DAT-07): una tarjeta, nunca un bloqueo, cuando la copia no está al día. Se
 * exporta desde aquí o se pospone un día. Solo en la pestaña que escribe (en la otra, no se podría apuntar nada).
 */
import { useEffect, useState } from 'react';
import { ahoraIso } from '../espacio/abrir';
import { useEspacioOpcional } from '../espacio/Espacio';
import { conRecordatorioHasta } from '../espacio/estado';
import { debeRecordarCopia } from '../espacio/resumen';
import { useEspacio } from '../estado/espacio';
import { fmtFechaRelativa } from '../i18n/formatos';
import { useT } from '../i18n/useT';
import { Boton, Tarjeta } from '../ui/componentes';
import { useExportacion } from './exportacion';
import { useExportar } from './useExportar';

/** Lo que dura «Más tarde». */
export const POSPONER_MS = 86_400_000;

export function RecordatorioCopia() {
  const { t, idioma } = useT();
  const espacio = useEspacioOpcional();
  const soloLectura = useEspacio((s) => s.soloLectura);
  const exportar = useExportar();
  const enMarcha = useExportacion((s) => s.tipo !== null);
  const [estado, setEstado] = useState(() => espacio?.estado());
  useEffect(() => (espacio ? espacio.alCambiar(setEstado) : undefined), [espacio]);

  if (!espacio || !estado || soloLectura) return null;
  const ahora = new Date();
  if (!debeRecordarCopia(estado, espacio.ajustes().copias, ahora, espacio.repositorio.elementos().length > 0))
    return null;
  const texto = estado.ultimaCopia
    ? t('copias.recordatorio', {
        cuando: fmtFechaRelativa(new Date(estado.ultimaCopia), ahora, idioma),
        n: estado.cambiosDesdeCopia,
      })
    : t('copias.recordatorioNunca');
  return (
    <Tarjeta titulo={t('copias.recordatorioTitulo')}>
      <p className="sm muted">{texto}</p>
      <div className="row">
        <Boton variante="primario" pequeno disabled={enMarcha} onClick={() => void exportar('zip')}>
          {t('copias.exportar')}
        </Boton>
        <Boton
          variante="fantasma"
          pequeno
          onClick={() =>
            void espacio
              .guardarEstado((e) =>
                conRecordatorioHasta(
                  e,
                  ahoraIso(() => new Date(Date.now() + POSPONER_MS)),
                ),
              )
              .catch(() => undefined)
          }
        >
          {t('copias.masTarde')}
        </Boton>
      </div>
    </Tarjeta>
  );
}
