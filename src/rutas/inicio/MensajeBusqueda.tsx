/**
 * Mensaje de una búsqueda `?texto` del compositor (como `searchMsg` de la referencia): hasta 5 resultados y
 * «Abrir en Buscar». Busca con el motor (IN-032); sin él, con lo que el repositorio tiene en memoria. Abrir un
 * resultado cuenta una búsqueda con resultado abierto, una vez por mensaje.
 */
import type { FrontmatterComun } from '@rimor/formato';
import { useBuscar, useBusquedaOpcional, useContarAbierto } from '../../busqueda/Busqueda';
import { Resaltado } from '../../busqueda/Resaltado';
import type { BusquedaPendiente } from '../../captura/compositor';
import { fmtHora } from '../../i18n/formatos';
import { useT } from '../../i18n/useT';
import { Boton, FilaElemento } from '../../ui/componentes';
import { Icono } from '../../ui/iconos/Icono';
import { SimboloRimor } from '../../ui/marca/SimboloRimor';
import { RESULTADOS_EN_FEED } from './filas';

interface Props {
  busqueda: BusquedaPendiente;
  /** Lo que se encuentra en memoria: sin motor, o mientras responde. */
  resultado: { total: number; resultados: FrontmatterComun[] };
  alAbrir: (ref: string) => void;
  alBuscar: (texto: string) => void;
  /** La línea de resumen de cada resultado (el resumen legible de su lector). */
  resumen: (fm: FrontmatterComun) => string;
}

export function MensajeBusqueda({ busqueda, resultado: enMemoria, alAbrir, alBuscar, resumen }: Props) {
  const { t } = useT();
  const fecha = new Date(busqueda.en);
  const motor = useBusquedaOpcional();
  const { busqueda: delMotor } = useBuscar(busqueda.texto);
  const contar = useContarAbierto();
  const resultado =
    motor && delMotor
      ? { total: delMotor.total, resultados: delMotor.resultados.slice(0, RESULTADOS_EN_FEED).map((r) => r.fm) }
      : enMemoria;
  const terminos = (fm: FrontmatterComun) => [
    ...(delMotor?.resultados.find((r) => r.fm.id === fm.id)?.terminos ?? []),
    ...(delMotor?.consulta.palabras ?? []),
  ];
  const abrir = (ref: string) => {
    contar(`inicio:${busqueda.en}|${busqueda.texto}`);
    alAbrir(ref);
  };
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
                <FilaElemento
                  key={fm.id}
                  fm={fm}
                  titulo={<Resaltado texto={fm.titulo} terminos={terminos(fm)} />}
                  resumen={resumen(fm)}
                  alAbrir={abrir}
                />
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
