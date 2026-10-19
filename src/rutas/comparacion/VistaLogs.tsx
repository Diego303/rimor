/**
 * Comparación de logs, como `SC.clogs` de la referencia: dónde se separa la mala de la buena (con la línea de
 * cada una en ese punto), los mensajes que solo están en la mala y los que le faltan, y los que cambian de
 * frecuencia plegados. Las plantillas, con sus marcadores resaltados como en la vista de Log.
 */
import type { Elemento } from '@rimor/formato';
import { useMemo } from 'react';
import type { ComparacionLogs } from '../../comparaciones/logs';
import { useT } from '../../i18n/useT';
import { partirLineas } from '../../lectores/log/analisis';
import { PlantillaPintada } from '../../lectores/log/PlantillaPintada';
import { useOriginal } from '../../lectores/useOriginal';
import { Detalles, Tarjeta, Veredicto } from '../../ui/componentes';

/** Plantillas que se enseñan en cada lista; el resto, «y N más». */
const MAX_PLANTILLAS = 50;

/** Una lista de plantillas, cada una en su bloque de código. */
function Plantillas({ lista, detalle }: { lista: readonly string[]; detalle?: (p: string) => string }) {
  const { t } = useT();
  if (!lista.length) return <p className="sm muted">{t('pantallas.comparacion.logs.ninguno')}</p>;
  return (
    <>
      {lista.slice(0, MAX_PLANTILLAS).map((p) => (
        <div key={p} className="code plantilla-comparada">
          <PlantillaPintada plantilla={p} />
          {detalle && <span className="xs muted"> · {detalle(p)}</span>}
        </div>
      ))}
      {lista.length > MAX_PLANTILLAS && (
        <p className="xs muted">{t('pantallas.comparacion.logs.mas', { n: lista.length - MAX_PLANTILLAS })}</p>
      )}
    </>
  );
}

/** La línea `i` del original, o `null` si el log (sin sus líneas vacías del final, `largo`) se acaba antes. */
function useLinea(el: Elemento, i: number | null, largo: number): string | null {
  const original = useOriginal(el);
  return useMemo(
    () => (original === null || i === null || i >= largo ? null : (partirLineas(original)[i] ?? null)),
    [original, i, largo],
  );
}

interface Props {
  c: ComparacionLogs;
  buena: Elemento;
  mala: Elemento;
}

export function VistaComparacionLogs({ c, buena, mala }: Props) {
  const { t } = useT();
  const enBuena = useLinea(buena, c.divergencia, c.lineas.a);
  const enMala = useLinea(mala, c.divergencia, c.lineas.b);
  const veces = new Map(c.cambian.map((x) => [x.plantilla, x]));
  const resumen = `${t('pantallas.comparacion.logs.nuevos', { n: c.nuevos.length })} · ${t(
    'pantallas.comparacion.logs.ausentes',
    { n: c.ausentes.length },
  )}`;
  const seAcaba = <span className="muted">{t('pantallas.comparacion.logs.seAcaba')}</span>;

  return (
    <>
      <Tarjeta>
        {c.divergencia === null ? (
          <Veredicto
            tono="ok"
            cifra="="
            frase={t('pantallas.comparacion.logs.iguales')}
            explicacion={t('pantallas.comparacion.logs.igualesTexto')}
          />
        ) : (
          <>
            <Veredicto
              tono="bad"
              cifra={t('pantallas.comparacion.logs.linea', { n: c.divergencia + 1 })}
              frase={t('pantallas.comparacion.logs.separan')}
              explicacion={resumen}
            />
            <div className="tbl-wrap">
              <table className="tabla-divergencia">
                <caption className="solo-lector">{t('pantallas.comparacion.logs.tabla')}</caption>
                <tbody>
                  <tr>
                    <td className="xs muted lado">{t('pantallas.comparacion.buena')}</td>
                    <td className="mono xs">{enBuena ?? seAcaba}</td>
                  </tr>
                  <tr>
                    <td className="xs lado mala">{t('pantallas.comparacion.mala')}</td>
                    <td className="mono xs">{enMala === null ? seAcaba : <span className="oc mal">{enMala}</span>}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Tarjeta>
      {c.divergencia !== null && (
        <div className="split">
          <Tarjeta titulo={t('pantallas.comparacion.logs.soloMala')}>
            <Plantillas lista={c.nuevos} />
          </Tarjeta>
          <Tarjeta titulo={t('pantallas.comparacion.logs.faltanMala')}>
            <Plantillas lista={c.ausentes} />
          </Tarjeta>
        </div>
      )}
      <Detalles resumen={t('pantallas.comparacion.logs.cambian')}>
        <Plantillas
          lista={c.cambian.map((x) => x.plantilla)}
          detalle={(p) => t('pantallas.comparacion.logs.veces', { a: veces.get(p)?.a ?? 0, b: veces.get(p)?.b ?? 0 })}
        />
      </Detalles>
    </>
  );
}
