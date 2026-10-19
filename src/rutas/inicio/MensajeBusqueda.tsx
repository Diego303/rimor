/**
 * Mensaje de una búsqueda `?texto` del compositor (como `searchMsg` de la referencia): hasta 5 resultados y
 * «Abrir en Buscar». Busca en lo que el repositorio tiene en memoria hasta que llegue el buscador (IN-032).
 */
import type { FrontmatterComun } from '@rimor/formato';
import type { BusquedaPendiente } from '../../captura/compositor';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, FilaElemento } from '../../ui/componentes';
import { Icono } from '../../ui/iconos/Icono';
import { SimboloRimor } from '../../ui/marca/SimboloRimor';

interface Props {
  busqueda: BusquedaPendiente;
  resultado: { total: number; resultados: FrontmatterComun[] };
  alAbrir: (ref: string) => void;
  alBuscar: (texto: string) => void;
  /** La línea de resumen de cada resultado (el resumen legible de su lector). */
  resumen: (fm: FrontmatterComun) => string;
}

export function MensajeBusqueda({ busqueda, resultado, alAbrir, alBuscar, resumen }: Props) {
  const { t } = useT();
  const fecha = new Date(busqueda.en);
  return (
    <article className="msg fresh">
      <div className="mhead">
        <span className="ti k-cod">
          <Icono nombre="buscar" tamano={16} />
        </span>
        <span className="tt">?{busqueda.texto}</span>
        <time className="time" dateTime={busqueda.en}>
          {Number.isNaN(fecha.getTime()) ? '' : fmtHora(fecha)}
        </time>
      </div>
      <div className="rimor">
        <span className="av">
          <SimboloRimor variante="mono" tamano={13} />
        </span>
        <div className="cuerpo-busqueda">
          <p>
            {resultado.total
              ? t('pantallas.inicio.busqueda', { n: resultado.total })
              : t('pantallas.inicio.sinResultados')}
          </p>
          {resultado.resultados.length > 0 && (
            <div className="list">
              {resultado.resultados.map((fm) => (
                <FilaElemento key={fm.id} fm={fm} resumen={resumen(fm)} alAbrir={alAbrir} />
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mact">
        <Boton pequeno onClick={() => alBuscar(busqueda.texto)}>
          {t('pantallas.inicio.abrirEnBuscar')}
        </Boton>
      </div>
    </article>
  );
}
