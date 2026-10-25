/**
 * Comparación estructural de dos configuraciones (CMP-03, IN-045): el veredicto con cuántas claves cambian
 * (añadidas, quitadas y cambiadas) y la tabla Ruta · Antes · Después, en el orden del documento. La referencia no la
 * dibuja: se compone con sus piezas (veredicto, tabla).
 */
import type { ComparacionJson } from '../../comparaciones/json';
import type { ResultadoJson } from '../../comparaciones/resultado';
import { fmtNumero } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { totalCambios } from '../../lectores/json/analisis';
import { TablaCambiosJson } from '../../lectores/json/TablaCambios';
import { Tarjeta, Veredicto } from '../../ui/componentes';

/** El veredicto: del cálculo de ahora o del resultado guardado. */
export function VeredictoJson({ r }: { r: Pick<ResultadoJson, 'anadidas' | 'quitadas' | 'cambiadas'> }) {
  const { t, idioma } = useT();
  const total = r.anadidas + r.quitadas + r.cambiadas;
  if (!total) return <Veredicto tono="ok" cifra="=" frase={t('pantallas.comparacion.json.iguales')} />;
  return (
    <Veredicto
      tono="warn"
      cifra={fmtNumero(total, idioma)}
      frase={t('pantallas.comparacion.json.cambian', { n: total })}
      explicacion={t('pantallas.comparacion.json.detalle', {
        anadidas: r.anadidas,
        quitadas: r.quitadas,
        cambiadas: r.cambiadas,
      })}
    />
  );
}

export function VistaComparacionJson({ c }: { c: ComparacionJson }) {
  const { t } = useT();
  return (
    <>
      <Tarjeta>
        <VeredictoJson
          r={{ anadidas: c.anadidas.length, quitadas: c.quitadas.length, cambiadas: c.cambiadas.length }}
        />
      </Tarjeta>
      <Tarjeta titulo={t('pantallas.comparacion.json.cambiosTitulo')}>
        {totalCambios(c) ? (
          <TablaCambiosJson d={c} />
        ) : (
          <p className="sm muted">{t('pantallas.comparacion.json.sinCambios')}</p>
        )}
      </Tarjeta>
    </>
  );
}
