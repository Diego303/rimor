/**
 * Comparación de dos conjuntos de datos (IN-044): el veredicto con el cambio de filas, las columnas añadidas,
 * quitadas y las que cambian de tipo, y una tabla con los cambios de distribución de las comunes (de la que más a la
 * que menos cambia). La referencia no la dibuja: se compone con sus piezas (veredicto, `kv`, tabla).
 */
import type { ComparacionDatos } from '../../comparaciones/datos';
import type { ResultadoDatos } from '../../comparaciones/resultado';
import { fmtNumero, type Idioma } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { valorLegible } from '../../lectores/datos/lector';
import type { Valor } from '../../lectores/datos/motor';
import { Tarjeta, Veredicto } from '../../ui/componentes';

/** «+120 filas», «−3 filas» o «=». */
function cambioFilas(a: number, b: number, idioma: Idioma): string {
  if (a === b) return '=';
  return `${b > a ? '+' : '−'}${fmtNumero(Math.abs(b - a), idioma)}`;
}

/** El veredicto: del cálculo de ahora o del resultado guardado. */
export function VeredictoDatos({
  r,
}: {
  r: Pick<ResultadoDatos, 'filas_a' | 'filas_b' | 'cambian' | 'columnas_anadidas' | 'columnas_quitadas'>;
}) {
  const { t, idioma } = useT();
  const columnas = r.columnas_anadidas + r.columnas_quitadas;
  return (
    <Veredicto
      tono={r.cambian || columnas ? 'warn' : 'ok'}
      cifra={cambioFilas(r.filas_a, r.filas_b, idioma)}
      frase={t('pantallas.comparacion.datos.filas', {
        antes: fmtNumero(r.filas_a, idioma),
        despues: fmtNumero(r.filas_b, idioma),
      })}
      explicacion={`${t('pantallas.comparacion.datos.cambian', { n: r.cambian })} · ${t(
        'pantallas.comparacion.datos.columnas',
        { anadidas: r.columnas_anadidas, quitadas: r.columnas_quitadas },
      )}`}
    />
  );
}

const par = (x: [Valor | undefined, Valor | undefined] | undefined, idioma: Idioma) =>
  x ? `${valorLegible(x[0], idioma)} → ${valorLegible(x[1], idioma)}` : '—';

export function VistaComparacionDatos({ c }: { c: ComparacionDatos }) {
  const { t, idioma } = useT();
  return (
    <>
      <Tarjeta>
        <VeredictoDatos
          r={{
            filas_a: c.filas[0],
            filas_b: c.filas[1],
            cambian: c.cambios.length,
            columnas_anadidas: c.anadidas.length,
            columnas_quitadas: c.quitadas.length,
          }}
        />
        {(c.anadidas.length > 0 || c.quitadas.length > 0 || c.cambianTipo.length > 0) && (
          <dl className="kv">
            {c.anadidas.length > 0 && (
              <>
                <dt>{t('pantallas.comparacion.datos.anadidas')}</dt>
                <dd className="mono">{c.anadidas.join(' · ')}</dd>
              </>
            )}
            {c.quitadas.length > 0 && (
              <>
                <dt>{t('pantallas.comparacion.datos.quitadas')}</dt>
                <dd className="mono">{c.quitadas.join(' · ')}</dd>
              </>
            )}
            {c.cambianTipo.map((x) => (
              <div key={x.nombre} className="contents">
                <dt>{t('pantallas.comparacion.datos.tipo', { columna: x.nombre })}</dt>
                <dd className="mono xs">
                  {x.antes} → {x.despues}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Tarjeta>
      <Tarjeta titulo={t('pantallas.comparacion.datos.cambiosTitulo')}>
        {c.cambios.length ? (
          <div className="tbl-wrap">
            <table className="tabla-cambios-datos">
              <thead>
                <tr>
                  <th>{t('pantallas.comparacion.datos.columna')}</th>
                  <th>{t('pantallas.comparacion.datos.nulos')}</th>
                  <th>{t('pantallas.comparacion.datos.media')}</th>
                  <th>{t('pantallas.comparacion.datos.minimo')}</th>
                  <th>{t('pantallas.comparacion.datos.maximo')}</th>
                  <th>{t('pantallas.comparacion.datos.unicos')}</th>
                </tr>
              </thead>
              <tbody>
                {c.cambios.map((x) => (
                  <tr key={x.nombre}>
                    <td>
                      <b className="mono sm">{x.nombre}</b>
                    </td>
                    <td className="n">{par(x.nulos, idioma)}</td>
                    <td className="n">{par(x.media, idioma)}</td>
                    <td className="n">{par(x.min, idioma)}</td>
                    <td className="n">{par(x.max, idioma)}</td>
                    <td className="n">{par(x.unicos, idioma)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="sm muted">{t('pantallas.comparacion.datos.sinCambios')}</p>
        )}
      </Tarjeta>
    </>
  );
}
