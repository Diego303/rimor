/**
 * Los cambios estructurales entre dos valores (IN-045): una fila por ruta, en el orden del documento, con su valor
 * antes y después (las añadidas y quitadas, con «—» en el lado que no tienen). La usan la vista (frente a la versión
 * anterior) y la comparación de dos configuraciones.
 */
import { useT } from '../../i18n/useT';
import type { DiferenciasJson, ValorJson } from './analisis';
import { valorCorto } from './valores';

const VACIO = '—';

export function TablaCambiosJson({ d }: { d: DiferenciasJson }) {
  const { t } = useT();
  const filas = [
    ...d.cambiadas.map((c) => ({ ruta: c.ruta, antes: c.antes as ValorJson | undefined, despues: c.despues })),
    ...d.anadidas.map((c) => ({ ruta: c.ruta, antes: undefined, despues: c.valor as ValorJson | undefined })),
    ...d.quitadas.map((c) => ({ ruta: c.ruta, antes: c.valor as ValorJson | undefined, despues: undefined })),
  ];
  return (
    <div className="tbl-wrap">
      <table className="tabla-cambios-json">
        <thead>
          <tr>
            <th>{t('pantallas.comparacion.json.ruta')}</th>
            <th>{t('pantallas.comparacion.json.antes')}</th>
            <th>{t('pantallas.comparacion.json.despues')}</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.ruta}>
              <td className="mono xs">{f.ruta}</td>
              <td className="mono xs">
                {f.antes === undefined ? <span className="faint">{VACIO}</span> : valorCorto(f.antes)}
              </td>
              <td className="mono xs">
                {f.despues === undefined ? <span className="faint">{VACIO}</span> : valorCorto(f.despues)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
